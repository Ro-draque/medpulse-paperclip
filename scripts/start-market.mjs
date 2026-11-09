import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {hash,validateDataset} from './growth-core.mjs';
const root=path.resolve(import.meta.dirname,'..'),base='http://127.0.0.1:3100';
async function api(route,method='GET',data){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const t=await r.text();if(!r.ok)throw Error(`${r.status} ${t}`);return t?JSON.parse(t):null;}
const company=(await api('/api/companies')).find(c=>c.name===(process.env.MEDPULSE_COMPANY_NAME||'MEDPULSE'));if(!company)throw Error('Run original growth bootstrap first');
const existing=await api(`/api/companies/${company.id}/agents`),agents={};for(const [k,name]of Object.entries({director:'Growth Director',sales:'Sales Intelligence',strategy:'Campaign Strategist',outreach:'Outreach Operator'})){const a=existing.find(a=>a.name===name);if(!a)throw Error(`Missing ${name}`);agents[k]=a.id;}
let market=existing.find(a=>a.name==='Market Intelligence Analyst');
if(!market)market=await api(`/api/companies/${company.id}/agents`,'POST',{name:'Market Intelligence Analyst',role:'general',title:'Market Intelligence Analyst',reportsTo:agents.director,adapterType:'process',adapterConfig:{command:process.execPath,args:[path.join(root,'scripts/growth-worker.mjs')],cwd:root,timeoutSec:240,env:{MEDPULSE_STAGE:'market',MEDPULSE_CODEX_COMMAND:process.env.MEDPULSE_CODEX_COMMAND||'codex'},instructionsFilePath:path.join(root,'agents/market.md')},runtimeConfig:{heartbeat:{enabled:false,wakeOnDemand:true}}});agents.market=market.id;
const pointer=JSON.parse(await fs.readFile('evidence/latest-market-source.json','utf8')),source=JSON.parse(await fs.readFile(pointer.manifestPath,'utf8'));
const d=validateDataset(JSON.parse(await fs.readFile('data/distributor.json','utf8'))),batch=crypto.randomUUID(),dir=path.join('evidence/market',batch);await fs.mkdir(dir,{recursive:true});
const datasetPath=`${dir}/dataset.json`;await fs.writeFile(datasetPath,JSON.stringify(d,null,2));
const original=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8'));const originalBefore=await api(`/api/issues/${original.tasks.outreach.id}`);await fs.writeFile(path.join(dir,'original-campaign-before.json'),JSON.stringify(originalBefore,null,2));
const tasks={};for(const stage of ['market','sales','strategy']){
 const sourceTaskIds=stage==='market'?[]:stage==='sales'?[tasks.market.id]:[tasks.market.id,tasks.sales.id];
 const meta={kind:'medpulse-market-v1',batch,stage,datasetPath,datasetHash:hash(d),sourceManifestPath:pointer.manifestPath,sourceManifestHash:hash(source),sourceTaskIds};
 const task=await api(`/api/companies/${company.id}/issues`,'POST',{title:`MEDPULSE Market · ${stage} · ${batch.slice(0,8)}`,description:JSON.stringify(meta),status:'backlog',priority:'high',assigneeAgentId:agents[stage],blockedByIssueIds:sourceTaskIds});tasks[stage]={id:task.id,identifier:task.identifier};
}
const manifest={schema:'medpulse.market-flow.v1',batch,companyId:company.id,agents,tasks,datasetPath,datasetHash:hash(d),sourceManifestPath:pointer.manifestPath,sourceManifestHash:hash(source),originalCampaignId:original.tasks.outreach.id,startedAt:new Date().toISOString()};
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));await fs.writeFile('evidence/latest-market.json',JSON.stringify(manifest,null,2));
for(const stage of ['strategy','sales','market'])await api(`/api/issues/${tasks[stage].id}`,'PATCH',{status:'todo'});
console.log(JSON.stringify(manifest,null,2));
