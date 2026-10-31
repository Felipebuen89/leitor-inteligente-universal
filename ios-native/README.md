# Leitor Inteligente — iOS nativo 27 (protótipo)

**Objetivo real:** botão **Ativar leitura da tela inteira** → o usuário aprova o compartilhamento do iOS → navega por outro aplicativo → OCR local captura linhas visíveis → volta ao Leitor para revisar e exportar.

## Por que a PWA não resolve
Safari/iOS pode suspender o JavaScript quando está em segundo plano. Portanto, uma PWA não consegue prometer OCR contínuo de apps externos. A partir do iOS 27, a Apple oferece **ScreenCaptureKit** com modo de segundo plano `screen-capture`, sem precisar de extensão ReplayKit.

Fontes oficiais:
- https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios
- https://developer.apple.com/documentation/screencapturekit
- https://developer.apple.com/documentation/vision

## Como compilar
1. Xcode 27 instalado em Mac compatível.
2. Instale XcodeGen ou abra o projeto Xcode gerado na esteira CI.
3. `cd ios-native && xcodegen generate && xcodebuild -project LeitorInteligenteIOS.xcodeproj -scheme LeitorInteligenteIOS -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`
4. Para instalar no iPhone **é necessário assinar** o app no Xcode com uma conta Apple e um Mac; o build sem assinatura do GitHub Actions não instala diretamente no iPhone. Uma conta Apple gratuita pode permitir testes pessoais limitados via Xcode; TestFlight/App Store requerem programa de desenvolvedor.

## Segurança
- Sem backend, sem rede, sem login, sem analytics, sem dados enviados.
- OCR por Vision da Apple, offline. O app não persiste imagens das telas, somente as linhas reconhecidas.
- Arquivo local é protegido pelo Data Protection do iOS; o usuário pode apagar.
- Antes de iniciar, peça permissão de captura do sistema. Não captura microfone.
- Não contorna telas bancárias protegidas; pode ser exibido conteúdo vazio ou oculto.
- Comece por dados fictícios, sem informações reais da fatura.
- Limite básico do protótipo: até 500 linhas, sem sincronização, revisão obrigatória.

## Estado
Fonte inicial no GitHub. Precisa de compilação no Xcode 27, assinatura e teste físico com iPhone 13 (iOS 27), além de auditoria de permissões e UX. NÃO afirmar que já está instalável nem homologado.
