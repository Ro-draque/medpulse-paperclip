import path from 'node:path';
import {openStore,paperclip} from './approvals-core.mjs';

const db=openStore(path.join(process.env.LOCALAPPDATA,'MEDPULSE-Approvals','private.sqlite'));
const source=await paperclip('/api/issues/MED-6');
const agents='/api/companies/'+source.companyId+'/agents';
const name='Operador aislado de pruebas editoriales';
const worker=(await paperclip(agents)).find(agent=>agent.name===name)??await paperclip(agents,'POST',{
  name,role:'general',adapterType:'process',
  adapterConfig:{command:process.execPath,args:['--version'],timeoutSec:10},
  runtimeConfig:{heartbeat:{enabled:false,wakeOnDemand:false}},
});
for(const channel of ['WhatsApp','Instagram']){
  const issues='/api/companies/'+source.companyId+'/issues';
  const title='MEDPULSE · Prueba de decisión editorial · '+channel;
  const existing=(await paperclip(issues+'?search='+encodeURIComponent(title))).find(task=>
    task.title===title&&['backlog','todo'].includes(task.status)&&task.description?.startsWith('Tarea aislada de demostración.'));
  const task=existing??await paperclip(issues,'POST',{
    title,
    description:'Tarea aislada de demostración. Ejecutor aislado sin integraciones ni dependencias.',
    status:'backlog',assigneeAgentId:worker.id,
    executionPolicy:{mode:'normal',commentRequired:true,stages:[{type:'approval',participants:[{type:'user',userId:'local-board'}]}]},
  });
  const draft=channel==='WhatsApp'
    ? {recipient:{name:'Distribuidora Demo',contact:'Contacto ficticio'},message:'Hola, ¿querés recibir una cotización de insumos? Este es un borrador de prueba.'}
    : {headline:'Borrador de Instagram de prueba',copy:'Consultá por insumos de reposición. Pieza de prueba editorial sin cuenta de destino.',cta:'Solicitá una cotización'};
  if(task.status==='backlog'||task.assigneeAgentId!==worker.id) await paperclip('/api/issues/'+task.id,'PATCH',{status:'todo',assigneeUserId:null,assigneeAgentId:worker.id});
  const documentRoute='/api/issues/'+task.id+'/documents/result';
  const current=await paperclip(documentRoute).catch(error=>{if(error.upstreamStatus!==404)throw error;});
  if(!current) await paperclip(documentRoute,'PUT',{title:'Borrador editorial de prueba',format:'markdown',body:'```json\n'+JSON.stringify(draft)+'\n```'});
  const review=await paperclip('/api/issues/'+task.id,'PATCH',{status:'in_review'});
  if(review.executionState?.status!=='pending'||review.executionState.currentParticipant?.userId!=='local-board')
    throw Error(task.identifier+' no ingresó a la etapa de aprobación.');
  db.prepare('INSERT INTO demos VALUES (?)').run(task.identifier);
  console.log(task.identifier+' · '+channel+' · '+review.status);
}
