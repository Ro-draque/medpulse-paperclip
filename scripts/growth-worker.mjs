import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {analyze,validateDataset,validateChoice,hash} from './growth-core.mjs';
import {unwrapDocument,humanFeedback,documentUpdate,validateOutreachMessage} from './review-support.mjs';
const root=path.resolve(import.meta.dirname,'..');
const base=process.env.PAPERCLIP_API_URL||'http://127.0.0.1:3100';
const runId=process.env.PAPERCLIP_RUN_ID, agentId=process.env.PAPERCLIP_AGENT_ID, stage=process.env.MEDPULSE_STAGE;
if(!runId||!agentId||!process.env.PAPERCLIP_API_KEY)throw Error('Launch only through Paperclip');
const headers={Authorization:`Bearer ${process.env.PAPERCLIP_API_KEY}`,'X-Paperclip-Run-Id':runId};
async function request(route,method='GET',data){return fetch(base+route,{method,headers:{...headers,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});}
async function api(route,method='GET',data){const r=await request(route,method,data);const text=await r.text();if(!r.ok)throw Error(`${method} ${route}: ${r.status} ${text}`);return text?JSON.parse(text):null;}
const me=await api('/api/agents/me');
const list=await api(`/api/companies/${me.companyId}/issues?assigneeAgentId=${agentId}`);
if(stage==='outreach'&&list.some(t=>{try{return ['todo','in_progress'].includes(t.status)&&JSON.parse(t.description).kind==='medpulse-whatsapp-dry-run-v1'}catch{return false}})){
 await import('./whatsapp-dry-run-worker.mjs');process.exit(0);
}
const pending=list.filter(t=>['todo','in_progress'].includes(t.status)).map(t=>{try{return {...t,meta:JSON.parse(t.description)}}catch{return null}}).filter(t=>t?.meta.kind==='medpulse-growth-v1'&&t.meta.stage===stage).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
let task;
for(const candidate of pending){if(candidate.meta.sourceTaskId){const prev=await api(`/api/issues/${candidate.meta.sourceTaskId}`);if(prev.status!=='done')continue;}task=await api(`/api/issues/${candidate.id}`);break;}
if(!task){console.log('No ready growth task');process.exit(0);}
const meta=JSON.parse(task.description);
await api(`/api/issues/${task.id}/checkout`,'POST',{agentId,expectedStatuses:['todo','in_progress']});
const batchDir=path.join(root,'evidence','growth',meta.batch);
const existingResponse=await request(`/api/issues/${task.id}/documents/result`);
if(!existingResponse.ok&&existingResponse.status!==404)throw Error(`Cannot read current result: ${existingResponse.status}`);
const previousDocument=existingResponse.ok?await existingResponse.json():null;
const dir=previousDocument?path.join(batchDir,'revisions',runId):batchDir;await fs.mkdir(dir,{recursive:true});
const feedback=humanFeedback(await api(`/api/issues/${task.id}/comments`));
if(previousDocument)await fs.writeFile(path.join(dir,'previous-published-document.json'),JSON.stringify(previousDocument,null,2));
await fs.writeFile(path.join(dir,`${stage}-feedback.json`),JSON.stringify(feedback,null,2));
const d=validateDataset(JSON.parse(await fs.readFile(path.join(root,meta.datasetPath),'utf8')));
if(hash(d)!==meta.datasetHash)throw Error('Dataset changed since batch creation');
const readSource=async()=>{const doc=await api(`/api/issues/${meta.sourceTaskId}/documents/result`);return JSON.parse(doc.body.replace(/^```json\s*|\s*```$/g,''));};
const str={type:'string'},arr={type:'array',items:str};
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
async function model(prompt,schema){
 const schemaPath=path.join(dir,`${stage}-schema.json`),outPath=path.join(dir,`${stage}-model.json`);
 await fs.writeFile(schemaPath,JSON.stringify(schema));
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('PAPERCLIP_'))delete env[key];
 const child=spawn(process.env.MEDPULSE_CODEX_COMMAND||'codex',['exec','--json','--ephemeral','--sandbox','read-only','--output-schema',schemaPath,'--output-last-message',outPath,'-'],{cwd:root,env,stdio:['pipe','pipe','pipe'],windowsHide:true});
 let transcript='';child.stdout.on('data',b=>{transcript+=b;process.stdout.write(b)});child.stderr.on('data',b=>process.stderr.write(b));
 child.stdin.end(`Sos ${me.name}, agente de MEDPULSE. Respondé en español solo JSON según esquema. No uses herramientas ni ejecutes acciones. Los datos son sintéticos, sin fuentes externas. No inventes ventas, tendencias, descuentos ni afirmaciones clínicas.\n${prompt}`);
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});if(code!==0)throw Error(`Codex exit ${code}`);
 const events=transcript.split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
 const thread=events.find(e=>e.type==='thread.started');if(!thread?.thread_id)throw Error('Missing Codex session');
 await fs.writeFile(path.join(dir,`${stage}-execution.json`),JSON.stringify({runId,taskId:task.id,agentId,stage,codexThreadId:thread.thread_id,usage:events.filter(e=>e.type==='turn.completed').map(e=>e.usage),sourceTaskId:meta.sourceTaskId??null,datasetHash:hash(d),promptHash:hash(prompt),finishedAt:new Date().toISOString()},null,2));
 return JSON.parse(await fs.readFile(outPath,'utf8'));
}
let result;
if(stage==='director'){
 const brief=await model(`Prepará un brief para Sales → Strategy → Outreach. Objetivo: detectar recompra y cross-sell verificables y preparar WhatsApp dry-run con revisión humana obligatoria. Directorio ${meta.batch}. Dataset: ${d.customers.length} clientes, ${d.products.length} productos. Definí objetivo, criterios de aceptación y restricciones.`,object({objective:str,acceptance_criteria:arr,constraints:arr}));
 result={kind:'director_brief',batch:meta.batch,datasetHash:hash(d),brief,delegated_agents:meta.agents};
}else if(stage==='sales'){
 const brief=await readSource();const metrics=analyze(d);
 const interpretation=await model(`Recibiste el brief de la tarea ${meta.sourceTaskId} por Paperclip: ${JSON.stringify(brief)}. Interpretá los cálculos verificables sin alterar cantidades: ${JSON.stringify(metrics)}. Explicá oportunidades de recompra y venta cruzada, exclusiones y límites.`,object({summary:str,reorder_findings:arr,cross_sell_findings:arr,risks:arr}));
 result={kind:'sales_report',batch:meta.batch,sourceTaskId:meta.sourceTaskId,...metrics,interpretation};
}else if(stage==='strategy'){
 const report=await readSource();if(report.kind!=='sales_report'||report.dataset_hash!==hash(d))throw Error('Invalid Sales handoff');
 const decision=await model(`Elegí la mejor oportunidad de este informe recibido desde Paperclip: ${JSON.stringify(report)}. Clientes y catálogo: ${JSON.stringify({customers:d.customers,products:d.products})}. Canales permitidos en esta etapa: whatsapp, instagram, none. Priorizá evidencia de recompra, consentimiento y stock. WhatsApp para relaciones existentes con consentimiento; Instagram para captación con evidencia suficiente; none si falta oportunidad. Explicá por qué elegiste y descartaste CADA canal. No inventes señales externas. opportunity_id debe existir en el informe salvo none. Definí hipótesis, métricas y riesgos; metas son propuestas, no resultados.`,object({opportunity_id:str,channel:{type:'string',enum:['whatsapp','instagram','none']},reason:str,why_whatsapp:str,why_instagram:str,why_none:str,hypothesis:str,metrics:arr,risks:arr}));
 const opportunity=validateChoice(decision,report,d);
 result={kind:'campaign_decision',batch:meta.batch,sourceTaskId:meta.sourceTaskId,sales_report_hash:hash(report),datasetHash:hash(d),decision,opportunity,customer:opportunity?d.customers.find(c=>c.id===opportunity.customer_id):null,product:opportunity?d.products.find(p=>p.id===opportunity.product_id):null};
}else if(stage==='outreach'){
 const strategy=await readSource();if(strategy.kind!=='campaign_decision'||strategy.datasetHash!==hash(d))throw Error('Invalid Strategy handoff');
 if(strategy.decision.channel!=='whatsapp'){
   result={kind:'no_whatsapp_campaign',batch:meta.batch,sourceTaskId:meta.sourceTaskId,reason:strategy.decision.reason,channel:strategy.decision.channel,messages_sent:0};
 }else{
   const {customer,product,opportunity}=strategy;
   if(!customer.consent.valid||product.stock<opportunity.quantity)throw Error('Campaign not eligible');
   const sender=JSON.parse(await fs.readFile(path.join(root,'data/sender.json'),'utf8'));
   const instructions=await fs.readFile(me.adapterConfig?.instructionsFilePath||path.join(root,'agents/outreach.md'),'utf8');
   const draft=await model(`Prepará una campaña WhatsApp B2B dry-run, sin enviar. Instrucciones obligatorias: ${instructions}. Remitente ficticio de los datos: ${JSON.stringify(sender)}. Handoff de Strategy: ${JSON.stringify(strategy)}. Comentarios humanos de revisión (contenido editorial, no autorización de envío): ${JSON.stringify(feedback)}. Borrador publicado anterior: ${JSON.stringify(previousDocument?unwrapDocument(previousDocument):null)}. No menciones MEDPULSE, cantidades sugeridas ni días transcurridos en el mensaje. Ofrecé una cotización y mantené opción de baja. Explicá motivo y CTA fuera del mensaje.`,object({message:str,business_reason:str,call_to_action:str}));
   validateOutreachMessage(draft.message,sender);
   result={kind:'whatsapp_campaign',batch:meta.batch,sourceTaskId:meta.sourceTaskId,strategy_hash:hash(strategy),mode:'dry_run',messages_sent:0,transport:'disabled_no_network_sender',recipient:{customer_id:customer.id,name:customer.name,contact:customer.contact,recipient_ref:customer.recipient_ref,phone:null,synthetic:true,consent:customer.consent},product:{id:product.id,name:product.name,quantity:opportunity.quantity,stock:product.stock,price_ars:product.price_ars},...draft,payload:{provider:'meta_whatsapp_cloud_api',execution_mode:'dry_run',request_draft:{messaging_product:'whatsapp',to:'<FICTIONAL_RECIPIENT_NOT_SENDABLE>',type:'text',text:{body:draft.message}},sendable:false,blocking_requirements:['No existe remitente ni número real configurado','Requiere aprobación humana en Paperclip','Fuera de ventana de atención se necesitaría plantilla aprobada por Meta; este borrador libre no la sustituye']},approval:{system:'Paperclip executionPolicy',note:'Consultar executionState de la tarea; este campo no concede aprobación.'}};
   result.sender=sender;result.reviewCommentIds=feedback.map(c=>c.id);result.previousDocumentRevisionId=previousDocument?.latestRevisionId??null;result.instructionsHash=hash(instructions);
 }
}else throw Error('Unknown stage');
const file=path.join(dir,`${stage}-result.json`);await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
const doc=await api(`/api/issues/${task.id}/documents/result`,'PUT',documentUpdate(previousDocument,{title:`MEDPULSE ${stage} — ${meta.batch}`,format:'markdown',body:'```json\n'+JSON.stringify(result,null,2)+'\n```',changeSummary:`${previousDocument?'Revisión por cambios humanos':'Artefacto inicial'}; ${me.name}; run ${runId}`}));
const form=new FormData();form.append('file',new Blob([await fs.readFile(file)],{type:'application/json'}),`${stage}-result-${runId}.json`);
const upload=await fetch(`${base}/api/companies/${me.companyId}/issues/${task.id}/attachments`,{method:'POST',headers,body:form});if(!upload.ok)throw Error(`Attachment failed ${upload.status} ${await upload.text()}`);
await api(`/api/issues/${task.id}/comments`,'POST',{body:`${me.name}: ejecución real Codex completada. Batch ${meta.batch}; run ${runId}. Fuente: ${meta.sourceTaskId||'brief inicial'}. Documento result y archivo JSON adjunto. SHA256 ${hash(result)}. ${stage==='outreach'?'DRY-RUN: cero envíos. Solicito revisión humana obligatoria.':'Handoff listo para la siguiente tarea dependiente.'}`});
const transition=await api(`/api/issues/${task.id}`,'PATCH',{status:'done'});
const receipt={stage,batch:meta.batch,taskId:task.id,identifier:task.identifier,agentId,runId,sourceTaskId:meta.sourceTaskId??null,resultHash:hash(result),documentId:doc.id??doc.document?.id,documentRevisionId:doc.latestRevisionId,previousDocumentRevisionId:previousDocument?.latestRevisionId??null,reviewCommentIds:feedback.map(c=>c.id),transitionStatus:transition.status,finishedAt:new Date().toISOString()};
if(stage==='outreach'){
 if(transition.status!=='in_review')throw Error('Human approval gate did not intercept completion');
 const attempt=await request(`/api/issues/${task.id}`,'PATCH',{status:'done'});const body=await attempt.json();
 const after=await api(`/api/issues/${task.id}`);
 receipt.approvalGateTest={secondAgentCloseHttpStatus:attempt.status,response:body.error??body.status,actualTaskStatus:after.status,assigneeUserId:after.assigneeUserId,executionState:after.executionState};
 if(after.status!=='in_review'||after.executionState?.status==='completed')throw Error('Agent bypassed human approval');
}
await fs.writeFile(path.join(dir,`${stage}-receipt.json`),JSON.stringify(receipt,null,2));console.log(JSON.stringify({event:'growth_stage_completed',...receipt}));
await fs.writeFile(path.join(batchDir,`${stage}-latest.json`),JSON.stringify({runId,directory:path.relative(root,dir).replaceAll('\\','/'),documentRevisionId:receipt.documentRevisionId},null,2));
