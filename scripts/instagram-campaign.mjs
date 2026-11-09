import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from './growth-core.mjs';
import {sha256,textOf} from './market-core.mjs';

const origin='https://www.argentina.gob.ar';
export const audience='Responsables de compras de consultorios y centros ambulatorios';
export const campaignKey=hash(['instagram','planificacion-insumos','P04','compras-ambulatorias']);
export function findEdition(html){
  const editions=[...html.matchAll(/<h[2-6]\b[^>]*>\s*BEN\s+(\d+)\s+SE\s+(\d+)\s*\(([^<]+)\)/gi)];
  if(!editions.length)throw Error('El índice oficial no contiene ediciones reconocibles');
  editions.sort((a,b)=>Number(b[1])-Number(a[1]));
  const [,number,week,period]=editions[0];
  const link=[...html.matchAll(/href=["']([^"']+)["'][^>]*>\s*Descargar\s+BEN\s+(\d+)/gi)].find(m=>m[2]===number);
  if(!link)throw Error('Edición descubierta sin PDF oficial');
  return {number:Number(number),week:Number(week),period:textOf(period),pdf:new URL(link[1],origin).href};
}
export function respiratoryContext(html,week,year){
  const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>textOf(m[1]));
  const text=paragraphs.find(p=>p.includes('(SE) '+week)&&/circulaci[oó]n de virus respiratorios/i.test(p));
  if(!text||!new RegExp('de '+year+'\\b').test(textOf(html)))throw Error('Resumen oficial no coincide con la edición');
  const descending=/tendencia descendente|curva descendente/i.test(text);
  return {classification:'contexto_epidemiologico',signal:descending?'descenso_posinvernal':'contexto_sin_direccion_verificada',interpretation:descending?'El Ministerio describe un descenso de la circulación de virus respiratorios tras los picos invernales.':'El Ministerio describe la circulación respiratoria del período. La dirección del cambio requiere revisión.',demandTrend:'sin evidencia comercial',reference:'Primer párrafo sobre circulación de virus respiratorios'};
}
async function archive(url,dir,name){
  const destination=new URL(url,origin);
  if(destination.origin!==origin||destination.username||destination.password)throw Error('Dominio sanitario fuera de la lista permitida');
  const response=await fetch(destination,{redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok||new URL(response.url).origin!==origin)throw Error('Fuente sanitaria no disponible: HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>20_000_000||name.endsWith('.pdf')&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Archivo sanitario no válido');
  await fs.writeFile(path.join(dir,name),bytes);
  return {url:destination.href,finalUrl:response.url,retrievedAt:new Date().toISOString(),sha256:sha256(bytes),file:name,text:name.endsWith('.html')?bytes.toString('utf8'):undefined};
}
export async function researchInstagram(dir,year){
  const index=await archive('/salud/boletin-epidemiologico-nacional/boletines-'+year,dir,'index.html');
  const edition=findEdition(index.text);
  const summary=await archive('/noticias/actualizacion-del-boletin-epidemiologico-nacional-de-la-semana-ndeg-'+edition.week,dir,'summary.html');
  const context=respiratoryContext(summary.text,edition.week,year);
  const pdf=await archive(edition.pdf,dir,'ben.pdf');
  const sources=[['Índice de boletines del Ministerio de Salud',index],['Resumen oficial de la semana '+edition.week,summary],['Boletín Epidemiológico Nacional '+edition.number,pdf]].map(([title,{text,...source}])=>({title,...source}));
  return {edition,context,sources,productId:'P04',audience,campaignKey,sourcePolicy:'Ministerio de Salud de la Nación · índice anual, edición y resumen oficial de la misma semana'};
}
export function createDraft(research,product){
  if(product?.id!==research.productId||product.stock<=0||!/^Barbijos tricapa, caja x50$/i.test(product.name))throw Error('Producto ausente, sin stock o con presentación distinta de la pieza');
  if(research.context.signal!=='descenso_posinvernal')throw Error('El hallazgo requiere otra revisión editorial');
  return {
    objective:'Recibir consultas B2B sobre reposición de insumos de uso habitual',
    audience:research.audience,
    format:'Publicación vertical de feed · JPEG 1080 × 1350',
    headline:'Reponer con tiempo.',
    copy:'¿Estás revisando los insumos de tu consultorio? Incluí los barbijos tricapa en tu próxima revisión de reposición. Escribinos para consultar presentación, disponibilidad y cotización.',
    cta:'Pedí una cotización',
    visual:'Ilustración editorial de un barbijo plegado, con tipografía de alto contraste y una llamada a la acción destacada.',
    rationale:'El boletín sirve como contexto para hablar de planificación. No aporta datos de ventas o demanda. El producto pertenece al catálogo de prueba y su disponibilidad comercial real queda por confirmar.',
    product:{id:product.id,name:product.name,stockType:'synthetic'},
    publication:'review_only'
  };
}
