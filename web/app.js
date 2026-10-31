/* Leitor Inteligente Universal PWA — protótipo browser-only.
   Arquivos permanecem na memória da aba; nenhuma API própria recebe documentos. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const MAX_FILES = 10, MAX_SIZE = 15*1024*1024, MAX_PAGES = 15, MAX_ROWS = 1200;
  const state = {pending:[],records:[],sources:new Set(),busy:false,approved:false,worker:null};
  const labels = {data:"Data",descricao:"Descrição",valor:"Valor (R$)",parcelas:"Parcelas",nome:"Nome",hora:"Horário",procedimento:"Procedimento",texto:"Texto extraído"};
  const fields = {fatura:["data","descricao","valor","parcelas"],agenda:["nome","data","hora","procedimento"],geral:["texto"]};

  function notice(message,error=false){ $("status").textContent=message; $("status").style.color=error?"#ffbbac":"#a5b4c8"; }
  function page(id){
    document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
    document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
    if(id==="registros") render();
  }
  document.querySelectorAll(".tab").forEach(x=>x.addEventListener("click",()=>page(x.dataset.page)));
  function listFiles(){
    $("fileList").replaceChildren();
    for(const f of state.pending){const d=document.createElement("div");d.className="file-chip";d.textContent=f.name+" · "+(f.size/1024/1024).toFixed(1)+" MB";$("fileList").appendChild(d);}
    $("processBtn").disabled=state.busy || !state.pending.length;
    notice(state.pending.length?state.pending.length+" arquivo(s) selecionado(s).":"Nenhum arquivo selecionado.");
  }
  function addFiles(files){
    if(state.busy)return;
    for(const f of files){
      if(state.pending.length >= MAX_FILES){notice("Limite de 10 arquivos por lote.",true);break;}
      if(f.size > MAX_SIZE){notice("Arquivo muito grande: "+f.name+" (máximo 15 MB).",true);continue;}
      if(!/\.(png|jpe?g|webp|heic|heif|pdf|txt|csv)$/i.test(f.name)){notice("Formato não suportado: "+f.name,true);continue;}
      state.pending.push(f);
    }
    listFiles();
  }
  $("fileInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  const drop=$("dropzone");
  ["dragenter","dragover"].forEach(k=>drop.addEventListener(k,e=>{e.preventDefault();drop.classList.add("dragover");}));
  ["dragleave","drop"].forEach(k=>drop.addEventListener(k,e=>{e.preventDefault();drop.classList.remove("dragover");}));
  drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));

  function moneyToNumber(s){
    const v=String(s||"").replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",",".");
    const n=Number(v);
    return Number.isFinite(n)?n:null;
  }
  function parseFatura(line){
    const s=line.replace(/\s+/g," ").trim();
    // Ex.: 03/10 POSTO COMBUSTIVEL R$ 180,00 ou 03/10/2026 Loja 2/10 123,45
    const m=s.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:R\$\s*)?(-?[\d.]+,\d{2})$/i);
    if(!m)return null;
    if(moneyToNumber(m[3])===null)return null;
    let descricao=m[2],parcelas="";
    const p=descricao.match(/\s+(\d{1,2}\/\d{1,2})$/);
    if(p){parcelas=p[1];descricao=descricao.slice(0,p.index);}
    return {data:m[1],descricao,valor:m[3],parcelas};
  }
  function parseAgenda(line){
    const s=line.replace(/\s{2,}/g," | ").trim();
    let m=s.match(/^(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+[|]?\s*(\d{1,2}:\d{2})\s*[|]?\s*(.+)$/);
    if(m) {const parts=m[3].split(/\s*\|\s*/);return {nome:parts[0],data:m[1],hora:m[2],procedimento:parts.slice(1).join(" | ") };}
    m=s.match(/^(.+?)\s*\|\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s*\|\s*(\d{1,2}:\d{2})(?:\s*\|\s*(.+))?$/);
    if(m)return {nome:m[1],data:m[2],hora:m[3],procedimento:m[4]||""};
    m=s.match(/^(\d{1,2}:\d{2})\s*\|\s*([^|]+)\s*\|\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})(?:\s*\|\s*(.+))?$/);
    if(m)return {nome:m[2].trim(),data:m[3],hora:m[1],procedimento:m[4]||""};
    return null;
  }
  function classify(lines,choice){
    if(choice!=="auto")return choice;
    let finance=0,agenda=0;
    for(const l of lines.slice(0,150)){if(parseFatura(l))finance++;if(parseAgenda(l))agenda++;}
    if(finance>0 && finance>=agenda)return "fatura";
    if(agenda>0)return "agenda";
    return "geral";
  }
  function makeRecords(text,source,profile){
    const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(lines.length>MAX_ROWS)throw new Error("Limite de "+MAX_ROWS+" linhas excedido. Divida a leitura em partes para evitar perda de dados.");
    const mode=classify(lines,profile);
    const out=[];
    for(const raw of lines){
      const f= mode==="fatura"?parseFatura(raw):mode==="agenda"?parseAgenda(raw):null;
      // Preserve every unrecognized line as generic text. Never invent fields.
      const kind=f?mode:"geral";
      out.push({id:crypto.randomUUID(),type:kind,fields:f||{texto:raw},raw,source,duplicate:false,edited:false});
    }
    return out;
  }
  function updateDuplicates(){
    const seen=new Set();
    for(const r of state.records){
      const key=r.raw.toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
      r.duplicate=seen.has(key);
      seen.add(key);
    }
  }
  function unapprove(){state.approved=false;$("approval").checked=false;$("csvBtn").disabled=true;$("jsonBtn").disabled=true;}
  function addRecords(newRecords,source){
    if(!newRecords.length)return;
    if(state.records.length+newRecords.length>MAX_ROWS)throw new Error("A sessão excederia "+MAX_ROWS+" linhas. Exporte a sessão atual antes de continuar.");
    state.records.push(...newRecords);
    state.sources.add(source);
    updateDuplicates();
    unapprove();
    render();
  }
  function render(){
    $("countStat").textContent=state.records.length;
    $("tabCount").textContent=state.records.length;
    $("filesStat").textContent=state.sources.size;
    $("flagsStat").textContent=state.records.filter(r=>r.duplicate).length;
    $("csvBtn").disabled=!(state.approved&&state.records.length);
    $("jsonBtn").disabled=!(state.approved&&state.records.length);
    $("reviewList").replaceChildren();
    if(!state.records.length){
      const d=document.createElement("div");d.className="empty";d.textContent="Nenhuma leitura nesta sessão. Importe arquivos ou carregue um exemplo fictício.";$("reviewList").appendChild(d);return;
    }
    const fragment=document.createDocumentFragment();
    const showing=state.records.slice(0,300);
    showing.forEach((r,index)=>{
      const d=document.createElement("article");d.className="record";
      const head=document.createElement("div");head.className="record-top";
      const left=document.createElement("div");const name=document.createElement("strong");
      name.textContent=(index+1)+" · "+({fatura:"Gasto",agenda:"Agendamento",geral:"Texto"}[r.type]);
      const meta=document.createElement("small");meta.textContent=r.source;left.append(name,meta);
      const chip=document.createElement("span");chip.className="badge"+(r.duplicate?" warn":"");
      chip.textContent=r.duplicate?"Possível duplicidade":r.edited?"Corrigido":"Extraído";
      head.append(left,chip);d.appendChild(head);
      const editor=document.createElement("div");editor.className="row-editor";
      for(const k of fields[r.type]){
        const lbl=document.createElement("label");lbl.textContent=labels[k];
        const input=document.createElement("input");input.value=r.fields[k]||"";input.type="text";
        input.setAttribute("aria-label",labels[k]+" do registro "+(index+1));
        input.addEventListener("input",()=>{
          r.fields[k]=input.value;r.edited=true;chip.textContent=r.duplicate?"Possível duplicidade":"Corrigido";unapprove();
        });
        lbl.appendChild(input);editor.appendChild(lbl);
      }
      d.appendChild(editor);
      const raw=document.createElement("details");raw.className="raw";
      const sum=document.createElement("summary");sum.textContent="Ver texto original";
      const txt=document.createElement("div");txt.textContent=r.raw;
      raw.append(sum,txt);d.appendChild(raw);fragment.appendChild(d);
    });
    $("reviewList").appendChild(fragment);
    if(state.records.length>showing.length){
      const w=document.createElement("p");w.className="warning-text";w.textContent="Exibindo 300 de "+state.records.length+" linhas. Para garantir revisão completa, exporte apenas depois de analisar o documento; a navegação paginada será adicionada em uma atualização."; $("reviewList").appendChild(w);
      $("approval").disabled=true;
    } else {$("approval").disabled=false;}
  }
  $("approval").addEventListener("change",e=>{
    state.approved=!!(e.target.checked&&state.records.length&&state.records.length<=300);
    $("csvBtn").disabled=!state.approved;$("jsonBtn").disabled=!state.approved;
  });
  $("clearBtn").addEventListener("click",()=>{
    if(!state.records.length&&!state.pending.length)return;
    if(!confirm("Apagar todos os registros e arquivos selecionados desta sessão?"))return;
    state.records=[];state.sources.clear();state.pending=[];unapprove();listFiles();render();page("capturar");
  });
  $("demoBtn").addEventListener("click",()=>{
    if(state.records.length&&!confirm("Adicionar registros fictícios aos registros atuais?"))return;
    const demo="03/10 Posto de combustível R$ 180,00\n05/10 Supermercado 245,90\n08/10 Assinatura 39,90\n12/10 Loja de eletrônicos 320,00";
    addRecords(makeRecords(demo,"EXEMPLO FICTÍCIO", "fatura"),"EXEMPLO FICTÍCIO");render();page("registros");
  });
  function download(filename,mime,text){
    const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type:mime}));
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function csvField(v){let t=String(v??"");if(/^[\s]*[=+@\-\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';}
  function exportData(kind){
    if(!state.approved||!state.records.length)return;
    if(kind==="json"){
      download("leitura-universal.json","application/json;charset=utf-8",
        JSON.stringify({exportadoEm:new Date().toISOString(),registros:state.records},null,2));return;
    }
    const keys=["tipo","arquivo","data","descricao","valor","parcelas","nome","hora","procedimento","texto","texto_original","possivel_duplicidade"];
    const lines=[keys.map(csvField).join(";")];
    for(const r of state.records){
      const obj={tipo:r.type,arquivo:r.source,...r.fields,texto_original:r.raw,possivel_duplicidade:r.duplicate?"SIM":"NAO"};
      lines.push(keys.map(k=>csvField(obj[k])).join(";"));
    }
    download("leitura-universal.csv","text/csv;charset=utf-8","\ufeff"+lines.join("\r\n"));
  }
  $("csvBtn").addEventListener("click",()=>exportData("csv"));
  $("jsonBtn").addEventListener("click",()=>exportData("json"));

  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");s.src=url;s.onload=resolve;
      s.onerror=()=>reject(new Error("Não foi possível carregar biblioteca OCR. Confira a internet."));document.head.append(s);
    });
  }
  async function worker(){
    if(state.worker)return state.worker;
    if(!window.Tesseract)await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js");
    state.worker=await window.Tesseract.createWorker("por+eng");
    return state.worker;
  }
  async function ocr(input){
    const w=await worker();const result=await w.recognize(input);
    return result.data.text||"";
  }
  let pdfLibraryPromise=null;
  async function pdfLibrary(){
    if(!pdfLibraryPromise)pdfLibraryPromise=import("https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.mjs")
      .then(lib=>{lib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.mjs";return lib;});
    return pdfLibraryPromise;
  }
  function pdfLines(items){
    const rows=new Map();
    for(const item of items){
      if(!item.str||!item.str.trim())continue;
      const y=Math.round((item.transform?.[5]||0)/3)*3;
      const arr=rows.get(y)||[];arr.push({x:item.transform?.[4]||0,txt:item.str});
      rows.set(y,arr);
    }
    return [...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,cells])=>cells.sort((a,b)=>a.x-b.x).map(x=>x.txt).join(" ")).join("\n");
  }
  async function parseFile(file,progressCallback){
    const name=file.name.toLowerCase();
    if(/\.(txt|csv)$/.test(name))return await file.text();
    if(/\.(png|jpe?g|webp|heic|heif)$/.test(name))return await ocr(file);
    if(name.endsWith(".pdf")){
      const lib=await pdfLibrary();
      const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer())});
      const doc=await task.promise;let out=[];
      if(doc.numPages>MAX_PAGES)throw new Error("PDF com "+doc.numPages+" páginas. Limite de "+MAX_PAGES+". Divida o documento; nenhuma página foi importada.");
      const pages=Math.min(doc.numPages,MAX_PAGES);
      try{
        for(let i=1;i<=pages;i++){
          const p=await doc.getPage(i);
          const txt=pdfLines((await p.getTextContent()).items);
          if(txt.replace(/\s/g,"").length>=25){out.push(txt);}
          else{
            const vp=p.getViewport({scale:1.4}),canvas=document.createElement("canvas");
            canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
            const ctx=canvas.getContext("2d");
            await p.render({canvasContext:ctx,viewport:vp}).promise;
            out.push(await ocr(canvas));
            canvas.width=0;canvas.height=0;
          }
          progressCallback(i,pages);
        }
      }finally{await task.destroy();}
      return out.join("\n");
    }
    throw new Error("Formato não suportado.");
  }
  $("processBtn").addEventListener("click",async()=>{
    if(state.busy||!state.pending.length)return;
    state.busy=true;$("processBtn").disabled=true;$("fileInput").disabled=true;$("progressWrap").hidden=false;
    const files=state.pending.splice(0);let done=0,success=0,errors=[];
    try{
      for(const file of files){
        const base=Math.round(done/files.length*100);
        $("progressText").textContent="Lendo "+file.name;
        $("progressBar").value=base;$("progressPct").textContent=base+"%";
        try{
          const text=await parseFile(file,(p,n)=>{
            const pct=Math.round((done+(p/n))/files.length*100);
            $("progressBar").value=pct;$("progressPct").textContent=pct+"%";
          });
          if(!text.trim())throw new Error("Nenhum texto reconhecido.");
          const rows=makeRecords(text,file.name,$("profile").value);
          if(!rows.length)throw new Error("Nenhum registro legível.");
          addRecords(rows,file.name);success++;
        }catch(err){errors.push(file.name+": "+(err.message||String(err)));}
        done++;
      }
      notice(success+" arquivo(s) processado(s)."+(errors.length?" Falhas: "+errors.join(" | "):""),!!errors.length);
      if(success)page("registros");
    }finally{
      state.busy=false;$("fileInput").disabled=false;$("progressWrap").hidden=true;listFiles();
      // status permanece visível após reset de seleção
      if(errors.length)notice(success+" arquivo(s) lidos. "+errors.join(" | "),true);
      else notice(success+" arquivo(s) processado(s).");
    }
  });

  // Integração local com a captura autorizada do navegador. Nenhuma imagem é enviada ao servidor.
  let lastScreenText="";
  window.LeitorCaptureAdapter={
    async consumeFrame(canvas){
      const text=(await ocr(canvas)).trim();
      if(!text)return {added:0,reason:"Nenhum texto detectado neste quadro."};
      const normalized=text.replace(/\s+/g," ").toLocaleLowerCase("pt-BR");
      if(normalized===lastScreenText)return {added:0,reason:"Tela repetida; nada duplicado."};
      const records=makeRecords(text,"Captura da tela", $("profile").value);
      if(!records.length)return {added:0,reason:"Nenhuma linha legível."};
      // Evita linhas repetidas entre quadros, mesmo que o texto da tela mude parcialmente.
      const existing=new Set(state.records.map(r=>r.raw.toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim()));
      const novel=records.filter(r=>!existing.has(r.raw.toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim()));
      if(!novel.length){lastScreenText=normalized;return {added:0,reason:"Todos os registros deste quadro já foram lidos."};}
      addRecords(novel,"Captura da tela");lastScreenText=normalized;
      return {added:novel.length,reason:novel.length+" linha(s) adicionada(s)."};
    },
    openReview(){page("registros");}
  };
  window.addEventListener("beforeunload",()=>{if(state.worker)state.worker.terminate().catch(()=>{});});
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  render();
})();