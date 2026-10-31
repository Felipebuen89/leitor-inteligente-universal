/* Leitor Inteligente Universal: parser local de extratos e faturas.
 * Não envia informações para nenhum servidor. Dados incertos continuam identificados.
 */
(() => {
  "use strict";
  const categories = ["Combustível","Mercados e mercearias","Farmácias e saúde","Restaurantes e delivery","Veículo e documentação","Seguros e proteção","Compras e lojas","Assinaturas e digital","Pessoas / prestadores","Cuidados pessoais","Família","Telefonia","Casa e utilidades","Lazer","Não identificado"];
  // Comparar sobre nomes sem acentos e sem pontuação: OCR pode juntar palavras.
  const rules = [
    ["Combustível",/(?:\bposto\b|\bautoposto|\bapprinc|\bap\s*princ|\bprincesad\b|\bprincesa\s*d\s*oeste|\bsantaodila\b|\bsanta\s*odila\b|\bcombust|\bshell\b|\bipiranga\b|\bpetrobras\b)/i],
    ["Farmácias e saúde",/(?:\bdroga|\braiadrogasil\b|\bdrogasil|\bfarmaci|\bfarmac|\bbio\s*mundo\b|\boptic|\bsaude\b|\bvale\s*da\s*saude\b|\bvaledasaude\b)/i],
    ["Mercados e mercearias",/(?:\bsupermerc|\bcarrefour\b|\broldao\b|\bdalben\b|\bzarelli\b|\bmercearia\b|\bmercado\b(?!\s*livre)|\bmix\s*vali\b)/i],
    ["Restaurantes e delivery",/(?:\bi\s*food\b|\bifood\b|\bpastel|\bpasteis\b|\bgravetos\b|\bburger\b|\bburguer\b|\bpadaria\b|\bpanificadora\b|\bpizzaria\b|\besfiha\b|\bmarmit|\bchurrasc|\bsabor\s*da\s*fazend|\bsabordafazend|\bassados\b|\btasty|\bvitoria\s*regia\b|\bk\s*filao\b)/i],
    ["Veículo e documentação",/(?:\bmecanica\b|\blicenciamento\b|\bbaterias\b|\bauto\s*pecas\b|\bpneu\b|\boficina\b)/i],
    ["Seguros e proteção",/(?:\bloovi\b|\bsegurador|\bseguro\b|\bprotecao\s*veicular\b)/i],
    ["Compras e lojas",/(?:\bmercado\s*livre\b|\bmercadolivre\b|\bdafiti\b|\bshopping\s*do\s*bras\b|\bmagalu\b|\bamazon\b|\bshopee\b|\brenner\b)/i],
    ["Telefonia",/(?:\bclaro\b|\bclaroflex\b|\bvivo\b|\btim\s*brasil\b|\boi\s*movel\b)/i],
    ["Assinaturas e digital",/(?:\bnetflix\b|\bapple\b|\bgoogle\b|\bdrive\b|\bpaypal\b|\bdesktop\s*sa\b|\bdesktopsa\b|\bticpay\b|\bspotify\b|\byoutube\b|\bicloud\b)/i],
    ["Cuidados pessoais",/(?:\bsalao\b|\bbarbearia\b|\bcabeleireir|\bestetica\b)/i],
    ["Família",/(?:\bfraldas\b|\bbebe\b|\binfantil\b)/i],
    ["Casa e utilidades",/(?:\bsarafix\b|\bmilcoisas\b|\bmaterial\s*construc)/i],
    ["Lazer",/(?:\bcinemark\b|\bcinema\b|\bingresso\b)/i]
  ];
  const norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
  const dateRE = /\b(\d{1,2}\/\d{1,2}\/(?:20)?\d{2})\b/;
  const valueRE = /(?:R\s*[$S]\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2})(?!\d)/gi;
  const dateOnly = s => /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:\||$)/.test(s);
  function number(s) {
    if(!s)return null;
    let v=String(s).replace(/\s/g,"");
    if(v.includes(","))v=v.replace(/\./g,"").replace(",",".");
    const n=Number(v);return Number.isFinite(n)?n:null;
  }
  function money(line) {
    const s=String(line||""); let m, last=null;
    valueRE.lastIndex=0;
    while((m=valueRE.exec(s)))last=m[1];
    // Textos de somatórios e notificações não são lançamentos.
    return last;
  }
  function category(name) {
    const n=norm(name);
    if(!n || n==="estabelecimento nao identificado")return "Não identificado";
    for(const [label,re] of rules)if(re.test(n))return label;
    return "Não identificado";
  }
  function cleanStore(raw) {
    return String(raw||"").replace(/[“”]/g,"")
      .replace(/^[\s*•+«»"'—–›<>~|\\]+/g,"")
      .replace(/[\s*•+«»"'—–›<>~|\\-]+$/g,"")
      .replace(/\s+/g," ").trim();
  }
  function merchantHeader(line) {
    // Nomes no início de uma linha; data de compra pode vir na linha seguinte.
    const m=line.match(/^\s*[«»*'+—–\s]*(.+?)\s*(?:[-+«»]\s*)?(?:compra|conpra|c[o0]mpra|cor\.|[~]ompra|com™nra|camnra)\s*(.*)$/i);
    if(!m){
      // Recuperar título sem a palavra Compra somente quando o nome tem categoria conhecida.
      const alt=line.match(/^\s*[«»*'+—–\s]*(.{4,48}?)\s*[:«“].{0,8}?(\d{1,2}\/\d{1,2}\/\d{4})\s*\|?$/i);
      if(alt && category(alt[1])!=="Não identificado")
        return {name:cleanStore(alt[1]),date:alt[2],raw:line};
      return null;
    }
    const rawName=cleanStore(m[1]);
    const name=rawName.length>2&&!/^(venc|data|compra|fatura|lista|dia|nome)$/i.test(rawName)
      ? rawName : "";
    if(!name)return null;
    const date=m[2].match(dateRE)?.[1]||"";
    return {name,date,raw:line};
  }
  function dueDate(line) {
    const m=line.match(/\b(?:venc\.?|vencimento)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    return m?m[1]:"";
  }
  function traditional(line) {
    if(/^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*\|/.test(line))return null;
    const m=line.replace(/\s+/g," ").match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:R\s*[$S]\s*)?(-?[\d.,]+)$/i);
    if(!m || /\b(?:venc\.?|vencimento)\b/i.test(line) || number(m[3])===null || !/\d[,.]\d{2}$/.test(m[3]))return null;
    let name=m[2],installment="";
    if(/^(?:[|:;]|ver\b|ve\b)/i.test(name.trim()) || /\b(?:venc|vencimento|hoje)\b/i.test(name))return null;
    const p=name.match(/\s+(\d{1,2}\/\d{1,2})$/);
    if(p){installment=p[1];name=name.slice(0,p.index);}
    return {date:m[1],name,amount:m[3],installment,raw:line};
  }
  function purchaseKey(t) {
    if(!t.date||!t.name||!t.amount)return "";
    const val=number(t.amount);
    return [t.date,norm(t.name),val===null?"":val.toFixed(2),t.installment||""].join("|");
  }
  function isValidFullDate(s) {
    if(!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s||""))return false;
    const [d,m,y]=s.split("/").map(Number);
    if(y<2000||y>2100||m<1||m>12||d<1)return false;
    return d <= new Date(y,m,0).getDate();
  }
  function parse(text) {
    const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const transactions=[], residual=[], exact=new Map();
    let pending=null;
    const isOverlay=s=>/^(?:[0-9: |©=]{1,20}|digite aqui|resposta gerada|lista completa|esses s[aã]o|somando|quer que eu|vencimento [eé]|compra [eé])/i.test(s);
    function finish(name,date,amount,original,conf,installment="",due="") {
      const n=number(amount);
      if(n===null || !Number.isFinite(n) || Math.abs(n)>10000000){residual.push(original);return;}
      const clean=cleanStore(name||"");
      if(!isValidFullDate(due))due="";
      // Confiança alta não equivale a transação bancária confirmada.
      const damaged=/(?:\bver\b|\bve\s|venc\.?\s+\d{1,2}\/\d{1,2}\/\d{2}(?!\d)|\bhoje\b|[™])/i.test(original) ||
        (/\bvenc/i.test(original)&&!due);
      const confidence=(!clean||!isValidFullDate(date))?"Baixa":
        (damaged||!due||/^[|:;]|^estabelecimento/i.test(clean))?"Média":conf||"Alta";
      const t={name:clean||"Estabelecimento não identificado",date:date||"",amount:n.toFixed(2).replace(".",","),
        installment,due,raw:original,confidence};
      t.category=category(t.name);
      t.key=purchaseKey(t);
      // Remover quadros idênticos da gravação; preservar a fonte para conferência.
      if(t.key&&exact.has(t.key)){
        const idx=exact.get(t.key),old=transactions[idx];
        const quality=x=>({Alta:3,"Média":2,Baixa:1}[x.confidence]||0)+(x.due?0.5:0);
        // Em leituras repetidas, preservar o quadro mais completo e legível.
        if(quality(t)>quality(old))transactions[idx]=t;
        return;
      }
      if(t.key)exact.set(t.key,transactions.length);
      transactions.push(t);
    }
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      const full=traditional(line);
      if(full){
        if(pending){residual.push(pending.raw);pending=null;}
        finish(full.name,full.date,full.amount,full.raw,"Alta",full.installment);continue;
      }
      const header=merchantHeader(line);
      if(header){
        if(pending)residual.push(pending.raw);
        pending=header;
        if(/(?:venc|R\s*[$S])/i.test(line)&&money(line)){
          finish(header.name,header.date,money(line),line,"Alta","",dueDate(line));pending=null;
        }
        continue;
      }
      const amount=money(line);
      const purchaseDate=(pending?.date||((dateOnly(line)||/\bcompra\b/i.test(line))?line.match(dateRE)?.[1]:""))||"";
      const hasTransactionContext=Boolean(pending)||Boolean(/(?:venc|R\s*[$S])/.test(line)&&dateOnly(line));
      const isDateVenc=/^\d{1,2}\/\d{1,2}\/\d{4}:\s*(?:R\s*[$S]\s*)?[\d.,]+/.test(line);
      if(amount && (hasTransactionContext || (pending && isDateVenc))){
        const name=pending?.name||"";
        const fullRaw=pending?pending.raw+"\n"+line:line;
        let due=dueDate(line);
        if(!due && isDateVenc)due=line.match(dateRE)?.[1]||"";
        finish(name,purchaseDate,amount,fullRaw,name&&purchaseDate?"Alta":"Baixa","",due);
        pending=null;continue;
      }
      if(pending && !pending.date && dateOnly(line)){
        pending.date=line.match(dateRE)?.[1]||"";
        pending.raw+="\n"+line;continue;
      }
      if(pending && (i>=lines.length-1 || (line.length>36 && !isOverlay(line) && !/^(?:\||venc)/i.test(line)))){
        residual.push(pending.raw);pending=null;
      }
      if(!isOverlay(line)&&line.length>3)residual.push(line);
    }
    if(pending)residual.push(pending.raw);
    return {transactions,residual};
  }
  window.LeitorFinance={parse,number,category,categories,purchaseKey};
})();