import Foundation
import SwiftUI
import ScreenCaptureKit
import CoreMedia
import CoreImage
import Vision

/// Protótipo iOS 27. Captura com autorização do seletor oficial Apple.
/// Não grava vídeo, não envia dados à rede e não tenta capturar telas protegidas.
final class ScreenReaderController: NSObject, ObservableObject {
    @Published var records: [CaptureRecord] = CaptureStore.read()
    @Published var isRunning = false
    @Published var status = "Leitura parada. Toque para ativar."

    private let picker = SCContentSharingPicker.shared
    private let imageContext = CIContext()
    private let ocrQueue = DispatchQueue(label: "br.com.felipebuen.leitor.ocr", qos: .userInitiated)
    private var activeStream: SCStream?
    private var lastScan = Date.distantPast
    private var processing = false
    private var captureGeneration = 0
    private var observedPicker = false
    private let maxLines = 500
    private var seen = Set<String>()

    override init() {
        super.init()
        seen = Set(records.map { normalized($0.original) })
    }

    deinit {
        picker.remove(self)
    }

    func startPicker() {
        guard !isRunning else { return }
        if !observedPicker {
            picker.add(self)
            observedPicker = true
        }
        picker.isActive = true
        status = "Selecione a tela inteira no diálogo do iPhone."
        picker.present()
    }

    func stop() {
        captureGeneration += 1
        isRunning = false
        processing = false
        status = "Captura interrompida. Revise os dados abaixo."
        picker.isActive = false
        let current = activeStream
        activeStream = nil
        Task {
            if let current {
                try? await current.stopCapture()
            }
        }
    }

    func clear() {
        guard !isRunning else { return }
        records.removeAll()
        seen.removeAll()
        CaptureStore.clear()
        status = "Registros apagados do aparelho."
    }

    func save() {
        CaptureStore.write(records)
    }

    func exportCSV() -> URL? {
        guard !records.isEmpty, !isRunning else { return nil }
        let header = ["Texto corrigido", "Texto original", "Origem", "Data da leitura"]
        let rows = records.map { row in
            [row.text, row.original, row.source,
             ISO8601DateFormatter().string(from: row.capturedAt)]
        }
        let content = "\u{FEFF}" + ([header] + rows)
            .map { $0.map(csvCell).joined(separator: ";") }
            .joined(separator: "\r\n")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("leitura-inteligente.csv")
        do {
            try Data(content.utf8).write(to: url,
                                         options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            return url
        } catch {
            status = "Erro ao preparar CSV: \(error.localizedDescription)"
            return nil
        }
    }

    private func csvCell(_ s: String) -> String {
        var safe = s
        let trimmed = safe.trimmingCharacters(in: .whitespacesAndNewlines)
        if ["=", "+", "-", "@"].contains(where: { trimmed.hasPrefix($0) }) {
            safe = "'" + safe
        }
        return "\"" + safe.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }

    private func normalized(_ s: String) -> String {
        s.lowercased()
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func integrate(_ lines: [String], from generation: Int) {
        guard isRunning, generation == captureGeneration else { return }
        let cleaned = lines.flatMap { $0.components(separatedBy: .newlines) }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && $0.count >= 3 }
        var added = 0
        for line in cleaned {
            let key = normalized(line)
            if seen.contains(key) { continue }
            if records.count >= maxLines {
                status = "Limite de \(maxLines) linhas atingido. Capture encerrada para revisão."
                stop()
                return
            }
            seen.insert(key)
            records.append(CaptureRecord(original: line, text: line))
            added += 1
        }
        if added > 0 {
            save()
            status = "\(records.count) linhas reconhecidas. Continue navegando e depois encerre a leitura."
        } else if records.isEmpty {
            status = "Captura ativa, aguardando texto legível."
        }
    }

    private func beginStream(with filter: SCContentFilter) async {
        // Uma sessão de captura por vez; interrompe a anterior antes de criar uma nova.
        if let old = activeStream { try? await old.stopCapture() }
        activeStream = nil
        captureGeneration += 1
        let config = SCStreamConfiguration()
        config.capturesAudio = false
        config.captureMicrophone = false
        config.queueDepth = 3
        config.minimumFrameInterval = CMTime(value: 1, timescale: 2)

        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        do {
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: .main)
            activeStream = stream
            lastScan = .distantPast
            try await stream.startCapture()
            isRunning = true
            status = "Captura ativa. Abra o outro aplicativo e percorra a tela devagar."
        } catch {
            isRunning = false
            activeStream = nil
            status = "Falha ao iniciar: \(error.localizedDescription)"
        }
    }
}

extension ScreenReaderController: SCContentSharingPickerObserver {
    func contentSharingPicker(_ picker: SCContentSharingPicker,
                              didUpdateWith filter: SCContentFilter,
                              for stream: SCStream?) {
        Task { await beginStream(with: filter) }
    }

    func contentSharingPicker(_ picker: SCContentSharingPicker,
                              didCancelFor stream: SCStream?) {
        status = "Seleção de tela cancelada. Nenhum dado capturado."
    }

    func contentSharingPickerStartDidFailWithError(_ error: Error) {
        status = "Seleção indisponível: \(error.localizedDescription)"
    }
}

extension ScreenReaderController: SCStreamOutput, SCStreamDelegate {
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        stop()
        status = "Captura encerrada pelo iOS: \(error.localizedDescription)"
    }

    func stream(_ stream: SCStream,
                didOutputSampleBuffer buffer: CMSampleBuffer,
                of type: SCStreamOutputType) {
        guard type == .screen, buffer.isValid,
              isRunning, !processing,
              Date().timeIntervalSince(lastScan) >= 1.5,
              let pixels = CMSampleBufferGetImageBuffer(buffer) else { return }

        lastScan = Date()
        guard let image = imageContext.createCGImage(CIImage(cvPixelBuffer: pixels),
                                                    from: CGRect(x: 0, y: 0,
                                                                 width: CVPixelBufferGetWidth(pixels),
                                                                 height: CVPixelBufferGetHeight(pixels))) else { return }

        processing = true
        let generation = captureGeneration
        ocrQueue.async { [weak self] in
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["pt-BR", "en-US"]
            do {
                try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
                let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.processing = false
                    self.integrate(lines, from: generation)
                }
            } catch {
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.processing = false
                    if self.isRunning && self.captureGeneration == generation {
                        self.status = "Não foi possível reconhecer este quadro."
                    }
                }
            }
        }
    }
}
