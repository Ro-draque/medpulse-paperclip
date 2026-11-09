import path from 'node:path';
import {originals,problem} from './approvals-core.mjs';
import {unwrapDocument} from './review-support.mjs';

const companyName='MEDPULSE Ensayos Loom';
const root=path.resolve(import.meta.dirname,'..');
const issue=id=>'/api/issues/'+encodeURIComponent(id);
const stage={mode:'normal',commentRequired:true,stages:[{type:'approval',participants:[{type:'user',userId:'local-board'}]}]};
const message='Hola, Ana. Soy de Distribuidora SaludPro Demo. ¿Querés que te preparemos una cotización para reponer guantes de nitrilo? Este es un mensaje ficticio de ensayo.';
const draft={mode:'dry_run',messages_sent:0,message,
  recipient:{name:'Clínica Horizonte Demo',contact:'Ana Demo',phone:null,consent:{valid:true}},
  product:{stock:120,quantity:12},
  payload:{sendable:false,request_draft:{messaging_product:'whatsapp',to:'<FICTIONAL_RECIPIENT_NOT_SENDABLE>',type:'text',text:{body:message}}}};
export function loomRehearsals(db,center,home,paperclip,port) {
  const link=task=>'http://127.0.0.1:'+port+'/'+task.identifier.split('-')[0]+'/issues/'+task.identifier;
  const optional=route=>paperclip(route).catch(error=>{if(error.upstreamStatus!==404)throw error;return null;});
  const active=new Set();
  const row=id=>db.prepare('SELECT * FROM loom_rehearsals WHERE id=?').get(id);
  async function exclusive(key,work) {
    if(active.has(key))throw problem(409,'La operación está en curso. Consultá el estado antes de volver a intentar.');
    active.add(key);
    try{return await work();}finally{active.delete(key);}
  }
  async function findTask(companyId,title) {
    return (await paperclip('/api/companies/'+companyId+'/issues?search='+encodeURIComponent(title))).find(t=>t.title===title);
  }
  async function worker(companyId,name,isSandbox) {
    const route='/api/companies/'+companyId+'/agents';
    return (await paperclip(route)).find(a=>a.name===name)??await paperclip(route,'POST',{
      name,role:'general',adapterType:'process',
      adapterConfig:{command:process.execPath,args:isSandbox?[path.join(root,'scripts/whatsapp-dry-run-worker.mjs')]:['--version'],
        cwd:isSandbox?home:root,timeoutSec:30,...(isSandbox&&{env:{MEDPULSE_LOOM_COMPANY:companyId}})},
      runtimeConfig:{heartbeat:{enabled:false,wakeOnDemand:isSandbox}},
    });
  }
  async function create(key) {
    if(typeof key!=='string'||!/^[a-f0-9-]{36}$/.test(key))throw problem(400,'Identificador de ensayo inválido.');
    return exclusive('create',async()=>{
      const saved=db.prepare('SELECT id FROM loom_rehearsals WHERE request=?').get(key);
      if(saved)return {id:saved.id};
      const companies=await paperclip('/api/companies');
      const description='Ensayos ficticios y separados para grabar el Loom.';
      let company=companies.find(c=>c.name===companyName&&c.description===description);
      if(!company){
        company=companies.find(c=>c.name==='Loom'&&c.description===description)??await paperclip('/api/companies','POST',{name:'Loom',description});
        company=await paperclip('/api/companies/'+company.id,'PATCH',{name:companyName});
      }
      const agent=await worker(company.id,'Operador editorial de ensayo',false);
      const title='Ensayo Loom · Borrador de WhatsApp · '+key;
      const task=await findTask(company.id,title)??await paperclip('/api/companies/'+company.id+'/issues','POST',{
        title,description:'Campaña ficticia de ensayo. Requiere aprobación editorial humana.',status:'backlog',assigneeAgentId:agent.id,executionPolicy:stage,
      });
      if(task.companyId!==company.id||originals.includes(task.identifier)||task.identifier==='MED-22')
        throw problem(409,'La tarea no pertenece al espacio de ensayos.');
      const document=issue(task.id)+'/documents/result';
      if(!await optional(document))await paperclip(document,'PUT',{title:'Borrador de WhatsApp para el Loom',format:'markdown',body:'```json\n'+JSON.stringify(draft)+'\n```'});
      if(task.status==='backlog')await paperclip(issue(task.id),'PATCH',{status:'todo'});
      const review=task.status==='in_review'?task:await paperclip(issue(task.id),'PATCH',{status:'in_review'});
      if(review.executionState?.status!=='pending'||review.executionState.currentParticipant?.userId!=='local-board')
        throw problem(502,'Paperclip todavía no confirmó la etapa de aprobación del ensayo.');
      db.prepare('INSERT INTO loom_rehearsals (id,request,company,task) VALUES (?,?,?,?)').run(task.identifier,key,company.id,task.id);
      return {id:task.identifier};
    });
  }
  async function status(id) {
    const saved=row(id);
    if(!saved)throw problem(404,'Ensayo no encontrado.');
    const card=await center.view(id);
    const approval=card.history.find(d=>d.action==='approve'&&d.phase==='confirmed'&&d.revision===card.revision&&d.hash===card.hash);
    const result={sourceUrl:link({companyId:saved.company,identifier:id}),canSimulate:!!approval&&card.status==='done'&&card.review==='approved'};
    if(!saved.simulation)return result;
    const task=await paperclip(issue(saved.simulation));
    if(task.companyId!==saved.company)throw problem(409,'La simulación no pertenece al espacio de ensayos.');
    result.simulation={id:task.identifier,url:link(task),status:task.status};
    const document=await optional(issue(task.id)+'/documents/receipt');
    if(task.status!=='done'||!document)return result;
    const receipt=unwrapDocument(document);
    const run=await paperclip('/api/heartbeat-runs/'+receipt.paperclipRunId);
    if(run.status==='queued'||run.status==='running')return result;
    const success=receipt.http?.cases?.find(c=>c.name==='success');
    if(run.status!=='succeeded'||receipt.taskId!==task.id||receipt.sourceTaskId!==saved.task||receipt.sourceDocumentRevisionId!==card.revision||
      receipt.loomDecisionId!==approval?.paperclipId||receipt.transport?.networkRequestsToMeta!==0||receipt.transport?.messagesSent!==0||
      receipt.http?.environment!=='local_http_sandbox'||success?.response.status!==200||success.response.body.simulated!==true||
      success.request.body.text.body!==card.draft.message||success.response.body.messages?.[0]?.id!==receipt.http.simulatedMessageId)
      throw problem(409,'El recibo no coincide con la ejecución o la versión aprobada.');
    result.simulation.receipt=receipt;
    return result;
  }
  async function simulate(id) {
    return exclusive(id,async()=>{
      const saved=row(id);
      if(!saved)throw problem(404,'Ensayo no encontrado.');
      const current=await status(id);
      if(current.simulation?.receipt)return current;
      if(!current.canSimulate)throw problem(409,'Primero confirmá la aprobación de esta versión en Paperclip.');
      const card=await center.view(id);
      const approval=card.history.find(d=>d.phase==='confirmed'&&d.action==='approve'&&d.revision===card.revision);
      const agent=await worker(saved.company,'Operador de sandbox HTTP Loom',true);
      const title='Ensayo Loom · Simulación HTTP · '+id;
      const task=saved.simulation?await paperclip(issue(saved.simulation)):await findTask(saved.company,title)??await paperclip('/api/companies/'+saved.company+'/issues','POST',{
        title,description:JSON.stringify({kind:'medpulse-whatsapp-dry-run-v1',batch:saved.request,sourceTaskId:saved.task,transport:'local_http_sandbox',
          loom:{revision:card.revision,decisionId:approval.paperclipId}}),status:'backlog',assigneeAgentId:agent.id,blockedByIssueIds:[saved.task],
      });
      db.prepare('UPDATE loom_rehearsals SET simulation=? WHERE id=?').run(task.id,id);
      if(task.status==='backlog')await paperclip(issue(task.id),'PATCH',{status:'todo'});
      return status(id);
    });
  }
  return {create,status,simulate};
}
