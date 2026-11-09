import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {researchInstagram,createDraft} from './instagram-campaign.mjs';
import {hash} from './growth-core.mjs';
import {sha256} from './market-core.mjs';
import {documentUpdate,unwrapDocument} from './review-support.mjs';
import {kitDraft} from './instagram-discovery.mjs';

export async function runInstagram({task,meta,api,request,me,runId,root,agentId}){
  const current=await api('/api/issues/'+task.id);
  if(current.assigneeAgentId!==agentId||[current.executionRunId,current.checkoutRunId].some(id=>id&&id!==runId))throw Error('La tarea pertenece a otra ejecución');
  if(current.executionRunId!==runId&&current.checkoutRunId!==runId)await api('/api/issues/'+task.id+'/checkout','POST',{agentId,expectedStatuses:['todo','in_progress']});
  const dir=path.join(root,'evidence','instagram',task.id);
  await fs.mkdir(dir,{recursive:true});
  const route='/api/issues/'+task.id+'/documents/result';
  const attach=async(file,type)=>{
    const form=new FormData();
    form.append('file',new Blob([await fs.readFile(path.join(dir,file))],{type}),file);
    const response=await fetch(new URL(`/api/companies/${me.companyId}/issues/${task.id}/attachments`,process.env.PAPERCLIP_API_URL),{method:'POST',headers:{Authorization:'Bearer '+process.env.PAPERCLIP_API_KEY,'X-Paperclip-Run-Id':runId},body:form});
    if(!response.ok)throw Error('No se pudo adjuntar '+file+': '+response.status);
    const result=await response.json();
    return result.id??result.attachment?.id;
  };
  let result;
  const previous=await request(route);
  if(previous.ok){
    result=unwrapDocument(await previous.json());
  }else{
    if(previous.status!==404)throw Error('No se pudo verificar el documento existente');
    if(meta.stage==='market'){
      if(meta.discoveryTaskId){
        const archived=path.join(root,'evidence','instagram-discovery',meta.discoveryTaskId);
        const selected=JSON.parse(await fs.readFile(path.join(archived,'selected.json'),'utf8'));
        if(hash(selected)!==meta.selectionHash||!current.blockedBy.some(b=>b.id===meta.discoveryTaskId))throw Error('Evidencia de descubrimiento no verificable');
        for(const source of selected.sources){
          const bytes=await fs.readFile(path.join(archived,source.file));
          if(sha256(bytes)!==source.sha256)throw Error('El archivo sanitario cambió');
          await fs.writeFile(path.join(dir,source.file),bytes);
          source.attachmentId=await attach(source.file,source.file.endsWith('.pdf')?'application/pdf':'text/html');
        }
        result={...selected,productId:selected.classification.productId,discoveryTaskId:meta.discoveryTaskId};
      }else{
        result=await researchInstagram(dir,meta.year);
        result.sources[1].attachmentId=await attach('summary.html','text/html');
        result.sources[2].attachmentId=await attach('ben.pdf','application/pdf');
      }
    }else{
      const source=await api('/api/issues/'+meta.sourceTaskId);
      if(source.status!=='done'||!current.blockedBy.some(b=>b.id===source.id))throw Error('Handoff sin dependencia verificada');
      const report=unwrapDocument(await api('/api/issues/'+source.id+'/documents/result'));
      if(report.campaignKey!==meta.campaignKey)throw Error('La investigación no corresponde a la campaña');
      const {products}=JSON.parse(await fs.readFile(path.join(root,'data','distributor.json'),'utf8'));
      const product=products.find(p=>p.id===report.productId);
      const draft=report.approach==='kit'?kitDraft(report,product):createDraft(report,product);
      let image=null;
      let imageStatus='generated';
      try{
        await promisify(execFile)('pwsh',['-NoProfile','-File',path.join(root,'scripts','render-instagram.ps1'),'-OutputPath',path.join(dir,'campaign.jpg'),'-Theme',report.approach==='kit'?'kit':'respiratory'],{windowsHide:true,timeout:30000});
        const imageHash=sha256(await fs.readFile(path.join(dir,'campaign.jpg')));
        const attachmentId=await attach('campaign.jpg','image/jpeg');
        if(!attachmentId)throw Error('Paperclip no devolvió el adjunto de la pieza');
        image={sha256:imageHash,attachmentId,width:1080,height:1350};
      }catch(error){
        if(!meta.discoveryTaskId)throw error;
        imageStatus='pending_manual_visual';
        console.error('No se pudo adjuntar una pieza válida:',error.message);
      }
      result={...draft,edition:report.edition,context:report.context,sources:report.sources,sourceTaskId:source.id,sourceTask:source.identifier,sourceHash:hash(report),campaignKey:meta.campaignKey,image,imageStatus};
    }
    Object.assign(result,{taskId:task.id,identifier:task.identifier,runId});
    await api(route,'PUT',documentUpdate(null,{title:meta.stage==='market'?'Investigación sanitaria para Instagram':'Propuesta de Instagram y pieza para revisión',format:'markdown',body:'```json\n'+JSON.stringify(result,null,2)+'\n```'}));
  }
  const transition=await api('/api/issues/'+task.id,'PATCH',{status:'done'});
  const expected=meta.stage==='market'?'done':'in_review';
  if(transition.status!==expected||meta.stage==='strategy'&&transition.executionState?.currentParticipant?.type!=='user')throw Error('Estado de revisión inesperado');
  if(meta.stage==='strategy'&&meta.discoveryTaskId){
    const file='instagram-'+meta.campaignKey.slice(0,12);
    const snapshot={...result,discoveryTaskId:meta.discoveryTaskId,review:{status:transition.status,participant:'human'},imageFile:result.image?file+'.jpg':null,exportedAt:new Date().toISOString()};
    for(const target of [path.join(root,'dashboard','data'),path.join(root,'dist','dashboard','data')]){
      if(!await fs.stat(target).then(s=>s.isDirectory()).catch(()=>false))continue;
      if(result.image)await fs.copyFile(path.join(dir,'campaign.jpg'),path.join(target,file+'.jpg'));
      await fs.writeFile(path.join(target,file+'.json'),JSON.stringify(snapshot,null,2)+'\n');
    }
  }
  console.log(JSON.stringify({task:task.identifier,runId,status:transition.status}));
}
