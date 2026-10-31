import SwiftUI

@main
struct LeitorInteligenteApp: App {
    @StateObject private var reader = ScreenReaderController()
    var body: some Scene {
        WindowGroup {
            ReaderHomeView()
                .environmentObject(reader)
        }
    }
}

struct ReaderHomeView: View {
    @EnvironmentObject var reader: ScreenReaderController
    @Environment(\.scenePhase) private var scenePhase
    @State private var showingExport = false
    @State private var confirmClear = false
    @State private var showHelp = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 9) {
                        Label("LEITOR EXTERNO • iOS 27", systemImage: "viewfinder")
                            .font(.caption2).bold().foregroundStyle(.blue)
                        Text("Leia a tela.\nOrganize os dados.")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("Inicie a captura autorizada, abra outro aplicativo e navegue pelas informações. Volte aqui para revisar os textos reconhecidos.")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 14)

                    VStack(alignment: .leading, spacing: 14) {
                        Text("CAPTURA DA TELA").font(.caption).bold()
                            .foregroundStyle(reader.isRunning ? .green : .secondary)
                        Text(reader.status).font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        if reader.isRunning {
                            Button(role: .destructive, action: { reader.stop() }) {
                                Label("Encerrar leitura", systemImage: "stop.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                        } else {
                            Button(action: { reader.startPicker() }) {
                                Label("Ativar leitura da tela inteira", systemImage: "record.circle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        Text("Escolha Compartilhar Tela Inteira no aviso do iOS. Selecionar apenas Safari não acompanha outros aplicativos.")
                            .font(.caption).foregroundStyle(.secondary)
                        Label("O iPhone não permite uma bolinha flutuante personalizada sobre o banco. A captura deve continuar pela permissão do sistema, mesmo sem bolinha.", systemImage: "info.circle")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    .padding(17)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                    VStack(alignment: .leading, spacing: 10) {
                        Text("TESTE DE SEGUNDO PLANO").font(.caption).bold()
                        Text(reader.lastBackgroundCheck)
                            .font(.subheadline)
                            .foregroundStyle(reader.framesInBackground > 0 ? .green : .secondary)
                        HStack(spacing: 16) {
                            VStack(alignment: .leading) {
                                Text("\(reader.framesReceived)").font(.title2).bold()
                                Text("Quadros recebidos").font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .leading) {
                                Text("\(reader.framesInBackground)").font(.title2).bold()
                                Text("Quadros fora do leitor").font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .leading) {
                                Text("\(reader.linesInBackground)").font(.title2).bold()
                                Text("Linhas fora do leitor").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        Text("Teste seguro: inicie a captura, abra Notas com texto fictício, volte ao leitor e confira os contadores. A captura em banco pode ser bloqueada.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(17)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                    HStack {
                        VStack(alignment: .leading) {
                            Text("\(reader.records.count)").font(.title).bold()
                            Text("Linhas coletadas").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(action: { showingExport = true }) {
                            Label("Exportar CSV", systemImage: "square.and.arrow.up")
                        }
                        .disabled(reader.records.isEmpty || reader.isRunning)
                    }
                    .padding(17)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))

                    HStack {
                        Text("Revisão").font(.title3).bold()
                        Spacer()
                        Button("Apagar") { confirmClear = true }
                            .disabled(reader.isRunning || reader.records.isEmpty)
                    }

                    if reader.records.isEmpty {
                        ContentUnavailableView("Nenhuma linha capturada",
                                               systemImage: "text.viewfinder",
                                               description: Text("Faça um teste em uma tela fictícia, sem senhas ou dados bancários reais."))
                    }
                    ForEach($reader.records) { $record in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Texto reconhecido").font(.caption).foregroundStyle(.secondary)
                            TextField("Texto para conferência", text: $record.text, axis: .vertical)
                                .lineLimit(2...5)
                                .textInputAutocapitalization(.never)
                                .onChange(of: record.text) { _, _ in reader.save() }
                            Text(record.source).font(.caption2).foregroundStyle(.secondary)
                            if record.text != record.original {
                                Label("Alterado manualmente", systemImage: "pencil")
                                    .font(.caption2).foregroundStyle(.orange)
                            }
                        }
                        .padding(13)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }

                    Button("Sobre limites e privacidade") { showHelp = true }
                        .frame(maxWidth: .infinity)
                }
                .padding(18)
            }
            .navigationTitle("Leitor Inteligente")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: scenePhase) { _, newPhase in
                reader.appVisibilityChanged(newPhase)
            }
            .confirmationDialog("Apagar todos os registros desta sessão?", isPresented: $confirmClear) {
                Button("Apagar registros", role: .destructive) { reader.clear() }
            }
            .sheet(isPresented: $showingExport) {
                if let url = reader.exportCSV() {
                    ShareSheet(activityItems: [url])
                }
            }
            .alert("Como funciona", isPresented: $showHelp) {
                Button("Entendi", role: .cancel) {}
            } message: {
                Text("Esta versão usa ScreenCaptureKit no iOS 27 e Vision local. Não envia quadros para servidores. Alguns bancos ocultam telas protegidas; não tentamos contornar esse bloqueio. Teste somente com informações fictícias.")
            }
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
