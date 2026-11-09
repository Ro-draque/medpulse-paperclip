import fs from 'node:fs/promises';
import path from 'node:path';
import {campaignKey} from './instagram-campaign.mjs';
import {unwrapDocument} from './review-support.mjs';
import {hash} from './growth-core.mjs';
import {sha256} from './market-core.mjs';

const base='http://127.0.0.1:3100';
async function api(route,method='GET',body){
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  const text=await response.text();
  if(!response.ok)throw Error(`${method} ${route}: HTTP ${response.status} ${text}`);
  return JSON.parse(text);
}
async function waitFor(id,status){
  for(let i=0;i<110;i++){
    const task=await api('/api/issues/'+id);
    if(task.status===status)return task;
    if(['blocked','cancelled','done'].includes(task.status))throw Error(task.identifier+': '+JSON.stringify(task.executionBlocker??task.status));
    await new Promise(r=>setTimeout(r,2000));
  }
  throw Error('Tiempo de espera agotado. Consultar Paperclip antes de reintentar.');
}
const evidence='evidence/instagram';
await fs.mkdir(evidence,{recursive:true});
const lock=path.join(evidence,'orchestration.lock');
const handle=await fs.open(lock,'wx');
try{
  const company=(await api('/api/companies')).find(c=>c.name==='MEDPULSE');
  const route='/api/companies/'+company.id;
  const agents=await api(route+'/agents');
  const market=agents.find(a=>a.name==='Market Intelligence Analyst');
  const strategist=agents.find(a=>a.name==='Campaign Strategist');
  const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date()));
  const research=await api(route+'/issues','POST',{title:'Instagram · Investigación de contexto sanitario',status:'todo',assigneeAgentId:market.id,description:JSON.stringify({kind:'medpulse-instagram-v1',stage:'market',year})});
  console.log('Investigación '+research.identifier);
  await waitFor(research.id,'done');
  const report=unwrapDocument(await api('/api/issues/'+research.id+'/documents/result'));
  const title='Instagram · Reponer con tiempo · '+campaignKey.slice(0,12);
  const matches=(await api(route+'/issues?search='+encodeURIComponent(title))).filter(task=>task.title===title);
  if(matches.length>1)throw Error('Hay campañas duplicadas, revisar Paperclip');
  let campaign=matches[0];
  const reused=!!campaign;
  if(!campaign&&report.context.signal==='descenso_posinvernal')campaign=await api(route+'/issues','POST',{
    title,status:'todo',assigneeAgentId:strategist.id,blockedByIssueIds:[research.id],
    description:JSON.stringify({kind:'medpulse-instagram-v1',stage:'strategy',sourceTaskId:research.id,campaignKey}),
    executionPolicy:{mode:'normal',commentRequired:true,stages:[{type:'approval',participants:[{type:'user',userId:'local-board'}]}]}
  });
  if(!campaign){console.log('Investigación archivada para evaluación editorial');process.exitCode=0;}
  else{
    const task=await waitFor(campaign.id,'in_review');
    const draft=unwrapDocument(await api('/api/issues/'+task.id+'/documents/result'));
    const handoff=unwrapDocument(await api('/api/issues/'+draft.sourceTaskId+'/documents/result'));
    if(hash(handoff)!==draft.sourceHash||!task.blockedBy.some(b=>b.id===draft.sourceTaskId)||task.executionState?.currentParticipant?.type!=='user')throw Error('No se pudo verificar el handoff y la revisión');
    const image=await fetch(base+'/api/attachments/'+draft.image.attachmentId+'/content');
    if(!image.ok)throw Error('Adjunto JPEG no disponible');
    const bytes=Buffer.from(await image.arrayBuffer());
    if(sha256(bytes)!==draft.image.sha256)throw Error('El adjunto no coincide con la pieza');
    await fs.writeFile('dashboard/data/instagram-campaign.jpg',bytes);
    const snapshot={...draft,schema:'medpulse.instagram.v1',review:{status:task.status,participant:'human'},lastResearch:{identifier:research.identifier,edition:report.edition.number,reused},exportedAt:new Date().toISOString()};
    await fs.writeFile('dashboard/data/instagram.json',JSON.stringify(snapshot,null,2)+'\n');
    const receipt={research:research.identifier,originalResearch:draft.sourceTask,campaign:task.identifier,reused,review:task.status,researchRunId:report.runId,campaignRunId:draft.runId,imageSha256:draft.image.sha256};
    await fs.writeFile(path.join(evidence,research.id,'verification.json'),JSON.stringify(receipt,null,2));
    console.log(JSON.stringify(receipt,null,2));
  }
}finally{
  await handle.close();
  await fs.unlink(lock);
}
