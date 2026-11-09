import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {hash,validateDataset} from './growth-core.mjs';
import {baseDemo,demoDatabasePath,importedDemo} from './demo-spreadsheet.mjs';
const root=path.resolve(import.meta.dirname,'..'),base='http://127.0.0.1:3100';
async function api(route,method='GET',body){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();if(!r.ok)throw Error(`${r.status} ${t}`);return t?JSON.parse(t):null;}
const fromSpreadsheet=process.argv.includes('--planilla');
const companyName=fromSpreadsheet?'MEDPULSE Planillas Demo':process.env.MEDPULSE_COMPANY_NAME||'MEDPULSE';
let input=baseDemo();
if(fromSpreadsheet){
 const db=new DatabaseSync(demoDatabasePath(),{readOnly:true});
 try{
  const saved=importedDemo(db);
  if(!saved)throw Error('Primero cargá las planillas desde el centro privado de Gerencia.');
  input=JSON.parse(saved.dataset);
 }finally{db.close();}
}
const dataset=validateDataset(input);
let company=(await api('/api/companies')).find(c=>c.name===companyName);
if(!company)company=await api('/api/companies','POST',{name:companyName,description:'Compañía de Growth B2B con datos sintéticos, ejecuciones reales y revisión humana.'});
const existing=await api(`/api/companies/${company.id}/agents`);const director=existing.find(a=>a.name==='Growth Director');
const roles={director:'Growth Director',sales:'Sales Intelligence',strategy:'Campaign Strategist',outreach:'Outreach Operator'};
const agents={};
for(const [stage,name] of Object.entries(roles)){
 const current=existing.find(a=>a.name===name);
 const adapterConfig={command:process.execPath,args:[path.join(root,'scripts/growth-worker.mjs')],cwd:root,timeoutSec:240,env:{MEDPULSE_STAGE:stage,MEDPULSE_CODEX_COMMAND:process.env.MEDPULSE_CODEX_COMMAND||'codex'},...(stage==='outreach'?{instructionsFilePath:path.join(root,'agents/outreach.md')}:{})};
 const data={name,role:stage==='director'?'ceo':'general',title:name,adapterType:'process',adapterConfig,runtimeConfig:{heartbeat:{enabled:false,wakeOnDemand:true}},...(stage==='director'?{}:{reportsTo:agents.director})};
 const a=current?await api(`/api/agents/${current.id}`,'PATCH',data):await api(`/api/companies/${company.id}/agents`,'POST',data);agents[stage]=a.id;
}
const batch=crypto.randomUUID(),dir=path.join(root,'evidence/growth',batch);await fs.mkdir(dir,{recursive:true});
const datasetPath=`evidence/growth/${batch}/dataset.json`;await fs.writeFile(path.join(root,datasetPath),JSON.stringify(dataset,null,2));
const tasks={};let previous=null;
for(const stage of Object.keys(roles)){
 const meta={kind:'medpulse-growth-v1',batch,stage,agents,datasetPath,datasetHash:hash(dataset),sourceTaskId:previous};
 const t=await api(`/api/companies/${company.id}/issues`,'POST',{title:`MEDPULSE ${stage} · ${batch.slice(0,8)}`,description:JSON.stringify(meta),status:'backlog',priority:'high',assigneeAgentId:agents[stage],...(previous?{blockedByIssueIds:[previous]}:{}),...(stage==='outreach'?{executionPolicy:{mode:'normal',commentRequired:true,stages:[{type:'approval',participants:[{type:'user',userId:'local-board'}]}]}}:{})});
 tasks[stage]={id:t.id,identifier:t.identifier};previous=t.id;
}
const manifest={batch,companyId:company.id,agents,tasks,datasetPath,datasetHash:hash(dataset),createdAt:new Date().toISOString()};
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(fromSpreadsheet?'evidence/latest-growth-planilla.json':'evidence/latest-growth.json',JSON.stringify(manifest,null,2));
for(const stage of ['outreach','strategy','sales','director'])await api(`/api/issues/${tasks[stage].id}`,'PATCH',{status:'todo'});
console.log(JSON.stringify(manifest,null,2));
