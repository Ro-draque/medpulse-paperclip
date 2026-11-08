import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';
const started=Date.now(),originals={};for(const file of ['evidence/latest-growth.json','evidence/latest-handoff.json']){try{originals[file]=await fs.readFile(file)}catch(e){if(e.code!=='ENOENT')throw e;}}
const company=process.argv.find(a=>a.startsWith('--company='))?.slice(10)||'MEDPULSE Reproduction';
const base='http://127.0.0.1:3100';
async function get(route){const r=await fetch(base+route);if(!r.ok)throw Error(`${r.status} ${route}`);return r.json();}
async function run(script,args=[]){const p=spawn(process.execPath,[script,...args],{stdio:'inherit',windowsHide:true,env:{...process.env,MEDPULSE_COMPANY_NAME:company}});const code=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',resolve)});if(code!==0)throw Error(`${script} exit ${code}`);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let manifest;
try{
 await get('/api/health');await run('scripts/generate-growth-data.mjs');await run('scripts/start-growth.mjs');manifest=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8'));
 const deadline=started+9*60*1000;
 while(true){const tasks=await Promise.all(Object.values(manifest.tasks).map(t=>get(`/api/issues/${t.id}`)));if(tasks.slice(0,3).every(t=>t.status==='done')&&tasks[3].status==='in_review')break;if(tasks.some(t=>t.status==='blocked'))throw Error('Flow blocked; inspect Paperclip');if(Date.now()>deadline)throw Error('Reproduction exceeded 9-minute execution target');await sleep(5000);}
 await run('scripts/verify-growth.mjs');await run('scripts/register-growth-review.mjs');await run('scripts/start-handoff.mjs');
 let handoff;
 while(true){try{handoff=JSON.parse(await fs.readFile('evidence/latest-handoff.json','utf8'));if(handoff.batch===manifest.batch){const task=await get(`/api/issues/${handoff.taskId}`);if(task.status==='done')break;}}catch(e){if(e.code!=='ENOENT')throw e;}if(Date.now()>deadline)throw Error('Handoff execution timed out');await sleep(3000);}
 await run('scripts/link-handoff.mjs');
 const runs=(await get(`/api/companies/${manifest.companyId}/heartbeat-runs`)).filter(r=>[...Object.values(manifest.tasks).map(t=>t.id),handoff.taskId].includes(r.issueId));
 const result={schema:'medpulse.reproduction.v1',company,batch:manifest.batch,startedAt:new Date(started).toISOString(),finishedAt:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/10)/100,prerequisites:'Paperclip already installed and running; Codex CLI logged in; network to model provider available',includes:['company bootstrap','four agents and four real Codex executions','human approval gate left pending','local WhatsApp dry-run adapter receipt linked to source task'],excludes:['Paperclip dependency download and installation','interactive Codex login','human review time','GitHub and Vercel publication'],tasks:Object.fromEntries(Object.entries(manifest.tasks).map(([k,t])=>[k,t.identifier])),runs:runs.map(r=>({id:r.id,status:r.status,exitCode:r.exitCode,durationSeconds:r.finishedAt?Math.round((Date.parse(r.finishedAt)-Date.parse(r.startedAt))/1000):null})),approval:'pending_not_granted',messagesSent:0};
 await fs.mkdir('delivery-local',{recursive:true});await fs.writeFile('delivery-local/reproduction.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
 for(const [file,bytes]of Object.entries(originals))await fs.writeFile(file,bytes);
}
