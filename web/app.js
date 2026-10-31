/* Leitor Inteligente Universal PWA — protótipo browser-only.
   Arquivos permanecem na memória da aba; nenhuma API própria recebe documentos. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const MAX_FILES = 10, MAX_SIZE = 15*1024*1024, MAX_PAGES = 15, MAX_ROWS = 1200;
  const state = {pending:[],records:[],sources:new Set(),busy:false,approved:false,worker:null};
  const labels = {data:"Data da compra",descricao:"Estabelecimento",valor:"Valor (R$)",parcelas:"Parcelas",categoria:"Categoria",vencimento:"Vencimento",nome:"Nome",hora:"Horário",procedimento:"Procedimento",texto:"Texto extraído"};
  const fields = {fatura:["data","descricao","valor","parcelas","categoria","vencimento"],agenda:["nome","data","hora","procedimento"],geral:["texto"]};

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
    if(lines.length>MAX_ROWS)throw new Error("Limite de "+MAX_ROWS+" linhas excedido.");
    const finance=window.LeitorFinance;
    const parsed=finance?.parse(text);
    const mode=profile==="auto"&&parsed?.transactions.length?"fatura":classify(lines,profile);
    const out=[];
    if(mode==="fatura"&&finance){
      for(const t of parsed.transactions){
        const f={data:t.date,descricao:t.name,valor:t.amount,parcelas:t.installment,
          categoria:t.category,vencimento:t.due,confianca:t.confidence};
        out.push({id:crypto.randomUUID(),type:"fatura",fields:f,raw:t.raw,source,
          duplicate:false,edited:false,confidence:t.confidence});
      }
      for(const raw of parsed.residual){
        if(raw.length<4)continue;
        out.push({id:crypto.randomUUID(),type:"geral",fields:{texto:raw},raw,source,
          duplicate:false,edited:false});
      }
      return out;
    }
    for(const raw of lines){
      const f=mode==="fatura"?parseFatura(raw):mode==="agenda"?parseAgenda(raw):null;
      const kind=f?mode:"geral";
      out.push({id:crypto.randomUUID(),type:kind,
        fields:kind==="fatura"?{...f,categoria:finance?.category(f.descricao)||"Não identificado",vencimento:""}:f||{texto:raw},
        raw,source,duplicate:false,edited:false});
    }
    return out;
  }
  function updateDuplicates(){
    const finance=window.LeitorFinance;
    const namedByDateValue=new Map(),seen=new Set();
    const financial=state.records.filter(r=>r.type==="fatura");
    const hasStore=r=>r.fields.descricao&&r.fields.descricao!=="Estabelecimento não identificado"&&
      !/^(?:\||ver\b|ve\b)/i.test(r.fields.descricao);
    const amountKey=r=>{
      const v=finance?.number(r.fields.valor);
      return r.fields.data&&v!==null&&v!==undefined?
        r.fields.data+"|"+v.toFixed(2):"";
    };
    // Segunda passada: associa fragmentos sem loja a lançamentos completos.
    for(const r of financial){
      if(!hasStore(r))continue;
      const k=amountKey(r);if(!k)continue;
      namedByDateValue.set(k,(namedByDateValue.get(k)||0)+1);
    }
    for(const r of state.records){
      r.duplicate=false;r.possibleRepeat=false;r.possibleValueConflict=false;
      if(r.type!=="fatura"){
        const k="texto|"+r.raw.toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
        r.duplicate=seen.has(k);seen.add(k);continue;
      }
      const f=r.fields,full=hasStore(r),k=amountKey(r);
      const tx=full&&f.data&&f.valor?
        finance?.purchaseKey({date:f.data,name:f.descricao,amount:f.valor,installment:f.parcelas}):"";
      if(tx){
        const key="fatura|"+tx;r.duplicate=seen.has(key);seen.add(key);
      }else if(k&&namedByDateValue.has(k)){
        r.duplicate=true;r.possibleRepeat=true;
      }
    }
    // Valores próximos com loja/data similares podem ser leituras conflitantes
    // do mesmo registro; apenas alertar, nunca apagar nem somar como certeza.
    const grouped=new Map();
    for(const r of financial){
      if(!hasStore(r)||!r.fields.data)continue;
      const name=String(r.fields.descricao).toLowerCase().replace(/[^a-z0-9 ]/g,"").trim().replace(/\s+/g,"");
      const prefix=name.startsWith("loovi")?"loovi":
        (name.startsWith("apprin")?"apprin":name);
      const key=r.fields.data+"|"+prefix;
      const group=grouped.get(key)||[];group.push(r);grouped.set(key,group);
    }
    for(const group of grouped.values()){
      if(group.length<2)continue;
      for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
        const a=finance?.number(group[i].fields.valor),b=finance?.number(group[j].fields.valor);
        if(a===null||b===null||!a||!b||a===b)continue;
        if(Math.abs(a-b)/Math.max(Math.abs(a),Math.abs(b))<=0.05){
          group[i].possibleValueConflict=true;group[j].possibleValueConflict=true;
        }
      }
    }
  }
  function needsFinanceReview(r){
    return r.type==="fatura" && (r.duplicate || r.possibleValueConflict ||
      r.confidence!=="Alta" || !r.fields.data || r.fields.categoria==="Não identificado");
  }
  function reviewReason(r){
    const reasons=[];
    if(r.duplicate)reasons.push(r.possibleRepeat?"Possível linha repetida no OCR":"Possível duplicidade");
    if(r.possibleValueConflict)reasons.push("Valores divergentes para uma possível mesma compra");
    if(r.fields.categoria==="Não identificado")reasons.push("Categoria pendente");
    if(!r.fields.data)reasons.push("Data ausente");
    if(r.confidence!=="Alta")reasons.push("Leitura incerta");
    return [...new Set(reasons)].join(" | ");
  }
  function moneyDisplay(value){
    return (Number(value)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  }
  function renderFinanceSummary(){
    const container=$("financeSummary"),categories=$("financeCategories"),hint=$("financeHint");
    if(!container||!categories||!hint)return;
    const entries=state.records.filter(r=>r.type==="fatura");
    container.hidden=!entries.length;
    if(!entries.length)return;
    let sum=0,review=0,possibleDuplicates=0;
    const groups=new Map(),finance=window.LeitorFinance;
    for(const r of entries){
      const v=finance?.number(r.fields.valor);
      if(v===null||v===undefined)continue;
      if(r.duplicate){possibleDuplicates+=v;continue;}
      sum+=v;
      const category=r.fields.categoria||"Não identificado";
      groups.set(category,(groups.get(category)||0)+v);
      if(category==="Não identificado"||!r.fields.data||r.confidence!=="Alta"||r.possibleValueConflict)review+=v;
    }
    $("financeTotal").textContent=moneyDisplay(sum);
    $("financeCount").textContent=String(entries.length);
    $("financeUnresolved").textContent=moneyDisplay(review);
    if($("financeWithoutFlags"))$("financeWithoutFlags").textContent=moneyDisplay(Math.max(0,sum-review));
    categories.replaceChildren();
    for(const [cat,v] of [...groups].sort((a,b)=>b[1]-a[1])){
      const div=document.createElement("div");div.className="finance-cat";
      const label=document.createElement("span");label.textContent=cat==="Não identificado"?"Categoria pendente":cat;
      const price=document.createElement("strong");price.textContent=moneyDisplay(v);
      div.append(label,price);categories.appendChild(div);
    }
    hint.textContent="Valores para conferir incluem categorias pendentes, OCR incerto e divergências, sem somar duas vezes. "+
      "Subtotal sem alerta não é fatura confirmada pelo banco. "+
      (possibleDuplicates?"Possíveis repetições fora da estimativa: "+moneyDisplay(possibleDuplicates)+". ":"")+
      "Revise os itens marcados antes de aprovar.";
  }
  function unapprove(){state.approved=false;$("approval").checked=false;$("csvBtn").disabled=true;$("jsonBtn").disabled=true;const b=$("expensesCsvBtn");if(b)b.disabled=true;}
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
    $("flagsStat").textContent=state.records.filter(r=>r.duplicate || needsFinanceReview(r)).length;
    if($("pendingCsvBtn"))$("pendingCsvBtn").disabled=!state.records.some(needsFinanceReview);
    if($("pendingFilterCount"))$("pendingFilterCount").textContent=state.records.filter(needsFinanceReview).length;
    $("csvBtn").disabled=!(state.approved&&state.records.length);
    $("jsonBtn").disabled=!(state.approved&&state.records.length);
    if($("expensesCsvBtn"))$("expensesCsvBtn").disabled=!(state.approved&&state.records.some(r=>r.type==="fatura"));
    $("reviewList").replaceChildren();
    renderFinanceSummary();
    if(!state.records.length){
      const d=document.createElement("div");d.className="empty";d.textContent="Nenhuma leitura nesta sessão. Importe arquivos ou carregue um exemplo fictício.";$("reviewList").appendChild(d);return;
    }
    const fragment=document.createDocumentFragment();
    const hasFin=state.records.some(r=>r.type==="fatura");
    const showing=state.records.map((r,i)=>({r,i})).filter(({r})=>
      (!hasFin||!$("onlyExpensesCheck")?.checked||r.type==="fatura")&&
      (!$("onlyPendingCheck")?.checked || needsFinanceReview(r))).slice(0,300);
    showing.forEach(({r,i})=>{
      const d=document.createElement("article");d.className="record";
      const head=document.createElement("div");head.className="record-top";
      const left=document.createElement("div");const name=document.createElement("strong");
      name.textContent=(i+1)+" · "+({fatura:"Gasto",agenda:"Agendamento",geral:"Texto"}[r.type]);
      const meta=document.createElement("small");meta.textContent=r.source+(r.type==="fatura"?" · confiança: "+(r.confidence||"Pendente"):"");left.append(name,meta);
      const chip=document.createElement("span");chip.className="badge"+(r.duplicate || (r.type==="fatura"&&(r.confidence!=="Alta"||r.fields.categoria==="Não identificado"||r.possibleValueConflict))?" warn":"");
      chip.textContent=r.duplicate?(r.possibleRepeat?"Possível repetição OCR":"Possível duplicidade"):r.possibleValueConflict?"Conferir valores":r.edited?"Corrigido":(r.type==="fatura"&&(r.confidence!=="Alta"||r.fields.categoria==="Não identificado"))?"Conferir dados":"Extraído";
      head.append(left,chip);d.appendChild(head);
      const editor=document.createElement("div");editor.className="row-editor";
      for(const k of fields[r.type]){
        const lbl=document.createElement("label");lbl.textContent=labels[k];
        const input=document.createElement(k==="categoria"?"select":"input");
        if(k==="categoria"){
          const opts=window.LeitorFinance?.categories||["Não identificado"];
          for(const c of opts){
            const option=document.createElement("option");option.value=c;option.textContent=c;input.appendChild(option);
          }
          input.value=r.fields[k]||"Não identificado";
        }else{input.value=r.fields[k]||"";input.type="text";}
        input.setAttribute("aria-label",labels[k]+" do registro "+(i+1));
        input.addEventListener(k==="categoria"?"change":"input",()=>{
          r.fields[k]=input.value;r.edited=true;
          if(k==="descricao"&&r.type==="fatura"&&r.fields.categoria==="Não identificado"){
            r.fields.categoria=window.LeitorFinance?.category(input.value)||"Não identificado";
          }
          updateDuplicates();
          chip.textContent=r.duplicate?(r.possibleRepeat?"Possível repetição OCR":"Possível duplicidade"):r.possibleValueConflict?"Conferir valores":"Corrigido";
          unapprove();renderFinanceSummary();
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
    if($("onlyPendingCheck")?.checked && !showing.length){
      const message=document.createElement("p");
      message.className="notice";message.textContent="Nenhuma compra com pendência automática nesta sessão.";
      $("reviewList").appendChild(message);
    }
    if(state.records.length>300){
      const w=document.createElement("p");w.className="warning-text";w.textContent="Há mais de 300 registros nesta sessão. Divida os arquivos para revisar e exportar sem omissões."; $("reviewList").appendChild(w);
      $("approval").disabled=true;
    } else {$("approval").disabled=false;}
    if($("onlyExpensesCheck")?.checked&&hasFin){
      const muted=state.records.length-state.records.filter(r=>r.type==="fatura").length;
      if(muted){const note=document.createElement("p");note.className="tiny";note.textContent=muted+" linhas de OCR não financeiro ocultas. Desmarque o filtro para conferir o texto original."; $("reviewList").appendChild(note);}
    }
  }
  $("approval").addEventListener("change",e=>{
    state.approved=!!(e.target.checked&&state.records.length&&state.records.length<=300);
    $("csvBtn").disabled=!state.approved;$("jsonBtn").disabled=!state.approved;
    if($("expensesCsvBtn"))$("expensesCsvBtn").disabled=!(state.approved&&state.records.some(r=>r.type==="fatura"));
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
    const keys=["tipo","arquivo","data","descricao","valor","parcelas","categoria","vencimento","confianca","nome","hora","procedimento","texto","texto_original","possivel_duplicidade","conferir_valor"];
    const lines=[keys.map(csvField).join(";")];
    for(const r of state.records){
      if(kind==="gastos"&&r.type!=="fatura")continue;
      const obj={tipo:r.type,arquivo:r.source,...r.fields,confianca:r.confidence||r.fields.confianca||"",
        texto_original:r.raw,possivel_duplicidade:r.duplicate?"SIM":"NAO",conferir_valor:r.possibleValueConflict?"SIM":"NAO"};
      lines.push(keys.map(k=>csvField(obj[k])).join(";"));
    }
    download(kind==="gastos"?"gastos-organizados.csv":"leitura-universal.csv","text/csv;charset=utf-8","\ufeff"+lines.join("\r\n"));
  }
  // Arquivo de auditoria não implica aprovação nem confirmação da fatura.
  function exportPending(){
    const pending=state.records.filter(needsFinanceReview);
    if(!pending.length)return;
    const fields=["data","descricao","valor","categoria","vencimento","confianca","motivo_revisao","possivel_duplicidade","texto_original"];
    const lines=[fields.map(csvField).join(";")];
    for(const r of pending){
      const row={...r.fields,confianca:r.confidence||"",motivo_revisao:reviewReason(r),
        possivel_duplicidade:r.duplicate?"SIM":"NAO",texto_original:r.raw};
      lines.push(fields.map(k=>csvField(row[k])).join(";"));
    }
    download("pendencias-do-leitor.csv","text/csv;charset=utf-8","\ufeff"+lines.join("\r\n"));
  }
  if($("pendingCsvBtn"))$("pendingCsvBtn").addEventListener("click",exportPending);
  if($("onlyPendingCheck"))$("onlyPendingCheck").addEventListener("change",render);
  $("csvBtn").addEventListener("click",()=>exportData("csv"));
  $("jsonBtn").addEventListener("click",()=>exportData("json"));
  if($("expensesCsvBtn"))$("expensesCsvBtn").addEventListener("click",()=>exportData("gastos"));
  if($("onlyExpensesCheck"))$("onlyExpensesCheck").addEventListener("change",render);

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

  // Os quadros de uma gravação são reunidos antes da organização:
  // "Estabelecimento - Compra" e "Venc.: R$" podem estar em quadros diferentes.
  const scannedSources=new Map();
  function ingestRecognizedText(text,source,stillActive=()=>true){
    if(!stillActive())return {added:0,reason:"Leitura interrompida."};
    const lines=String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const cache=scannedSources.get(source)||{lines:[],seen:new Set()};
    let added=0;
    for(const line of lines){
      const normalized=line.toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
      if(!normalized||cache.seen.has(normalized))continue;
      cache.seen.add(normalized);cache.lines.push(line);added++;
    }
    if(!added)return {added:0,reason:"Quadro repetido; nenhum texto novo."};
    const rebuilt=makeRecords(cache.lines.join("\n"),source,$("profile").value);
    if(!stillActive())return {added:0,reason:"Leitura interrompida."};
    const remaining=state.records.filter(r=>r.source!==source);
    if(remaining.length+rebuilt.length>MAX_ROWS)throw new Error("Limite de registros excedido. Exporte e inicie outra sessão.");
    scannedSources.set(source,cache);
    state.records=[...remaining,...rebuilt];state.sources.add(source);
    updateDuplicates();unapprove();render();
    return {added,reason:added+" linha(s) novas; transações associadas por data e valor."};
  }
  window.LeitorCaptureAdapter={
    async consumeFrame(canvas,isStillActive=()=>true){
      const text=(await ocr(canvas)).trim();
      return text?ingestRecognizedText(text,"Captura da tela",isStillActive):
        {added:0,reason:"Nenhum texto detectado neste quadro."};
    },
    openReview(){page("registros");}
  };
  window.LeitorVideoAdapter={
    async consumeFrame(canvas,source,stillActive=()=>true){
      const text=(await ocr(canvas)).trim();
      return text?ingestRecognizedText(text,source,stillActive):
        {added:0,reason:"Nenhum texto visível."};
    },
    openReview(){page("registros");}
  };
  // Reprocessa exportações anteriores para que o usuário não precise gravar de novo.
  function csvRows(text){
    const rows=[];let row=[],part="",quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i],next=text[i+1];
      if(c==='"'){
        if(quoted&&next==='"'){part+='"';i++;}else quoted=!quoted;
      }else if(c===";"&&!quoted){row.push(part);part="";}
      else if((c==="\n"||c==="\r")&&!quoted){
        if(c==="\r"&&next==="\n")i++;
        row.push(part);if(row.some(Boolean))rows.push(row);row=[];part="";
      }else part+=c;
    }
    row.push(part);if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function oldCsvToText(text){
    const rows=csvRows(text.replace(/^\uFEFF/,""));
    const header=rows[0]?.map(x=>x.replace(/^\uFEFF/,"").trim().toLowerCase())||[];
    const rawIndex=header.indexOf("texto_original");
    const genericIndex=header.indexOf("texto");
    if(rawIndex<0)return text;
    return rows.slice(1).map(row=>row[rawIndex]||row[genericIndex]||"").filter(Boolean).join("\n");
  }
  const reprocess=$("reprocessFile");
  if(reprocess)reprocess.addEventListener("change",async e=>{
    const file=e.target.files?.[0];e.target.value="";if(!file)return;
    try{
      if(file.size>MAX_SIZE)throw new Error("CSV muito grande (máximo 15 MB).");
      const source="CSV revisado: "+file.name;
      const text=oldCsvToText(await file.text());
      const rows=makeRecords(text,source,"fatura");
      const other=state.records.filter(r=>r.source!==source);
      if(rows.length+other.length>MAX_ROWS)throw new Error("Limite de linhas excedido.");
      state.records=[...other,...rows];state.sources.add(source);updateDuplicates();unapprove();render();
      notice(rows.filter(x=>x.type==="fatura").length+" compras reconstruídas do CSV. Confira os alertas.");
      page("registros");
    }catch(err){notice("Falha ao reprocessar CSV: "+(err.message||String(err)),true);}
  });
  $("clearBtn").addEventListener("click",()=>scannedSources.clear());

  window.addEventListener("beforeunload",()=>{if(state.worker)state.worker.terminate().catch(()=>{});});
  if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  render();
})();