import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const APP = "/";
async function demo(page) {
  await page.getByRole("button", { name: /Registros/ }).click();
  await page.getByRole("button", { name: /Carregar exemplo fictício/ }).click();
}

test("tela principal prioriza captura direta", async ({page}) => {
  await page.goto(APP);
  await expect(page.getByRole("heading", {name:/Leitura de telas/})).toBeVisible();
  await expect(page.getByRole("button", {name:/Ativar leitura de tela/})).toBeVisible();
  await expect(page.getByText("Exemplo e arquivos")).toBeVisible();
});
test("exemplo fictício, edição, aprovação e CSV", async ({page}) => {
  await page.goto(APP);
  await demo(page);
  await expect(page.locator("#countStat")).toHaveText("4");
  await expect(page.locator(".record")).toHaveCount(4);
  const ok=page.locator("#approval");
  const csv=page.locator("#csvBtn");
  await expect(csv).toBeDisabled();
  await ok.check();
  await expect(csv).toBeEnabled();
  const input=page.locator(".record").first().getByLabel(/Valor/);
  await input.fill("181,00");
  await expect(ok).not.toBeChecked();
  await expect(csv).toBeDisabled();
  await ok.check();
  const dlPromise=page.waitForEvent("download");
  await csv.click();
  const dl=await dlPromise;
  const content=await readFile(await dl.path(),"utf-8");
  expect(content).toContain("181,00");
  expect(content).toContain("EXEMPLO FICTÍCIO");
  expect(content.charCodeAt(0)).toBe(65279);
});
test("captura de arquivo CSV não executa fórmulas no Excel",async({page})=>{
  await page.goto(APP);
  const payload="=HYPERLINK(\"https://example.test\",\"clique\")";
  await page.locator("#fileInput").setInputFiles({name:"exemplo-ficticio.csv",mimeType:"text/csv",buffer:Buffer.from(payload)});
  await page.locator("#processBtn").click();
  await page.getByRole("button",{name:/Registros/}).click();
  await expect(page.locator("#countStat")).toHaveText("1");
  await page.locator("#approval").check();
  const dlPromise=page.waitForEvent("download");
  await page.locator("#csvBtn").click();
  const dl=await dlPromise;
  const content=await readFile(await dl.path(),"utf-8");
  expect(content).toContain("'=HYPERLINK");
});
test("limite de 1200 linhas bloqueia processamento parcial",async({page})=>{
  await page.goto(APP);
  const lines=Array.from({length:1201},(_,i)=>"Linha fictícia "+(i+1)).join("\n");
  await page.locator("#fileInput").setInputFiles({name:"teste.txt",mimeType:"text/plain",buffer:Buffer.from(lines)});
  await page.locator("#processBtn").click();
  await expect(page.locator("#status")).toContainText("1200 linhas excedido");
  await page.getByRole("button",{name:/Registros/}).click();
  await expect(page.locator("#countStat")).toHaveText("0");
});
test("linhas acima de 300 exigem paginação e bloqueiam aprovação",async({page})=>{
  await page.goto(APP);
  const lines=Array.from({length:301},(_,i)=>"Linha fictícia "+(i+1)).join("\n");
  await page.locator("#fileInput").setInputFiles({name:"teste.txt",mimeType:"text/plain",buffer:Buffer.from(lines)});
  await page.locator("#processBtn").click();
  await expect(page.locator("#countStat")).toHaveText("301");
  await expect(page.locator("#approval")).toBeDisabled();
});
test("apagar sessão remove dados sem perder navegação",async({page})=>{
  await page.goto(APP);await demo(page);
  page.once("dialog",d=>d.accept());
  await page.locator("#clearBtn").click();
  await page.getByRole("button",{name:/Registros/}).click();
  await expect(page.locator("#countStat")).toHaveText("0");
});
test("captura compartilhada funciona com MediaStream simulado e OCR fictício",async({page})=>{
  await page.addInitScript(()=>{
    window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:"03/10 Posto de combustível R$ 180,00"}}),terminate:async()=>{}})};
    const orig=navigator.mediaDevices||{};
    Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{...orig,getDisplayMedia:async()=>{
      const canvas=document.createElement("canvas");canvas.width=640;canvas.height=360;
      const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,640,360);
      ctx.fillStyle="black";ctx.font="24px Arial";ctx.fillText("03/10 Posto de combustível R$ 180,00",10,50);
      const stream=canvas.captureStream(10);
      const clock=setInterval(()=>{ctx.fillStyle="white";ctx.fillRect(0,0,640,360);ctx.fillStyle="black";ctx.font="24px Arial";ctx.fillText("03/10 Posto de combustível R$ 180,00",10,50);},60);
      stream.getVideoTracks()[0].addEventListener("ended",()=>clearInterval(clock));
      return stream;
    }}});
  });
  await page.goto(APP);
  await page.locator("#startCaptureBtn").click();
  await expect(page.locator("#captureNowBtn")).toBeEnabled({timeout:10000});
  await page.locator("#captureNowBtn").click();
  await expect(page.locator("#captureStatus")).toContainText("1 linha(s)");
  await page.locator("#stopCaptureBtn").click();
  await expect(page.locator("#startCaptureBtn")).toBeEnabled();
  await page.getByRole("button",{name:/Registros/}).click();
  await expect(page.locator("#countStat")).toHaveText("1");
});
test("layout mobile não excede viewport",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(APP);
  await expect(page.locator("#startCaptureBtn")).toBeVisible();
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+1);
});
test("iPhone mostra versão nativa pendente e não oferece captura impossível na PWA", async ({ page }) => {
  await page.setExtraHTTPHeaders({"x-audit-device":"iphone-simulado"});
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => {
    Object.defineProperty(navigator,"userAgent",{
      configurable:true,
      get:()=> "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1"
    });
  });
  await page.goto(APP);
  await expect(page.locator("html")).toHaveClass(/ios-device/);
  await expect(page.getByRole("heading",{name:"Leitura entre aplicativos"})).toBeVisible();
  await expect(page.locator("#desktopScreenCapture")).toBeHidden();
  await expect(page.locator(".alternative-panel")).toBeHidden();
  await expect(page.getByRole("link",{name:/Ver versão nativa no GitHub/})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Teste gratuito pelo iPhone"})).toBeVisible();
  await expect(page.locator("#recordingFileInput")).toHaveAttribute("accept",/\.mov/);
  await expect(page.locator("#analyzeRecordingBtn")).toBeDisabled();
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  expect(dims.scroll).toBeLessThanOrEqual(dims.width+1);
});
test("ícone PNG está válido e aplicativo oferece recuperação do cache",async ({page})=>{
  await page.goto(APP);
  const icon=await page.request.get("/apple-touch-icon.png");
  expect(icon.ok()).toBeTruthy();
  const bytes=await icon.body();
  expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  const refresh=await page.request.get("/atualizar.html");
  expect(refresh.ok()).toBeTruthy();
  expect(await refresh.text()).toContain("caches.delete");
  const sw=await page.request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
  expect(await sw.text()).toContain('cache:"no-store"');
});

test("vídeo de tela é reconhecido localmente, revisado e exportado",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"userAgent",{
      configurable:true,
      get:()=> "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
    });
    window.Tesseract={createWorker:async()=>({
      recognize:async()=>({data:{text:"03/10 Compra fictícia 180,00\n05/10 Outro gasto 39,90"}}),
      terminate:async()=>{}
    })};
  });
  await page.goto(APP);
  const fs=await import("node:fs/promises");
  const bytes=await fs.readFile("tests/assets/auditoria_video.mp4");
  await page.locator("#recordingFileInput").setInputFiles({name:"gravacao-ficticia.mp4",mimeType:"video/mp4",buffer:bytes});
  await expect(page.locator("#analyzeRecordingBtn")).toBeEnabled();
  await page.locator("#analyzeRecordingBtn").click();
  await expect(page.locator("#videoStatus")).toContainText("Análise concluída",{timeout:25000});
  await expect(page.locator("#countStat")).toHaveText("2");
  await expect(page.locator(".record")).toHaveCount(2);
  await page.locator("#approval").check();
  const dlPromise=page.waitForEvent("download");
  await page.locator("#csvBtn").click();
  const dl=await dlPromise;
  const content=await fs.readFile(await dl.path(),"utf8");
  expect(content).toContain("Gravação: gravacao-ficticia.mp4");
  expect(content).toContain("Compra fictícia");
});

test("rejeita arquivo falso e vídeo maior que o limite",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"userAgent",{
      configurable:true,
      get:()=> "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
    });
  });
  await page.goto(APP);
  await page.locator("#recordingFileInput").setInputFiles({
    name:"ficheiro.txt",mimeType:"text/plain",buffer:Buffer.from("não é vídeo")
  });
  await expect(page.locator("#videoStatus")).toContainText("Escolha uma gravação");
  await expect(page.locator("#analyzeRecordingBtn")).toBeDisabled();
});
