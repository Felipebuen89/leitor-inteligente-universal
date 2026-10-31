# Teste de captura em segundo plano no iPhone (iOS 27)

## Estado real
- Código da versão nativa compilado para **iPhone físico** no GitHub Actions (sem assinatura).
- Relatório confirmado: https://github.com/Felipebuen89/leitor-inteligente-universal/actions/runs/41208910765
- O pacote IPA gerado é **sem assinatura** e não instala pelo Safari. Ele exige assinatura Apple e distribuição adequada.
- **Não houve teste em dispositivo físico neste trabalho**. Compilar não equivale a comprovar captura em segundo plano.
- A versão web adicionada à tela inicial do iPhone pelo Safari **não consegue continuar o OCR** enquanto outro aplicativo está aberto e não pode colocar uma bolinha personalizada por cima de apps.

## Experimento seguro após instalar a versão nativa assinada

1. No iPhone com iOS 27, abra o **Leitor Inteligente nativo**, não o atalho do Safari.
2. Use uma tela fictícia com três lançamentos em **Notas**; não comece com o banco.
3. Toque em **Ativar leitura da tela inteira**.
4. No seletor do sistema, escolha explicitamente **Compartilhar Tela Inteira**. Não selecione apenas a janela ou o aplicativo Safari.
5. Abra Notas, visualize as linhas e role a tela com calma.
6. Volte ao leitor após alguns segundos. Não encerre a captura antes de verificar os contadores.
7. Veja **Quadros fora do leitor** e **Linhas fora do leitor**. Se ambos forem zero, capture o erro e a mensagem do app.
8. Toque **Encerrar leitura** e revise os registros. Teste a exportação somente com dados fictícios.

## Como interpretar
- **Quadros fora do leitor > 0**: indica que o ScreenCaptureKit entregou buffers ao app fora do primeiro plano. Não prova que o OCR leu corretamente cada linha.
- **Linhas fora do leitor > 0**: indica que o OCR reconheceu linhas adicionais enquanto o app estava em segundo plano.
- **Ambos zero**: NÃO é um teste aprovado. Confirmar permissão, seleção Tela Inteira, versão iOS, tela de destino e logs do dispositivo.
- Mesmo com contadores positivos, aplicativos bancários podem exibir imagens pretas, ocultar valores ou bloquear a captura por segurança.

## Controles e privacidade
- O app pede consentimento do sistema e mostra o indicador padrão de compartilhamento do iOS.
- **Não existe bolinha flutuante própria que permaneça sobre apps de terceiros no iPhone.** O controle principal da captura continua no aplicativo e no indicador de compartilhamento do iOS.
- OCR é feito com Vision localmente; as imagens dos quadros não são gravadas nem enviadas a um servidor.
- Desative notificações sensíveis com Não Perturbe para evitar leitura acidental de conteúdo privado.
- Não tente contornar bloqueios de captura do banco.
- Os registros são salvos localmente e podem ser apagados no app.

## Desenvolvimento e validação
O fluxo principal utiliza `SCContentSharingPicker.present()`, `SCStream`, `VNRecognizeTextRequest` e `UIBackgroundModes=screen-capture`, conforme o exemplo oficial da Apple:
https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios

Para instalar em aparelho físico, é necessário assinar o aplicativo com credenciais Apple, normalmente usando Xcode em Mac. O artefato unsigned é somente para verificação de compilação e eventual assinatura; **não é um aplicativo pronto para download/instalação**.
