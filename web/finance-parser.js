/* Leitor Inteligente Universal: parser local de extratos e faturas.
 * Não envia informações para nenhum servidor. Dados incertos continuam identificados.
 */
(() => {
  "use strict";
  const categories = ["Combustível","Mercados e mercearias","Farmácias e saúde","Restaurantes e delivery","Veículo e documentação","Seguros e proteção","Compras e lojas","Assinaturas e digital","Pessoas / prestadores","Cuidados pessoais","Família","Telefonia","Casa e utilidades","Lazer","Não identificado"];
  const rules = [
    ["Combustível",/\b(?:posto|combust|shell|ipiranga|petrobras|princesa d.?oeste|santa odila)\b/i],
    ["Farmácias e saúde",/\b(?:droga(?:sil|ria|l)|farmac|raia|bio mundo|optica|ótica|saude)\b/i],
    ["Mercados e mercearias",/\b(?:supermerc|carrefour|roldao|roldão|dalben|zarelli|mercearia|mercado (?!livre)|mix vali)\b/i],
    ["Restaurantes e delivery",/\b(?:ifood|i.?food|pastel|gr[aá]vetos|burger|padaria|panificadora|pizzaria|esfiha|marmita|churrasc|sabor da fazenda|assados|tasty|vit[oó]ria.?r[eé]gia|k.?fil[aã]o)\b/i],
    ["Veículo e documentação",/\b(?:mecanica|mecânica|licenciamento|baterias|auto pe[cç]as|pneu|oficina)\b/i],
    ["Seguros e proteção",/\b(?:loovi|segurador|seguro|prote[cç][aã]o veicular)\b/i],
    ["Compras e lojas",/\b(?:mercado livre|mercadolivre|dafiti|shopping do br[aá]s|magalu|amazon|shopee|renner)\b/i],
    ["Telefonia",/\b(?:claro|vivo|tim brasil|oi movel)\b/i],
    ["Assinaturas e digital",/\b(?:netflix|apple|google|drive|paypal|desktop.?sa|ticpay|spotify|youtube|icloud)\b/i],
    ["Cuidados pessoais",/\b(?:sal[aã]o|barbearia|cabeleireir|est[eé]tica)\b/i],
    ["Família",/\b(?:fraldas|beb[eê]|infantil)\b/i],
    ["Casa e utilidades",/\b(?:sarafix|milcoisas|material constru[cç])\b/i],
    ["Lazer",/\b(?:cinemark|cinema|ingresso)\b/i]
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
    for(const [label,re] of rules)if(re.test(name))return label;
    return "Não identificado";
  }
  function cleanStore(raw) {
    return String(raw||"")
      .replace(/^[\s*•+«»"'—–›<>~|\\]+/g,"")
      .replace(/[\s*•+«»"'—–›<>~|\\-]+$/g,"")
      .replace(/\s+/g," ").trim();
  }
  function merchantHeader(line) {
    // Nomes no início de uma linha; data de compra pode vir na linha seguinte.
    const m=line.match(/^\s*[«»*'+—–\s]*(.+?)\s*(?:[-+«»]\s*)?(?:compra|conpra|c[o0]mpra|cor\.)\s*(.*)$/i);
    if(!m)return null;
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
    const m=line.replace(/\s+/g," ").match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:R\s*[$S]\s*)?(-?[\d.,]+)$/i);
    if(!m || number(m[3])===null || !/\d[,.]\d{2}$/.test(m[3]))return null;
    let name=m[2],installment="";
    const p=name.match(/\s+(\d{1,2}\/\d{1,2})$/);
    if(p){installment=p[1];name=name.slice(0,p.index);}
    return {date:m[1],name,amount:m[3],installment,raw:line};
  }
  function purchaseKey(t) {
    if(!t.date||!t.name||!t.amount)return "";
    const val=number(t.amount);
    return [t.date,norm(t.name),val===null?"":val.toFixed(2),t.installment||""].join("|");
  }
  function parse(text) {
    const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const transactions=[], residual=[], exact=new Set();
    let pending=null;
    const isOverlay=s=>/^(?:[0-9: |©=]{1,20}|digite aqui|resposta gerada|lista completa|esses s[aã]o|somando|quer que eu|vencimento [eé]|compra [eé])/i.test(s);
    function finish(name,date,amount,original,conf,installment="",due="") {
      const n=number(amount);
      if(n===null || !Number.isFinite(n) || Math.abs(n)>10000000){residual.push(original);return;}
      const t={name:name||"Estabelecimento não identificado",date:date||"",amount:amount,
        installment, due, raw:original,confidence:conf||((name&&date)?"Alta":"Baixa")};
      t.category=category(t.name);
      t.key=purchaseKey(t);
      if(t.key&&exact.has(t.key))return;
      if(t.key)exact.add(t.key);
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
        // Às vezes preço e vencimento estão no mesmo bloco.
        if(/(?:venc|R\s*[$S])/.test(line.toLowerCase())&&money(line)){
          const amount=money(line);
          finish(header.name,header.date,amount,line,header.date?"Alta":"Média","",dueDate(line));
          pending=null;
        }
        continue;
      }
      const amount=money(line);
      const purchaseDate=(pending?.date||((dateOnly(line)||/\bcompra\b/i.test(line))?line.match(dateRE)?.[1]:""))||"";
      const hasTransactionContext=Boolean(pending)||Boolean(/(?:venc|R\s*[$S])/.test(line) && dateOnly(line));
      const isDue=/\b(?:venc\.?|vencimento)\b/i.test(line);
      const isDateVenc=/^\d{1,2}\/\d{1,2}\/\d{4}:\s*(?:R\s*[$S]\s*)?[\d.,]+/.test(line);
      if(amount && (hasTransactionContext || (pending && isDateVenc))){
        // Não associar automaticamente lançamentos sem nome ao estabelecimento anterior,
        // salvo quando há um cabeçalho ainda pendente e próximo.
        const name=pending?.name||"";
        const fullRaw=pending?pending.raw+"\n"+line:line;
        let due=dueDate(line);
        if(!due && isDateVenc)due=line.match(dateRE)?.[1]||"";
        finish(name,purchaseDate,amount,fullRaw,name&&purchaseDate?"Alta":"Baixa","",due);
        pending=null;continue;
      }
      if(pending && !pending.date && dateOnly(line)){
        pending.date=line.match(dateRE)?.[1]||"";
        pending.raw+="\n"+line;
        continue;
      }
      // Não ligar cabeçalhos distantes a valores de outra compra.
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