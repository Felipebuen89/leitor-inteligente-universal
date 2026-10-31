/* Leitura local de gravações de tela do iPhone.
 * Solução de teste: não captura outro aplicativo em tempo real.
 * Não utiliza serviços próprios, não envia o arquivo e não salva quadros.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $("recordingFileInput"), analyzeBtn = $("analyzeRecordingBtn");
  const cancelBtn = $("cancelRecordingBtn"), selected = $("selectedRecording");
  const status = $("videoStatus"), progressWrap = $("videoProgressWrap");
  const progress = $("videoProgress"), progressText = $("videoProgressText"), percent = $("videoProgressPct");
  if (!fileInput || !analyzeBtn || !selected || !status || !progressWrap || !progress || !progressText || !percent) return;

  const MAX_DURATION = 90, MAX_BYTES = 200 * 1024 * 1024;
  const FRAME_INTERVAL = 2, MAX_FRAMES = 45;
  let pending = null, running = false, epoch = 0, video = null, currentURL = null;

  const say = (message, isError = false) => {
    status.textContent = message;
    status.style.color = isError ? "#ffb8ad" : "#b2c8e8";
  };
  const sync = () => {
    analyzeBtn.disabled = running || !pending;
    fileInput.disabled = running;
    if (cancelBtn) { cancelBtn.hidden = !running; cancelBtn.disabled = !running; }
  };
  const validFile = file => !!file &&
    (/video\/(quicktime|mp4|webm)/i.test(file.type) || /\.(mov|mp4|webm)$/i.test(file.name));
  const clearPreview = () => {
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); video.remove(); video = null; }
    if (currentURL) { URL.revokeObjectURL(currentURL); currentURL = null; }
  };

  function cancel() {
    epoch++;
    running = false;
    clearPreview();
    progressWrap.hidden = true;
    sync();
    say("Leitura cancelada. Verifique os registros já obtidos antes de exportar.");
  }
  if (cancelBtn) cancelBtn.addEventListener("click", cancel);
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    pending = null;
    if (!f) { selected.textContent = "Nenhuma gravação selecionada.";sync();return; }
    if (!validFile(f)) { say("Escolha uma gravação .MOV, .MP4 ou .WEBM.", true); sync();return; }
    if (f.size > MAX_BYTES) { say("Gravação maior que 200 MB. Faça um vídeo mais curto.", true);sync();return; }
    pending = f;
    selected.textContent = f.name + " · " + (f.size / 1024 / 1024).toFixed(1) + " MB";
    say("Gravação selecionada. A análise acontece no seu próprio aparelho.");
    sync();
  });

  function onceMedia(element, okEvent, errorEvent = "error", timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let timer;
      function cleanup() {
        element.removeEventListener(okEvent, done);
        element.removeEventListener(errorEvent, failed);
        clearTimeout(timer);
      }
      function done() { cleanup(); resolve(); }
      function failed() {
        cleanup();
        reject(new Error("Formato de vídeo não reproduzível neste navegador."));
      }
      element.addEventListener(okEvent, done, { once: true });
      element.addEventListener(errorEvent, failed, { once: true });
      timer = setTimeout(() => {cleanup();reject(new Error("A leitura do vídeo demorou demais."));}, timeoutMs);
    });
  }

  async function createVideo(file) {
    currentURL = URL.createObjectURL(file);
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.controls = false;
    video.setAttribute("aria-label", "Prévia da gravação selecionada");
    video.className = "recording-preview";
    const host = $("videoPreviewSlot");
    if (host) host.replaceChildren(video);
    const ready = onceMedia(video, "loadedmetadata");
    video.src = currentURL;
    video.load();
    await ready;
    if (!Number.isFinite(video.duration) || video.duration <= 0)
      throw new Error("O vídeo não informa sua duração. Use uma gravação completa do iPhone.");
    if (video.duration > MAX_DURATION)
      throw new Error("Gravação com " + Math.round(video.duration) + " segundos. Este teste aceita até 90 segundos.");
    if (!video.videoWidth || !video.videoHeight)
      throw new Error("Não foi possível obter o tamanho da imagem do vídeo.");
    // iOS pode exigir a decodificação iniciada no elemento antes do primeiro seek.
    try { await video.play(); video.pause(); } catch {
      // Seguir com a busca de quadros: alguns codecs permitem seek sem play().
    }
    return video;
  }

  async function seekTo(time) {
    if (!video) throw new Error("A gravação foi encerrada.");
    if (Math.abs(video.currentTime - time) < 0.05 && video.readyState >= 2) return;
    const ready = onceMedia(video, "seeked");
    video.currentTime = time;
    await ready;
    if (video.readyState < 2) await onceMedia(video, "loadeddata");
  }

  function paintFrame(canvas, context, element) {
    const scale = Math.min(1, 1600 / Math.max(element.videoWidth, element.videoHeight));
    canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
  }

  analyzeBtn.addEventListener("click", async () => {
    if (!pending || running) return;
    const file = pending, generation = ++epoch;
    running = true;sync();
    progressWrap.hidden = false;
    progress.value = 0;percent.textContent = "0%";
    let scanned = 0, newLines = 0, finished = false;
    try {
      const handler = window.LeitorVideoAdapter;
      if (!handler?.consumeFrame) throw new Error("Motor de reconhecimento indisponível.");
      say("Abrindo a gravação no próprio iPhone...");
      const element = await createVideo(file);
      if (epoch !== generation) return;
      const duration = element.duration;
      // Amostragem visível: até 45 quadros, 1 a cada 2 s. Role devagar durante a gravação.
      const positions = [];
      for (let t = 0; t < duration && positions.length < MAX_FRAMES; t += FRAME_INTERVAL)
        positions.push(Math.min(Math.max(0, duration - 0.15), t + 0.5));
      if (!positions.length) positions.push(0);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("O navegador não liberou a leitura dos quadros.");
      for (let i = 0; i < positions.length; i++) {
        if (epoch !== generation) return;
        progressText.textContent = "Reconhecendo quadro " + (i + 1) + " de " + positions.length;
        await seekTo(positions[i]);
        if (epoch !== generation) return;
        paintFrame(canvas, ctx, element);
        const result = await handler.consumeFrame(canvas, "Gravação: " + file.name, () => epoch === generation);
        if (epoch !== generation) return;
        scanned++;
        newLines += result.added || 0;
        const pct = Math.round((i + 1) / positions.length * 100);
        progress.value = pct;percent.textContent = pct + "%";
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      canvas.width = 0;canvas.height = 0;
      finished = true;
      say("Análise concluída: " + scanned + " quadros examinados, " + newLines +
        " linhas adicionadas. Confira tudo em Registros. Quadros entre intervalos podem não ter sido lidos.");
      if (newLines && handler.openReview) handler.openReview();
    } catch (error) {
      if (epoch === generation) say("Não foi possível concluir: " + (error?.message || String(error)) +
        " Se houve registros parciais, revise-os. Experimente outra gravação curta.", true);
    } finally {
      if (epoch === generation) {
        running = false; progressWrap.hidden = true;clearPreview();sync();
      }
    }
  });

  window.addEventListener("pagehide", () => {epoch++;clearPreview();});
  sync();
})();