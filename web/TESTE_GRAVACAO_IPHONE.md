# Teste no iPhone sem computador — gravação de tela (alternativa)

**Objetivo real do produto:** leitura contínua de outros aplicativos por captura autorizada do sistema, sem precisar exportar ou enviar arquivos. A versão nativa iOS 27 está compilada, porém o IPA do GitHub ainda precisa de **assinatura Apple válida para instalar**; a PWA do Safari não consegue substituí-la.

## Teste possível agora sem Mac, usando recurso do próprio iPhone

1. Abra **Notas** e crie dados inteiramente fictícios, por exemplo `03/10 TESTE MERCADO 59,90`, `04/10 TESTE POSTO 120,00`.
2. No iPhone, abra a Central de Controle e acione **Gravação de Tela**; a gravação precisa ser autorizada no iOS. Essa é a gravação nativa do iPhone, **não** o botão de captura do Safari.
3. Abra Notas, role devagar entre os lançamentos e pare após até 90 segundos.
4. Na versão web do leitor em [GitHub Pages](https://felipebuen89.github.io/leitor-inteligente-universal/?atualizado=5), toque em **Escolher gravação de tela**, escolha o vídeo salvo em Fotos e toque em **Analisar a gravação no iPhone**.
5. O programa amostra no máximo **30 quadros, a cada 3 segundos**, e tenta reconhecer texto com OCR local.
6. Revise os registros, corrija falhas e exporte CSV ou JSON, se desejar.

**Limitações:** não é OCR ao vivo, não existe bolinha flutuante sobre outros aplicativos, vídeos de até 90 segundos e 200 MB, e gravações MOV/MP4 dependem de decodificação suportada pelo Safari. Alguns quadros podem não ser analisados. Uma gravação longa ou movimentação rápida pode perder informação. O sistema não garante reconstrução perfeita de faturas e tabelas. O teste deve usar dados fictícios.

**Privacidade:** a aplicação não faz upload da gravação ao GitHub. Ela usa a reprodução local de vídeo e OCR na aba do navegador, mas as bibliotecas necessárias podem ser baixadas externamente. Não compartilhe nem grave dados bancários reais, senhas, códigos de autenticação ou notificações sensíveis durante a validação.

## Bloqueio de instalação do app nativo

O build iOS 27 pode ser feito automaticamente pelo GitHub Actions sem assinatura. A Apple exige uma assinatura válida para instalação em um iPhone físico. Sem credenciais Apple de distribuição e sem Xcode pareado a um Mac, não há como concluir uma instalação nativa legítima automaticamente só pelo GitHub público. Conta gratuita permite testes com Personal Team pelo Xcode em Mac; TestFlight exige inscrição paga no Apple Developer Program.

- Fonte: https://developer.apple.com/help/account/basics/about-your-developer-account/
- Fonte: https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios

O projeto é independente do Clinic Resolve.
