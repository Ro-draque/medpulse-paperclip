import fs from 'node:fs/promises';import path from 'node:path';
const start=performance.now();
const snapshot=JSON.parse(await fs.readFile('dashboard/data/paperclip.json','utf8'));
if(snapshot.schema!=='medpulse.public-evidence.v1'||!snapshot.handoff?.runId)throw Error('Export real Paperclip evidence before building');
const out=path.resolve('dist/dashboard');await fs.mkdir(path.join(out,'data'),{recursive:true});
await fs.mkdir(path.join(out,'centro-privado'),{recursive:true});
await fs.copyFile('private-dashboard/index.html',path.join(out,'centro-privado','index.html'));
for(const file of ['review-local.css','review-local.js'])await fs.copyFile(path.join('private-dashboard',file),path.join(out,file));
for(const file of ['index.html','style.css','app.js','whatsapp-simulation.js','data/paperclip.json','data/medpulse-informe-evidencia.pdf'])await fs.copyFile(path.join('dashboard',file),path.join(out,file));
for(const file of ['market.json','market-monitor.json','instagram.json','instagram-campaign.jpg','whatsapp-sandbox.json']){
 try{await fs.copyFile('dashboard/data/'+file,path.join(out,'data',file));}catch(e){if(e.code!=='ENOENT')throw e;}
}
for(const file of await fs.readdir('dashboard/data')){
 if(file==='instagram-discovery.json'||/^instagram-[a-f0-9]{12}\.(json|jpg)$/.test(file))await fs.copyFile(path.join('dashboard','data',file),path.join(out,'data',file));
}
console.log(JSON.stringify({output:out,sourceExport:snapshot.exportedAt,buildSeconds:Math.round((performance.now()-start)/10)/100}));
