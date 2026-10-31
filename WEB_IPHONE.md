# Leitor Inteligente Universal — PWA para iPhone

Esta é uma versão experimental **100% hospedável no GitHub Pages**, sem Replit, backend ou assinatura.

## Colocar no ar
1. Acesse o repositório do usuário no GitHub.
2. Abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. Abra **Actions → Publicar Leitor Web no GitHub Pages** e, se necessário, execute **Run workflow**.
5. Após um deploy com sucesso, abra o endereço exibido em **Settings → Pages** pelo Safari.
6. No iPhone, use Compartilhar → Adicionar à Tela de Início.

## Recursos da versão web
- Seleção de imagens (JPG/PNG/WEBP), PDFs, textos TXT e CSV.
- OCR com Tesseract.js, carregado da CDN quando necessário.
- PDF com PDF.js; em páginas sem texto digital, tentativa de OCR da imagem.
- Detecção inicial de padrões de faturas e agendas e preservação em texto genérico.
- Revisão, alertas de duplicidade e exportação CSV/JSON mediante aprovação.
- Sem envio intencional dos arquivos a servidor de aplicação. OCR e PDF rodam no navegador, bibliotecas e idiomas são baixados externamente.
- Dados somente na memória da aba; **não há sincronização nem recuperação de sessões**.

## Limites
- Sem botão flutuante sobre outros aplicativos no iOS.
- Não interpreta qualquer tela perfeitamente. Textos e tabelas complexos exigem revisão.
- Até 10 arquivos por lote, 15 MB cada, 15 páginas de PDF por arquivo e 1.200 linhas por leitura.
- Aprovação bloqueada quando houver mais de 300 linhas visíveis sem navegação paginada (evita exportar registros sem revisão).
- Sem OCR de HEIC garantido; depende do navegador.
- Não é versão homologada para dados clínicos, bancários ou sigilosos.

## Estrutura
- `web/index.html`: interface
- `web/styles.css`: visual responsivo
- `web/app.js`: OCR, PDF, extração, revisão, exportação
- `web/sw.js`: cache de arquivos estáticos (não cacheia documentos)
- `web/manifest.webmanifest` e `web/icon.svg`: instalação na tela inicial
- `.github/workflows/pages.yml`: deploy gratuito do site pelo GitHub Actions

**Independente do Clinic Resolve e dos outros sistemas existentes.**
