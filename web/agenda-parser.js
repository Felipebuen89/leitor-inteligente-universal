/* Interpretação local de agendas extraídas por OCR.
 * Não inventa dados: campos recuperados de OCR imperfeito recebem revisão.
 */
(() => {
  "use strict";
  const weekdays = ["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
  const normalize = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
  const weekdayPattern = /\b(domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado)\b/i;
  const procedurePattern = /\b(?:avalia[cç][ãa]o|tratamento|clareamento|raio\s*[-–]?\s*x|limpeza|extra[cç][ãa]o|restaura[cç][ãa]o|consulta|retorno|ortodontia|implante|profilaxia|canal|endodontia|pr[oó]tese|cirurgia|radiografia|manuten[cç][ãa]o|periodontia|exame|urg[eê]ncia)\b/i;
  const statusPattern = /\b(agendado|confirmado|cancelado|faltou|realizado|encaixe|pendente)\s*[.!]?\s*$/i;
  function validISO(y,m,d) {
    const dt=new Date(Date.UTC(y,m-1,d));
    return y>=2000&&y<=2100&&m>=1&&m<=12&&d>=1&&dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;
  }
  const pad = n => String(n).padStart(2,"0");
  function parseDate(s) {
    const t=String(s||"").replace(/^[\s\[\]({«“'—–]+/u,"");
    // ISO com separadores alterados pelo OCR, como "2026 11-10".
    let m=t.match(/^(20\d{2})[\s./-]+(\d{1,2})[\s./-]+(\d{1,2})(?!\d)/);
    if(m) {
      const y=+m[1],mo=+m[2],d=+m[3];
      if(validISO(y,mo,d))return {date:y+"-"+pad(mo)+"-"+pad(d),rest:t.slice(m[0].length),repaired:/[ .]/.test(m[0])};
    }
    m=t.match(/^(20\d{2})(\d{2})(\d{2})(?!\d)/);
    if(m) {
      const y=+m[1],mo=+m[2],d=+m[3];
      if(validISO(y,mo,d))return {date:y+"-"+pad(mo)+"-"+pad(d),rest:t.slice(m[0].length),repaired:true};
    }
    // Datas no formato brasileiro com ano completo.
    m=t.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})(?!\d)/);
    if(m) {
      const y=+m[3],mo=+m[2],d=+m[1];
      if(validISO(y,mo,d))return {date:y+"-"+pad(mo)+"-"+pad(d),rest:t.slice(m[0].length),repaired:false};
    }
    return null;
  }
  function weekdayNumber(word) {
    const k=normalize(word||"").replace(/-feira$/,"");
    return weekdays.indexOf(k);
  }
  function normalizeTime(raw) {
    const m=String(raw||"").match(/^(\d{1,2})[:.h](\d{2})$|^(\d{2})(\d{2})$/i);
    if(!m)return "";
    const h=+(m[1]||m[3]),min=+(m[2]||m[4]);
    return h>=0&&h<=23&&min>=0&&min<=59?pad(h)+":"+pad(min):"";
  }
  function readTime(rest) {
    const m=rest.match(/^\s*([01]?\d|2[0-3])[:.h]([0-5]\d)\b|^\s*(\d{2})([0-5]\d)\b/i);
    if(!m)return null;
    const raw=m[0].trim(),value=normalizeTime(raw);
    return value?{time:value,rest:rest.slice(m[0].length).trim(),repaired:!raw.includes(":")}:null;
  }
  function isNoise(line) {
    const s=normalize(line).replace(/^[^a-z0-9]+/,"").trim();
    if(!s || s.length<4 || /^[^a-z0-9]*$/.test(s))return true;
    if(/^(?:tela |pagina inteira|agendamentos$|claro br|99 motorista|chatgpt|conexao|bateria|ativar leitura|exportar|pagina inteira)/.test(s))return true;
    if(/^\d{1,2}:\d{2}\s*(?:all|the|e|[a-z]{0,2})$/.test(s))return true;
    if(!/[aeiou]/.test(s) && !/\d{4}[-/ ]\d/.test(s))return true;
    return false;
  }
  function usefulResidual(line) {
    if(isNoise(line))return false;
    const s=String(line||"").trim();
    return procedurePattern.test(s) || weekdayPattern.test(s) ||
      /\b(?:[01]?\d|2[0-3])[:.h][0-5]\d\b/.test(s) ||
      /\b(?:[01]\d|2[0-3])[0-5]\d\b/.test(s) ||
      /\b[A-ZÀ-Ý][a-zà-ÿ]{2,}\s+[A-ZÀ-Ý][a-zà-ÿ]{2,}\b/u.test(s);
  }
  function splitPatient(text) {
    const s=String(text||"").replace(/^[\s"“”'«»—–•]+/,"").trim();
    const match=procedurePattern.exec(s);
    if(!match)return null;
    const nome=s.slice(0,match.index).replace(/[\s"“”'«».,:;—–•]+$/,"").trim();
    const procedimento=s.slice(match.index).replace(/[\s"“”'«».,:;—–•]+$/,"").trim();
    if(!/^[\p{L}][\p{L}' -]{4,70}$/u.test(nome) || nome.split(/\s+/).length<2 || !procedimento)return null;
    return {nome,procedimento};
  }
  function tryParse(raw,anchors) {
    const s=String(raw||"").replace(/^[\s\[\]({«“'—–]+/u,"").trim();
    let dateInfo=parseDate(s), repaired=false, remaining="";
    const day=weekdayPattern.exec(s);
    if(dateInfo) {remaining=dateInfo.rest;repaired=dateInfo.repaired;}
    else {
      // Recupera datas de sete dígitos somente quando há âncora explícita
      // para o mesmo dia da semana. Nunca deduz datas de uma navegação solta.
      const broken=s.match(/^(20\d{5})(?!\d)\s*/);
      const options=day?anchors.filter(x=>x.weekday===weekdayNumber(day[0])):[];
      if(!broken || options.length!==1)return null;
      dateInfo={date:options[0].date};
      remaining=s.slice(broken[0].length);repaired=true;
    }
    const weekday=weekdayPattern.exec(remaining);
    if(weekday){
      const d=new Date(dateInfo.date+"T12:00:00Z").getUTCDay();
      if(d!==weekdayNumber(weekday[0]))return null;
      remaining=remaining.slice(weekday.index+weekday[0].length);
    }else if(day) {
      // A palavra do dia precisa concordar com a data reconhecida.
      if(new Date(dateInfo.date+"T12:00:00Z").getUTCDay()!==weekdayNumber(day[0]))return null;
      remaining=remaining.slice(day.index+day[0].length);
    }
    const t=readTime(remaining);
    if(!t)return null;
    repaired=repaired||t.repaired;
    let rest=t.rest;
    let situacao="";
    const st=statusPattern.exec(rest);
    if(st){situacao=st[1][0].toUpperCase()+st[1].slice(1).toLowerCase();rest=rest.slice(0,st.index).trim();}
    // Restos curtos do OCR ao final NÃO viram status confirmado.
    if(!situacao)rest=rest.replace(/\s+(?:ho|n-|[0-9]{1,2}|[\\|/]+)\s*$/i,"").trim();
    const person=splitPatient(rest);
    if(!person)return null;
    const confidence=!repaired&&situacao?"Alta":"Média";
    return {nome:person.nome,data:dateInfo.date,hora:t.time,procedimento:person.procedimento,
      situacao,confianca:confidence,revisao_pendente:!situacao||repaired?"SIM":"NAO",raw};
  }
  function parse(text) {
    const lines=String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const anchors=[];
    for(const line of lines) {
      const dt=parseDate(line);
      if(!dt)continue;
      const day=weekdayPattern.exec(dt.rest);
      if(!day)continue;
      const weekday=weekdayNumber(day[0]);
      if(new Date(dt.date+"T12:00:00Z").getUTCDay()===weekday&&!anchors.some(a=>a.date===dt.date))
        anchors.push({date:dt.date,weekday});
    }
    const appointments=[],residual=[],keys=new Map();
    for(const line of lines) {
      const rec=tryParse(line,anchors);
      if(!rec) {if(usefulResidual(line))residual.push(line);continue;}
      const key=[rec.data,rec.hora,normalize(rec.nome)].join("|");
      if(keys.has(key)){
        const prev=appointments[keys.get(key)];
        if((prev.procedimento!==rec.procedimento || (prev.situacao && rec.situacao && prev.situacao!==rec.situacao))){
          prev.confianca="Baixa";prev.revisao_pendente="SIM";
          prev.raw+="\nReleitura divergente: "+rec.raw;
        }else if(rec.confianca==="Alta" || (!prev.situacao&&rec.situacao)){
          appointments[keys.get(key)]=rec;
        }
        continue;
      }
      keys.set(key,appointments.length);appointments.push(rec);
    }
    return {appointments,residual};
  }
  window.LeitorAgenda={parse,isNoise,usefulResidual,normalize};
})();