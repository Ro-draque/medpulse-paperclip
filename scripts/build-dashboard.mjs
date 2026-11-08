import fs from 'node:fs/promises';import path from 'node:path';
const start=performance.now();
const snapshot=JSON.parse(await fs.readFile('dashboard/data/paperclip.json','utf8'));
if(snapshot.schema!=='medpulse.public-evidence.v1'||!snapshot.handoff?.runId)throw Error('Export real Paperclip evidence before building');
const out=path.resolve('dist/dashboard');await fs.mkdir(path.join(out,'data'),{recursive:true});
for(const file of ['index.html','style.css','app.js','data/paperclip.json'])await fs.copyFile(path.join('dashboard',file),path.join(out,file));
console.log(JSON.stringify({output:out,sourceExport:snapshot.exportedAt,buildSeconds:Math.round((performance.now()-start)/10)/100}));
