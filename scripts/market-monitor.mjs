import fs from 'node:fs/promises';
import path from 'node:path';
import {sha256, textOf, parseSearch, extractDeadline} from './market-core.mjs';
import {hash} from './growth-core.mjs';

const sources = [
  {id:'tdf', name:'Compras de Tierra del Fuego', origin:'https://compras.tierradelfuego.gob.ar', index:'/', reason:'Portal provincial de compras. El enlace y la respuesta deben permanecer en el dominio oficial.'},
  {id:'sf', name:'Boletín Oficial de Santa Fe', origin:'https://www.santafe.gob.ar', index:'/boletinoficial/', reason:'Publicación oficial provincial. El índice oficial enlaza la sección Licitaciones de la edición.'}
];
const aliases = {P01:['guantes de nitrilo','guantes descartables'],P02:['gasas','compresas de gasa'],P03:['jeringas','jeringas descartables'],P04:['barbijos','mascarillas quirurgicas']};
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const decode = value => textOf(value.replace(/&(a|e|i|o|u|n)(acute|tilde);/gi,(_,letter,accent)=>letter+(accent==='acute'?'\u0301':'\u0303')).replace(/&ordm;|&deg;/g,'°').replace(/&[lr]dquo;/g,'"').replace(/&ndash;/g,'–')).normalize('NFC');
const links = html => [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1].replaceAll('&amp;','&'));
const localDate = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'short'}).format(date);

export function checkedUrl(input, source) {
  const url = new URL(input, source.origin);
  if (url.origin !== source.origin || url.username || url.password) throw Error('Dominio fuera de la fuente verificada');
  url.hash = '';
  return url;
}

function allowedByRobots(text, url) {
  let active = false;
  for (const line of text.split(/\r?\n/)) {
    const [key,...value] = line.split('#')[0].trim().split(':');
    const rule = value.join(':').trim();
    if (key.toLowerCase()==='user-agent') active = rule==='*'||/medpulse/i.test(rule);
    if (active && key.toLowerCase()==='disallow' && rule) {
      const pattern = rule.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replaceAll('*','.*');
      if (new RegExp('^'+pattern).test(url.pathname+url.search)) return false;
    }
    if (active && key.toLowerCase()==='content-signal' && /search\s*=\s*no/i.test(rule)) return false;
  }
  return true;
}

export function tenderStatus(notice, asOf) {
  if (notice.event==='award'||notice.event==='correction'&&/preadjudicaci[oó]n/i.test(notice.content.slice(0,350))) return 'historical_award';
  if (notice.event==='cancelled') return 'historical_cancelled';
  if (notice.deadline?.date < asOf) return 'historical_expired';
  if (notice.deadline?.date >= asOf) return 'published_deadline_pending_confirmation';
  return 'status_unverified';
}

export function latestVersion(versions) {
  return versions.reduce((latest, current)=>current.publishedAt>=latest.publishedAt?current:latest);
}

function identity(text, issuer, fallback) {
  const expediente = text.match(/\b(?:expediente|expte\.?)\s*(?:n[°º.]?\s*)?[:.\s]*([A-Z0-9-]+(?:[-/][A-Z0-9-]+)+)/i)?.[1]
    ?? text.match(/\b(?:MS|MPA|HRU)-[A-Z0-9-]*\d-20\d{2}\b/i)?.[0];
  const tender = normalize(text).match(/\b(licitacion publica|licitacion privada|compra directa|concurso de precios|compulsa abreviada)\s*(?:n[°º.]?\s*)?(\d+[/-]\d{2,4})/)?.slice(1).join(' ');
  return {expediente:expediente??null, key:expediente?'exp:'+expediente.toUpperCase():tender&&issuer?'process:'+normalize(issuer)+':'+tender:'notice:'+fallback};
}

function kind(text) {
  const value=normalize(text);
  if (/\b(rectificaci[oó]n|pr[oó]rroga|fe de erratas)\b/.test(value)) return 'correction';
  if (/\b(?:preadjudicacion|adjudicacion)\b/.test(value) && !/adjudicacion simple/.test(value)) return 'award';
  if (/\b(?:anulacion|cancelacion)\b/.test(value)) return 'cancelled';
  return 'notice';
}

export function applyObservations(history, observations, at) {
  const counts={new:0,updates:0,corrections:0,duplicates:0};
  for (const notice of observations) {
    const key=notice.sourceId+':'+notice.key;
    const record=history[key]??={sourceId:notice.sourceId, key:notice.key, firstSeenAt:at, lastSeenAt:at, versions:[]};
    record.lastSeenAt=at;
    const revision=hash({content:normalize(notice.content),deadline:notice.deadline,event:notice.event,documents:notice.documents.map(d=>[d.url,d.sha256??null]).sort()});
    if (record.versions.some(v=>v.revision===revision)) { counts.duplicates++; continue; }
    if (record.versions.length) counts.updates++; else counts.new++;
    if (notice.event==='correction') counts.corrections++;
    record.versions.push({...notice, observedAt:at, revision});
  }
  return counts;
}

export async function scanMarket({directory, products, history, now=new Date(), fetcher=fetch}) {
  await fs.mkdir(directory,{recursive:true});
  const observedAt=now.toISOString(), asOf=localDate(now), attempts=[], observations=[], results=[];
  const criteria=products.map(p=>({id:p.id,name:p.name,terms:aliases[p.id]??[normalize(p.name.split(',')[0])]}));
  const match=text=>criteria.filter(p=>p.terms.some(t=>normalize(text).includes(t))).map(p=>p.id);
  for (const source of sources) {
    const cache=new Map();
    let robots='', requests=0, documentBudget=2;
    async function get(input, type='html') {
      const original=checkedUrl(input,source);
      if(cache.has(original.href))return cache.get(original.href);
      const redirects=[];
      let url=original, response;
      for(let i=0;i<4;i++){
        if(type!=='robots'&&!allowedByRobots(robots,url))throw Error('Ruta excluida por robots.txt');
        if(++requests>32)throw Error('Presupuesto de solicitudes alcanzado');
        response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'MEDPULSE/1.0 (public procurement monitor)'}});
        if(![301,302,303,307,308].includes(response.status))break;
        if(!response.headers.get('location'))throw Error('Redirección sin destino');
        url=checkedUrl(new URL(response.headers.get('location'),url),source);
        redirects.push(url.href);
      }
      const final=checkedUrl(response.url||url.href,source);
      const item={url:original.href,finalUrl:final.href,redirects,at:new Date().toISOString(),status:response.status};
      attempts.push(item);
      if(!response.ok){
        await response.body?.cancel();
        if(response.status===404&&(type==='robots'||type==='archive'))return null;
        throw Error('HTTP '+response.status);
      }
      const reader=response.body.getReader(), chunks=[];
      let size=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.length;
        if(size>4_000_000){await reader.cancel();throw Error('Archivo supera 4 MB');}
        chunks.push(value);
      }
      const bytes=Buffer.concat(chunks), digest=sha256(bytes);
      if(type==='pdf'&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Documento no es PDF');
      const file=digest+(type==='pdf'?'.pdf':'.html');
      await fs.writeFile(path.join(directory,file),bytes);
      Object.assign(item,{sha256:digest,file});
      const result={...item,text:type==='pdf'?'':bytes.toString('utf8')};
      cache.set(original.href,result);
      return result;
    }
    async function documents(candidates, base) {
      const docs=[];
      for(const input of [...new Set(candidates)].slice(0,6)){
        const url=new URL(input,base);
        if(url.protocol!=='https:'||url.username||url.password||[...url.searchParams.keys()].some(k=>/token|secret|signature|key|auth/i.test(k)))continue;
        const doc={url:url.href,verification:'referenced_only'};
        if(url.origin===source.origin&&documentBudget>0){
          documentBudget--;
          try{const result=await get(url,'pdf');Object.assign(doc,{finalUrl:result.finalUrl,sha256:result.sha256,file:result.file,verification:'downloaded_pdf'});}
          catch{doc.verification='download_unverified';}
        }
        docs.push(doc);
      }
      return docs;
    }
    async function add({id, issuer, content, publishedAt, evidence, docs, deadline, products:productIds}){
      if(!productIds.length)return;
      observations.push({sourceId:source.id,id,issuer,content,publishedAt,...identity(content,issuer,id),event:kind(content.slice(0,350)),deadline,products:productIds,documents:docs,
        evidence:{url:evidence.url,finalUrl:evidence.finalUrl,sha256:evidence.sha256,file:evidence.file,retrievedAt:evidence.at},
        trust:{provenance:'official_primary_publication',domainVerified:true,issuerIdentified:!!issuer,corroborated:false},
        commercial:{level:'research_only',reason:'Coincidencia de catálogo. Verificar especificaciones, expediente y capacidad antes de decidir.',contactAllowed:false,investmentAllowed:false}});
    }
    const before=observations.length;
    let errors=0, sourceError=null;
    try {
      robots=(await get('/robots.txt','robots'))?.text??'';
      if(source.id==='tdf'){
        for(const product of criteria){
          try{
            const query=product.terms[0], search=await get('/?s='+encodeURIComponent(query));
            if(!/search-result-item|Not so happy with results|No results|no se encontraron/i.test(search.text))throw Error('Formato de resultados no reconocido');
            for(const record of parseSearch(search.text,query).slice(0,2)){
              try{
                const detail=await get(record.url);
                const article=detail.text.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
                if(!article)throw Error('Aviso sin artículo reconocible');
                const content=decode(article);
                const issuer=content.match(/Hospital Regional (?:Ushuaia|Río Grande|Tolhuin)|Ministerio de (?:Salud|Producción y Ambiente)|Secretaría de Pesca y Acuicultura/i)?.[0]??(/\bHRU\b/i.test(content)?'Hospital Regional Ushuaia':null);
                await add({id:record.id,issuer,content,publishedAt:record.publishedAt,evidence:detail,docs:await documents(links(article).filter(l=>/\.pdf(?:$|\?)/i.test(l)),detail.finalUrl),deadline:extractDeadline(article),products:match(record.title+' '+content)});
              }catch{errors++;}
            }
          }catch{errors++;}
        }
      }else{
        const index=await get(source.index);
        const newest=links(index.text).find(l=>/^ver\.php\?seccion=\d{4}\/\d{4}-\d{2}-\d{2}licitaciones\.html$/.test(l));
        if(!newest)throw Error('Índice oficial sin enlace de licitaciones reconocible');
        const date=newest.match(/\d{4}-\d{2}-\d{2}/)[0];
        for(let offset=0;offset<4;offset++){
          const day=new Date(Date.parse(date)-offset*86400000).toISOString().slice(0,10);
          const section=day.slice(0,4)+'/'+day+'licitaciones.html';
          try{
            const edition=await get(source.index+'ver.php?seccion='+section,offset?'archive':'html');
            if(!edition)continue;
            const body=edition.text.split(/<!DOCTYPE HTML PUBLIC/i).at(-1).split(/<\/body>/i)[0];
            if(!/<p\b/i.test(body))throw Error('Edición sin avisos reconocibles');
            for(const fragment of body.split(/_{8,}/)){
              const content=decode(fragment), productIds=match(content);
              if(!productIds.length)continue;
              const issuer=decode(fragment.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1]??'')||null;
              const id='SF-'+day+'-'+hash(normalize(content)).slice(0,12);
              await add({id,issuer,content,publishedAt:day,evidence:edition,docs:await documents([source.index+'verPdf.php?seccion='+section,...links(fragment).filter(l=>/\.pdf(?:$|\?)/i.test(l))],edition.finalUrl),deadline:extractDeadline(fragment),products:productIds});
            }
          }catch{errors++;}
        }
      }
    }catch(error){sourceError=error.message;errors++;}
    results.push({id:source.id,name:source.name,url:source.origin+source.index,reason:source.reason,status:sourceError||errors&&observations.length===before?'unavailable':errors?'partial':'ok',errors,error:sourceError,matches:observations.length-before,requests});
  }
  const counts=applyObservations(history,observations,observedAt);
  const notices=Object.values(history).map(record=>{
    const latest=latestVersion(record.versions);
    const {content,...notice}=latest;
    return {...notice,status:tenderStatus(latest,asOf),versionCount:record.versions.length,firstSeenAt:record.firstSeenAt,lastSeenAt:record.lastSeenAt};
  });
  return {observedAt,asOf,sources:results,counts,notices,attempts,criteria,coverage:'Tierra del Fuego: hasta dos resultados por familia. Santa Fe: edición más reciente y tres días calendario anteriores. Sin inferir cobertura total.',modelCalls:0};
}
