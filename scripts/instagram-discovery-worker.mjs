import fs from 'node:fs/promises';
import path from 'node:path';
import {hash} from './growth-core.mjs';
import {discoverHealth,comparePublication,trendMarker} from './instagram-discovery.mjs';
import {documentUpdate,unwrapDocument} from './review-support.mjs';

const root=path.resolve(import.meta.dirname,'..');
const base=process.env.PAPERCLIP_API_URL;
const runId=process.env.PAPERCLIP_RUN_ID;
const agentId=process.env.PAPERCLIP_AGENT_ID;
if(!base||!runId||!agentId||!process.env.PAPERCLIP_API_KEY)throw Error('Ejecutar desde Paperclip');
const headers={Authorization:'Bearer '+process.env.PAPERCLIP_API_KEY,'X-Paperclip-Run-Id':runId,'Content-Type':'application/json'};
async function api(route,method='GET',body){
  const response=await fetch(base+route,{method,headers,body:body&&JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const text=await response.text();
  if(!response.ok)throw Error(`${method} ${route}: HTTP ${response.status} ${text}`);
  return text?JSON.parse(text):null;
}
const me=await api('/api/agents/me');
const company='/api/companies/'+me.companyId;
const issues=await api(company+'/issues?assigneeAgentId='+agentId);
const candidate=issues.find(t=>t.description?.includes(trendMarker)&&['todo','in_progress'].includes(t.status)&&(t.executionRunId===runId||t.checkoutRunId===runId))
  ??issues.find(t=>t.description?.includes(trendMarker)&&t.status==='todo'&&!t.executionRunId&&!t.checkoutRunId);
if(!candidate)throw Error('No hay consulta asignada');
const task=await api('/api/issues/'+candidate.id);
if(task.assigneeAgentId!==agentId||[task.executionRunId,task.checkoutRunId].some(id=>id&&id!==runId))throw Error('Otra ejecución posee la consulta');
if(task.executionRunId!==runId&&task.checkoutRunId!==runId)await api('/api/issues/'+task.id+'/checkout','POST',{agentId,expectedStatuses:['todo','in_progress']});

const home=path.join(root,'evidence','instagram-discovery');
const directory=path.join(home,task.id);
await fs.mkdir(directory,{recursive:true});
const lock=path.join(home,'discovery.lock');
const handle=await fs.open(lock,'wx');
async function save(file,value){
  const temp=file+'.'+runId+'.tmp';
  await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n');
  await fs.rename(temp,file);
}
async function read(file,fallback){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return fallback;}
}
try{
  const stateFile=path.join(home,'history.json');
  const state=await read(stateFile,{publications:{},campaigns:{},runs:{}});
  let report=state.runs[task.id];
  if(!report){
    const {products}=JSON.parse(await fs.readFile(path.join(root,'data','distributor.json'),'utf8'));
    const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date()));
    const scan=await discoverHealth(directory,products,year);
    const publications=scan.publications.map(p=>({...p,observation:comparePublication(state.publications[p.id]?.at(-1),p)}));
    report={...scan,publications,taskId:task.id,identifier:task.identifier,runId,observedAt:new Date().toISOString(),dispatch:null};
    state.runs[task.id]=report;
    await save(stateFile,state);
  }
  async function byTitle(title){
    const matches=(await api(company+'/issues?search='+encodeURIComponent(title))).filter(t=>t.title===title);
    if(matches.length>1)throw Error('Conflicto de identidad en Paperclip');
    return matches[0]??null;
  }
  const agents=await api(company+'/agents');
  const assignee=name=>agents.find(a=>a.name===name)?.id;
  for(const publication of report.publications){
    if(publication.decision)continue;
    const key=publication.campaignKey;
    const suffix=key?.slice(0,12);
    const campaignTitle=publication.approach==='kit'?'Instagram · Tu botiquín, al día · '+suffix:'Instagram · Reponer con tiempo · '+suffix;
    if(publication.observation==='repeated')publication.decision='repeated';
    else if(!publication.classification.relevant)publication.decision='irrelevant';
    else if(!publication.approach||!publication.classification.eligible)publication.decision='editorial_review';
    else if(state.campaigns[key]||await byTitle(campaignTitle)){
      const existing=state.campaigns[key]??await byTitle(campaignTitle);
      let dispatch=state.campaigns[key];
      if(!dispatch){
        const meta=JSON.parse(existing.description);
        if(meta.discoveryTaskId===task.id){
          const research=await api('/api/issues/'+meta.sourceTaskId);
          dispatch={research:research.identifier,researchId:research.id,campaign:existing.identifier,campaignId:existing.id,discoveryTaskId:task.id,campaignKey:key};
          state.campaigns[key]=dispatch;
        }
      }
      if(dispatch?.discoveryTaskId===task.id){
        publication.decision='queued';
        report.dispatch=dispatch;
      }else publication.decision='existing_campaign';
    }else if(report.dispatch)publication.decision='editorial_review';
    else{
      const selectionHash=hash(publication);
      await save(path.join(directory,'selected.json'),publication);
      const researchTitle='Instagram · Análisis sanitario · '+suffix;
      const research=await byTitle(researchTitle)??await api(company+'/issues','POST',{
        title:researchTitle,status:'backlog',assigneeAgentId:assignee('Market Intelligence Analyst'),blockedByIssueIds:[task.id],
        description:JSON.stringify({kind:'medpulse-instagram-v1',stage:'market',discoveryTaskId:task.id,selectionHash})
      });
      const campaign=await api(company+'/issues','POST',{
        title:campaignTitle,status:'backlog',assigneeAgentId:assignee('Campaign Strategist'),blockedByIssueIds:[research.id],
        description:JSON.stringify({kind:'medpulse-instagram-v1',stage:'strategy',sourceTaskId:research.id,campaignKey:key,discoveryTaskId:task.id}),
        executionPolicy:{mode:'normal',commentRequired:true,stages:[{type:'approval',participants:[{type:'user',userId:'local-board'}]}]}
      });
      report.dispatch={research:research.identifier,researchId:research.id,campaign:campaign.identifier,campaignId:campaign.id,discoveryTaskId:task.id,campaignKey:key};
      state.campaigns[key]=report.dispatch;
      publication.decision='queued';
    }
    const versions=state.publications[publication.id]??=[];
    if(publication.observation!=='repeated'&&!versions.some(v=>v.taskId===task.id))versions.push({taskId:task.id,sha256:publication.sha256,observedAt:report.observedAt,sources:publication.sources,decision:publication.decision});
    await save(stateFile,state);
  }
  if(report.dispatch){
    for(const id of [report.dispatch.campaignId,report.dispatch.researchId]){
      const child=await api('/api/issues/'+id);
      if(child.status==='backlog')await api('/api/issues/'+id,'PATCH',{status:'todo'});
    }
  }
  const route='/api/issues/'+task.id+'/documents/result';
  const existing=await fetch(base+route,{headers});
  if(existing.status===404)await api(route,'PUT',documentUpdate(null,{title:'Auditoría de consulta sanitaria',format:'markdown',body:'```json\n'+JSON.stringify(report,null,2)+'\n```'}));
  else if(!existing.ok||hash(unwrapDocument(await existing.json()))!==hash(report))throw Error('El recibo existente no coincide');
  const snapshot={schema:'medpulse.instagram-discovery.v1',latest:report,history:Object.values(state.runs).slice(-30),campaigns:Object.values(state.campaigns)};
  for(const target of [path.join(root,'dashboard','data'),path.join(root,'dist','dashboard','data')]){
    if(await fs.stat(target).then(s=>s.isDirectory()).catch(()=>false))await save(path.join(target,'instagram-discovery.json'),snapshot);
  }
  await api('/api/issues/'+task.id,'PATCH',{status:'done'});
  console.log(JSON.stringify({task:task.identifier,publications:report.publications.map(p=>[p.id,p.observation,p.decision]),dispatch:report.dispatch,errors:report.errors,modelCalls:0}));
}finally{
  await handle.close();
  await fs.unlink(lock);
}
