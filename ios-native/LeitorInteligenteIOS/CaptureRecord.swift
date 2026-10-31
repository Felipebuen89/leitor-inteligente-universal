import Foundation

struct CaptureRecord: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var original: String
    var text: String
    var source: String = "Tela compartilhada"
    var capturedAt: Date = Date()
}

enum CaptureStore {
    private static var file: URL? {
        try? FileManager.default.url(for: .applicationSupportDirectory,
                                     in: .userDomainMask,
                                     appropriateFor: nil,
                                     create: true)
            .appendingPathComponent("leituras.json")
    }

    static func read() -> [CaptureRecord] {
        guard let file, let data = try? Data(contentsOf: file),
              let records = try? JSONDecoder().decode([CaptureRecord].self, from: data) else { return [] }
        return records
    }

    static func write(_ records: [CaptureRecord]) {
        guard let file, let bytes = try? JSONEncoder().encode(records) else { return }
        try? bytes.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func clear() {
        guard let file else { return }
        try? FileManager.default.removeItem(at: file)
    }
}
