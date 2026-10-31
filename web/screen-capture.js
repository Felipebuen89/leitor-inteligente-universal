/* Captura de tela autorizada via MediaDevices.getDisplayMedia.
 * Safari/iOS: suporte e execução em segundo plano dependem da versão/plataforma.
 * Sem envio de quadros a servidor. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const start = $("startCaptureBtn"), stop = $("stopCaptureBtn"), now = $("captureNowBtn");
  const preview = $("capturePreview"), status = $("captureStatus"), auto = $("autoCaptureCheck");
  if (!start || !stop || !now || !preview || !status || !auto) return;
  let stream = null, timer = null, busy = false, count = 0, captureEpoch = 0;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const supported = !isIOS && !!navigator.mediaDevices?.getDisplayMedia && !!window.isSecureContext;
  const iosNotice = $("iosLimitation");
  if (iosNotice && isIOS) iosNotice.hidden = false;

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.style.color = isError ? "#ffb4a6" : "#b0c4df";
  }
  if (!supported) {
    start.disabled = true;
    setStatus(isIOS ? "No iPhone, esta PWA não consegue continuar a leitura enquanto outro aplicativo está aberto. Estamos preparando a versão nativa iOS 27." : "Este navegador não oferece captura direta de tela para páginas web.", true);
  }
  function updateButtons() {
    start.disabled = !supported || !!stream;
    stop.disabled = !stream;
    now.disabled = !stream || busy;
  }
  function stopCapture(reason = "Leitura encerrada.") {
    captureEpoch++;
    if (timer) clearTimeout(timer);
    timer = null;
    const current = stream;
    stream = null;
    preview.pause();
    preview.srcObject = null;
    preview.hidden = true;
    if (current) for (const track of current.getTracks()) track.stop();
    updateButtons();
    setStatus(reason);
  }
  function signature(canvas) {
    // Hash de amostra: evita OCR repetido de quadros inalterados.
    const tiny = document.createElement("canvas");
    tiny.width = 48; tiny.height = 27;
    const ctx = tiny.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, 48, 27);
    const data = ctx.getImageData(0, 0, 48, 27).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 4) {
      hash = Math.imul(hash ^ data[i], 16777619);
      hash = Math.imul(hash ^ data[i + 1], 16777619);
      hash = Math.imul(hash ^ data[i + 2], 16777619);
    }
    return hash >>> 0;
  }
  let previousSignature = null;
  async function grabFrame() {
    if (!stream || busy || document.visibilityState !== "visible") return;
    if (!preview.videoWidth || !preview.videoHeight || preview.readyState < 2) {
      setStatus("Aguardando o primeiro quadro da tela compartilhada...");
      return;
    }
    const myEpoch = captureEpoch;
    const scale = Math.min(1, 1440 / Math.max(preview.videoWidth, preview.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(preview.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(preview.videoHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { setStatus("Não foi possível acessar o quadro capturado.", true); return; }
    try {
      ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
    } catch (err) {
      setStatus("Não foi possível ler o vídeo desta captura.", true);
      return;
    }
    const hash = signature(canvas);
    if (previousSignature === hash) {
      setStatus("Tela sem mudanças. Aguardando novas informações...");
      return;
    }
    busy = true;
    updateButtons();
    setStatus("Reconhecendo informações da tela...");
    try {
      const bridge = window.LeitorCaptureAdapter;
      if (!bridge?.consumeFrame) throw new Error("Motor de leitura indisponível.");
      const result = await bridge.consumeFrame(canvas, () => myEpoch === captureEpoch && !!stream);
      if (myEpoch !== captureEpoch) return;
      previousSignature = hash;
      count += result.added || 0;
      setStatus(result.reason + " Total desta captura: " + count + " linha(s). Veja a aba Registros para revisar.");
    } catch (err) {
      if (myEpoch !== captureEpoch) return;
      const reason = err?.message || String(err);
      setStatus("Erro ao analisar quadro: " + reason, true);
      // Se atingir o limite de registros, interrompe para não omitir dados.
      if (/exced|Limite/.test(reason)) stopCapture(reason);
    } finally {
      busy = false;
      updateButtons();
      canvas.width = 0; canvas.height = 0;
    }
  }
  function scheduleLoop() {
    if (timer) clearTimeout(timer);
    if (!stream) return;
    timer = setTimeout(async () => {
      if (stream && auto.checked) await grabFrame();
      if (stream) scheduleLoop();
    }, 4000);
  }
  start.addEventListener("click", async () => {
    if (stream || !supported) return;
    setStatus("Solicitando autorização do sistema...");
    try {
      // Esta chamada é disparada diretamente pelo toque do usuário.
      const shared = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!shared.getVideoTracks().length) {
        shared.getTracks().forEach(t => t.stop());
        throw new Error("Nenhuma tela ou janela foi selecionada.");
      }
      stream = shared; count = 0; previousSignature = null;
      const myEpoch = ++captureEpoch;
      preview.srcObject = stream;
      preview.hidden = false;
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (captureEpoch === myEpoch) stopCapture("Compartilhamento interrompido pelo sistema.");
      }, { once: true });
      await preview.play();
      updateButtons();
      setStatus("Captura ativa. Você pode tocar em 'Capturar quadro' ou usar a leitura automática enquanto esta página estiver ativa.");
      scheduleLoop();
    } catch (err) {
      if (stream) stopCapture("");
      const name = err?.name || "";
      if (["NotAllowedError", "AbortError"].includes(name))
        setStatus("Compartilhamento não autorizado ou cancelado. Nenhuma imagem foi capturada.", true);
      else
        setStatus("Não foi possível iniciar a captura: " + (err?.message || name), true);
      updateButtons();
    }
  });
  now.addEventListener("click", () => { void grabFrame(); });
  stop.addEventListener("click", () => stopCapture());
  auto.addEventListener("change", () => {
    if (stream) setStatus(auto.checked
      ? "Leitura automática ativada enquanto esta página estiver visível."
      : "Leitura automática desligada. Use 'Capturar quadro' para analisar.");
  });
  document.addEventListener("visibilitychange", () => {
    if (stream && document.visibilityState === "hidden")
      setStatus("O aplicativo ficou em segundo plano. O navegador pode suspender o OCR; essa limitação precisa de teste em iPhone real.");
  });
  window.addEventListener("pagehide", () => { if (stream) stopCapture("Sessão encerrada."); });
  updateButtons();
})();