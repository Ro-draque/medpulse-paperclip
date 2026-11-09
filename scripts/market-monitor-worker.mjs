import fs from 'node:fs/promises';
import path from 'node:path';
import {scanMarket} from './market-monitor.mjs';
import {documentUpdate} from './review-support.mjs';

const root=path.resolve(import.meta.dirname,'..');
const base=process.env.PAPERCLIP_API_URL;
const runId=process.env.PAPERCLIP_RUN_ID;
const agentId=process.env.PAPERCLIP_AGENT_ID;
if(!base||!runId||!agentId||!process.env.PAPERCLIP_API_KEY)throw Error('Ejecutar desde Paperclip');
const headers={Authorization:'Bearer '+process.env.PAPERCLIP_API_KEY,'X-Paperclip-Run-Id':runId,'Content-Type':'application/json'};
async function api(route,method='GET',body){
  const response=await fetch(base+route,{method,headers,body:body&&JSON.stringify(body)});
  const text=await response.text();
  if(!response.ok)throw Error(`${method} ${route}: HTTP ${response.status} ${text}`);
  return text?JSON.parse(text):null;
}
const me=await api('/api/agents/me');
const tasks=await api(`/api/companies/${me.companyId}/issues?assigneeAgentId=${agentId}`);
const matches=tasks.filter(task=>['todo','in_progress'].includes(task.status)&&task.description?.includes('MEDPULSE_MARKET_MONITOR_V1'));
const candidate=matches.find(task=>task.executionRunId===runId||task.checkoutRunId===runId)??matches.find(task=>!task.executionRunId&&!task.checkoutRunId);
if(!candidate)throw Error('No hay tarea de monitoreo asignada a esta ejecución');
const task=await api('/api/issues/'+candidate.id);
if(task.assigneeAgentId!==agentId||[task.executionRunId,task.checkoutRunId].some(id=>id&&id!==runId))throw Error('La tarea pertenece a otra ejecución');
if(task.executionRunId!==runId&&task.checkoutRunId!==runId)await api('/api/issues/'+task.id+'/checkout','POST',{agentId,expectedStatuses:['todo','in_progress']});

const directory=path.join(root,'evidence','market-monitor');
await fs.mkdir(directory,{recursive:true});
const lock=path.join(directory,'scan.lock');
const handle=await fs.open(lock,'wx');
async function atomic(file,data){
  const temp=file+'.'+runId+'.tmp';
  await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n');
  await fs.rename(temp,file);
}
try{
  const file=path.join(directory,'history.json');
  const state=await fs.readFile(file,'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;return {history:{},runs:{}};});
  let report=state.runs[task.id];
  if(!report){
    const {products}=JSON.parse(await fs.readFile(path.join(root,'data','distributor.json'),'utf8'));
    report=await scanMarket({directory:path.join(directory,'files'),products,history:state.history});
    Object.assign(report,{schema:'medpulse.market-monitor.v1',taskId:task.id,identifier:task.identifier,runId});
    state.runs[task.id]=report;
    await atomic(file,state);
  }
  const route='/api/issues/'+task.id+'/documents/result';
  const check=await fetch(base+route,{headers});
  if(!check.ok&&check.status!==404)throw Error('No se pudo leer el documento existente');
  const doc=check.ok?await check.json():null;
  if(!doc)await api(route,'PUT',documentUpdate(null,{title:'Resultado de la consulta de compras públicas',format:'markdown',body:'```json\n'+JSON.stringify(report,null,2)+'\n```',changeSummary:'Consulta oficial, historial y novedades'}));
  await atomic(path.join(root,'dashboard','data','market-monitor.json'),report);
  const preview=path.join(root,'dist','dashboard','data');
  if(await fs.stat(preview).then(s=>s.isDirectory()).catch(()=>false))await atomic(path.join(preview,'market-monitor.json'),report);
  await api('/api/issues/'+task.id,'PATCH',{status:'done'});
  console.log(JSON.stringify({issue:task.identifier,runId,counts:report.counts,sources:report.sources,modelCalls:0}));
}finally{
  await handle.close();
  await fs.unlink(lock);
}
