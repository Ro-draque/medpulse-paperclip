import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from './growth-core.mjs';
import {sha256,textOf} from './market-core.mjs';
import {findEdition,respiratoryContext,audience,campaignKey} from './instagram-campaign.mjs';

const origin='https://www.argentina.gob.ar';
export const kitKey=hash(['instagram','inventario-botiquin','P02','compras-ambulatorias']);
export const trendMarker='MEDPULSE_INSTAGRAM_DISCOVERY_V1';
const links=html=>[...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]))];
export function officialTitle(html){
  return textOf(html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1]
    ?? [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>m[1]).find(title=>!textOf(title).includes('Presidencia de la Nación'))
    ?? '');
}

export function classifyPublication(kind,text,products){
  const sku=kind==='kit'?'P02':kind==='ben'?'P04':null;
  const relevant=kind==='kit'?/gasas/i.test(text)&&/reponer/i.test(text):kind==='ben';
  const product=products.find(p=>p.id===sku&&p.stock>0);
  const supported=product&&((kind==='kit'&&product.name==='Gasas estériles, paquete x100')||(kind==='ben'&&product.name==='Barbijos tricapa, caja x50'));
  return {relevant,productId:relevant?sku:null,eligible:!!(relevant&&supported),
    information:kind==='ben'?'contexto_epidemiologico':kind==='kit'?'guia_sanitaria':'noticia_institucional',
    interestTrend:'no medido',demandTrend:'sin evidencia comercial'};
}

export function comparePublication(previous,current){
  if(!previous)return 'new';
  return previous.sha256===current.sha256?'repeated':'modified';
}

export async function discoverHealth(directory,products,year){
  const queries=[], publications=[], errors=[];
  let requests=0;
  async function read(input,filename){
    let url=new URL(input,origin);
    const originalUrl=url.href;
    for(let hop=0;hop<3;hop++){
      if(url.origin!==origin||url.username||url.password||++requests>12)throw Error('Límite o dominio oficial inválido');
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
      if([301,302,303,307,308].includes(response.status)){
        await response.body?.cancel();
        url=new URL(response.headers.get('location'),url);
        continue;
      }
      if(!response.ok||new URL(response.url).origin!==origin)throw Error('HTTP '+response.status);
      const reader=response.body.getReader(),parts=[];
      let size=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.length;
        if(size>8_000_000){await reader.cancel();throw Error('Archivo supera 8 MB');}
        parts.push(value);
      }
      const bytes=Buffer.concat(parts);
      const pdf=filename.endsWith('.pdf');
      if(pdf&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Formato PDF inválido');
      const html=pdf?'':bytes.toString('utf8');
      const publishedAt=html.match(/<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})/i)?.[1]??null;
      const title=officialTitle(html);
      const source={url:originalUrl,finalUrl:response.url,retrievedAt:new Date().toISOString(),publisher:'Ministerio de Salud de la Nación',title,publishedAt,sha256:sha256(bytes),file:filename};
      await fs.writeFile(path.join(directory,filename),bytes);
      queries.push(source);
      return {source,html};
    }
    throw Error('Redirecciones excedidas');
  }
  async function source(name,fn){
    try{await fn();}catch(error){errors.push({source:name,message:error.message});}
  }
  await source('BEN',async()=>{
    const index=await read('/salud/boletin-epidemiologico-nacional/boletines-'+year,'ben-index.html');
    const edition=findEdition(index.html);
    const summary=await read('/noticias/actualizacion-del-boletin-epidemiologico-nacional-de-la-semana-ndeg-'+edition.week,'ben-summary.html');
    if(!summary.source.publishedAt?.startsWith(String(year)))throw Error('El resumen no corresponde al año');
    const context=respiratoryContext(summary.html,edition.week,year);
    const pdf=await read(edition.pdf,'ben.pdf');
    pdf.source.title='Boletín Epidemiológico Nacional '+edition.number;
    publications.push({kind:'ben',id:'BEN-'+edition.number,edition,context,sources:[summary.source,pdf.source],sha256:pdf.source.sha256,classification:classifyPublication('ben','',products),campaignKey,approach:context.signal==='descenso_posinvernal'?'respiratory':null});
  });
  await source('Primeros auxilios',async()=>{
    const index=await read('/salud/primerosauxilios','first-aid-index.html');
    const link=links(index.html).find(l=>l==='/salud/primerosauxilios/botiquin'||l==='/salud/dinesa/recomendaciones/botiquin');
    if(!link)throw Error('El índice no enlaza el botiquín');
    const article=await read(link,'kit.html');
    if(!/botiqu[ií]n/i.test(article.source.title))throw Error('El destino no corresponde a la guía');
    const content=textOf(article.html);
    const classification=classifyPublication('kit',content,products);
    publications.push({kind:'kit',id:'DINESA-botiquin',edition:null,context:{classification:'guia_sanitaria',signal:'inventario_botiquin',interpretation:'La guía oficial incluye gasas entre los elementos del botiquín y recomienda revisar el estado y la reposición de sus insumos.',demandTrend:'sin evidencia comercial'},sources:[article.source],sha256:hash([article.source.title,content.match(/Es importante mantener sus elementos.{0,220}/i)?.[0]??'',content.match(/Gasas y vendas limpias.{0,100}/i)?.[0]??'']),classification,campaignKey:kitKey,approach:classification.relevant?'kit':null});
  });
  await source('Noticias de Salud',async()=>{
    const index=await read('/salud/noticias','news-index.html');
    const link=links(index.html).find(l=>/^\/noticias\/[a-z0-9-]+$/.test(l));
    if(!link)throw Error('Índice de noticias sin publicaciones');
    const article=await read(link,'news.html');
    if(!article.source.title||!article.source.publishedAt)throw Error('Noticia sin título o fecha verificable');
    const content=textOf(article.html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0]??article.source.title);
    const relevant=/\b(gasas|barbijos|jeringas|guantes (?:de nitrilo|descartables))\b/i.test(content);
    publications.push({kind:'news',id:article.source.finalUrl,sha256:hash(content),sources:[article.source],classification:{...classifyPublication('news','',products),relevant},approach:null});
  });
  return {queries,publications,errors,requests,modelCalls:0};
}

export function kitDraft(report,product){
  if(product?.id!=='P02'||product.stock<=0||product.name!=='Gasas estériles, paquete x100')throw Error('Gasas sin disponibilidad en catálogo de prueba');
  return {
    objective:'Recibir consultas de compra para reposición de botiquines',
    audience,format:'Publicación vertical de feed · JPEG 1080 × 1350',
    headline:'Tu botiquín, al día.',
    copy:'¿Cuándo revisaste por última vez el botiquín de tu consultorio? Si necesitás reponer gasas, consultanos por presentación, disponibilidad y cotización de gasas estériles en paquete x100.',
    cta:'Consultá por gasas',visual:'Ilustración editorial de sobres de gasas y lista de inventario.',
    rationale:'La guía oficial aporta contexto sobre la revisión de botiquines. El catálogo de prueba vincula esa revisión con P02. La fuente no acredita demanda ni prestaciones de ese SKU.',
    product:{id:product.id,name:product.name,stockType:'synthetic'},publication:'review_only'
  };
}
