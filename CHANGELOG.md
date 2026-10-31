## v0.3.2-alpha — 31/10/2026 — robustez da captura e preparação do APK

- Corrigido o redimensionamento de captura em rotação/tamanho de aplicativo (MediaProjection.Callback), mantendo um único VirtualDisplay por consentimento.
- Limite por frame reduzido para 8 milhões de pixels; captura interrompida quando tamanho não suportado.
- Ao limpar a sessão o serviço de captura para e leituras importadas ainda pendentes são invalidadas.
- Fluxo GitHub Actions passa a executar testes de regressão antes do Gradle.
- Validações locais de núcleo Python e Kotlin; a compilação Android segue pendente por falta de SDK/Gradle e rede.

# Histórico de versões

## v0.3.0-alpha — 31/10/2026 — prova de conceito Android (fonte)

- Criado projeto Android nativo separado, com solicitação explícita de projeção e serviço foreground com notificação de parada.
- Adicionada bolha sobre outros apps, arrastável, com ações LER, VER e PARAR; captura pontual de quadros por `MediaProjection`/`ImageReader`.
- OCR local via ML Kit, inclusive imagem importada pelo seletor Android; sem permissão INTERNET.
- Sessão temporária com revisão de todas as páginas, alerta de repetições, data/hora/valor heurísticos, aprovação explícita e exportação CSV protegida contra fórmulas.
- Núcleo Kotlin puro compilado e validado com testes locais; manifest auditado. Testes Python de regressão preservados.
- **Não foi gerado APK** porque não há Android SDK/Gradle/emulador local; não executado no aparelho. Ainda não homologado para dados reais.


## v0.2.0 — 31/10/2026 — captura universal sob demanda

- Adicionado modo `general_data` para conteúdo desconhecido, preservando texto e dividindo em até seis colunas sem presumir significado.
- Adicionado agregador de capturas de tela com OCR local, múltiplas capturas, rastreabilidade e eliminação explícita de linhas sobrepostas idênticas (com alertas).
- Criada interface Python/Tkinter Windows em bolha recolhível e arrastável, com seleção de região, recaptura manual, revisão de dados e exportação CSV/JSON após aprovação.
- Adicionados 13 testes sintéticos de captura, genérico, repetição e bloqueio de exportação; total 36 testes aprovados localmente.
- Atualização da Bíblia Mestre com o objetivo de captura visual como função central.
- Interface Windows **não foi executada em Windows real**; o projeto continua experimental e inadequado para dados sensíveis reais.

## v0.1.0 — 31/10/2026 — motor inicial de documentos

- Leitura inicial de PDFs e imagens com OCR, faturas e agendas, revisão manual, CSV/JSON e Excel experimental.
- 23 testes sintéticos aprovados na fase inicial.

## 0.3.1-alpha — 31/10/2026

- Preparado workflow GitHub Actions independente para **tentar** compilar APK debug ao publicar em repositório novo; nenhuma execução remota foi realizada.
- Adicionado no Android revisão por toque prolongado para corrigir o texto de cada linha.
- Preservado texto original do OCR e texto revisado separadamente no CSV, para auditoria.
- A correção atualiza a data, hora, valor detectado e sinalizadores de possíveis repetições, sem apagar linhas automaticamente.
- Exportação é bloqueada novamente após qualquer correção ou mudança de seleção.
- Mantido processamento local sem permissão `INTERNET`, sem API de terceiros.
- Testes locais: 40 testes Python, checagem Kotlin pura executada. **APK ainda não compilado**, sem Android SDK/Gradle/dispositivo no ambiente.