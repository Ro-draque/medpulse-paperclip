import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {parseSearch,sha256} from './market-core.mjs';
const root=path.resolve(import.meta.dirname,'..');
const from=process.argv.find(a=>a.startsWith('--from='))?.slice(7);
if(from){
 const source=JSON.parse(await fs.readFile(path.resolve(from),'utf8'));
 for(const f of source.files){const b=await fs.readFile(path.resolve(path.dirname(from),f.file));if(sha256(b)!==f.sha256)throw Error(`Evidence altered: ${f.file}`);}
 await fs.mkdir('evidence',{recursive:true});await fs.writeFile('evidence/latest-market-source.json',JSON.stringify({...source,manifestPath:path.relative(root,path.resolve(from)).replaceAll('\\','/')},null,2));console.log('Verified archived import: '+source.batch);process.exit(0);
}
const batch=crypto.randomUUID(),dir=path.join('evidence/market-source',batch);await fs.mkdir(dir,{recursive:true});const started=Date.now(),files=[],attempts=[];
async function download(url,file,required=true){
 const at=new Date().toISOString();try{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'MEDPULSE-challenge/1.0 (public-source-evidence)'}});const bytes=Buffer.from(await response.arrayBuffer());
  await fs.writeFile(path.join(dir,file),bytes);const entry={url,retrievedAt:at,httpStatus:response.status,file,sha256:sha256(bytes),bytes:bytes.length};files.push(entry);attempts.push(entry);
  if(!response.ok)throw Error(`HTTP ${response.status}`);return {text:bytes.toString('utf8'),entry};
 }catch(e){attempts.push({url,retrievedAt:at,error:e.message});if(required)throw e;return null;}
}
await download('https://compras.tierradelfuego.gob.ar/wp-json/wp/v2/posts?search=nitrilo&per_page=5','api-probe.html',false);
const records=[];
for(const query of ['nitrilo','gasas']){
 const {text,entry}=await download(`https://compras.tierradelfuego.gob.ar/?s=${query}`,`search-${query}.html`);
 const parsed=parseSearch(text,query);if(!parsed.length)throw Error('No verifiable articles found');
 // Bounded sample: two newest publications per keyword, not a comprehensive market survey.
 for(const r of parsed.slice(0,2)){
  const detail=await download(r.url,`${r.id}.html`);
  records.push({...r,retrievedAt:detail.entry.retrievedAt,detailFile:detail.entry.file,detailSha256:detail.entry.sha256,searchFile:entry.file,searchSha256:entry.sha256});
 }
}
const manifest={schema:'medpulse.market-source.v1',batch,provider:'Gobierno de Tierra del Fuego — portal oficial de Compras',sourceUrl:'https://compras.tierradelfuego.gob.ar/',retrievedAt:new Date().toISOString(),asOf:new Date().toISOString().slice(0,10),mode:'automated_html_import',sampling:'Dos avisos más recientes por búsqueda nitrilo/gasas; sin inferir tendencia, cobertura parcial.',files,attempts,records,elapsedSeconds:Math.round((Date.now()-started)/10)/100};
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('evidence/latest-market-source.json',JSON.stringify({...manifest,manifestPath:`${dir}/manifest.json`},null,2));
console.log(JSON.stringify({batch,records:records.map(r=>({id:r.id,title:r.title,date:r.publishedAt,url:r.url})),elapsedSeconds:manifest.elapsedSeconds,manifestPath:`${dir}/manifest.json`},null,2));
