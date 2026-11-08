const $=s=>document.querySelector(s);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const date=value=>new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));
const label={done:'Completada',in_review:'En revisión',in_progress:'En ejecución',todo:'Pendiente',blocked:'Bloqueada',succeeded:'Exitosa',failed:'Fallida'};
function badge(status){return node('span',label[status]||status,'badge '+(['done','succeeded'].includes(status)?'positive':['failed','blocked'].includes(status)?'failure':'warning'));}
function detail(title,data){$('#detail-title').textContent=title;$('#detail-body').textContent=typeof data==='string'?data:JSON.stringify(data,null,2);$('#detail').showModal();}
$('#close-detail').addEventListener('click',()=>$('#detail').close());
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');}));
fetch('data/paperclip.json').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(data=>{
 if(data.schema!=='medpulse.public-evidence.v1')throw Error('Formato de evidencia incompatible');
 const campaignTask=data.tasks.find(t=>t.stage==='outreach');
 const approved=campaignTask.status==='done'&&campaignTask.approval?.status==='completed'&&campaignTask.approval?.lastOutcome==='approved';
 const reviewLabel=approved?'Aprobada en Paperclip':'Pendiente de aprobación';
 $('#content').hidden=false;$('#snapshot-badge').textContent=`Snapshot · ${date(data.exportedAt)}`;
 const metrics=[['Agentes participantes',String(data.agents.length),'Roles diferenciados en Paperclip'],['Ejecuciones exitosas',`${data.runs.filter(r=>r.status==='succeeded').length} / ${data.runs.length}`,'Incluye historial y validación del handoff'],['Mensajes enviados',String(data.handoff.transport.messagesSent),'Adaptador local · transporte deshabilitado'],['Revisión humana',approved?'Aprobada':'Pendiente',approved?'Decisión observada en la captura':'El agente no puede cerrar la tarea']];
 for(const [name,value,note]of metrics){const card=node('article',undefined,'metric');card.append(node('div',name,'metric-label'),node('div',value,'metric-value'),node('div',note,'metric-note'));$('#metrics').append(card);}
 $('#opportunity-count').textContent=data.opportunities.length;
 function renderOpportunities(query=''){
  $('#opportunity-grid').replaceChildren();let count=0;
  for(const opportunity of data.opportunities){
   const selected=opportunity.id===data.decision.opportunity_id;
   const title=selected?`Recompra · ${data.campaign.product}`:opportunity.type==='cross_sell'?`Venta cruzada · ${opportunity.product_id}`:`Recompra · ${opportunity.product_id}`;
   const selectedCustomer=data.opportunities.find(o=>o.id===data.decision.opportunity_id)?.customer_id;
   const customerLabel=opportunity.customer_id===selectedCustomer?data.campaign.recipient:opportunity.customer_id;
   if(!`${title} ${customerLabel} ${opportunity.customer_id} ${opportunity.product_id}`.toLowerCase().includes(query.toLowerCase()))continue;
   count++;const card=node('article',undefined,'opportunity'+(selected?' selected':'')),top=node('div',undefined,'opportunity-top');
   top.append(node('span',selected?'CAMPAÑA SELECCIONADA':'HIPÓTESIS COMPLEMENTARIA','badge '+(selected?'positive':'neutral')));
   const score=node('div',undefined,'score');score.append(node('strong',opportunity.score),node('small','/100'));top.append(score);
   const body=node('div',undefined,'opportunity-body');body.append(node('h3',title),node('div',`${customerLabel} · ${opportunity.customer_id}`,'customer'));
   body.append(node('p',selected?`${opportunity.evidence.elapsed_days} días desde la última compra, frente a un intervalo de ${opportunity.evidence.median_interval_days}. Stock suficiente para consultar una posible reposición.`:opportunity.evidence.hypothesis));
   const tags=node('div',undefined,'evidence-tags');tags.append(node('span',`Stock: ${opportunity.evidence.stock}`),node('span','Consentimiento sintético'),node('span',`Fuente: ${data.tasks.find(t=>t.stage==='sales').identifier}`));body.append(tags);
   const foot=node('div',undefined,'opportunity-footer');foot.append(node('span',selected?`WhatsApp · ${reviewLabel}`:'Canal sin seleccionar','badge '+(selected?'warning':'neutral')));
   const button=node('button','Ver evidencia ↗','text-button');button.addEventListener('click',()=>detail(title,{opportunity,decision:selected?data.decision:null,scoreFormula:data.scoreFormula,commercialData:'synthetic'}));foot.append(button);card.append(top,body,foot);$('#opportunity-grid').append(card);
  }$('#empty').hidden=count>0;
 }renderOpportunities();$('#search').addEventListener('input',e=>renderOpportunities(e.target.value));
 $('#score-formula').textContent=data.scoreFormula;
 for(const exclusion of data.exclusions)$('#exclusions').append(node('div',`${exclusion.customer_id} · ${exclusion.product_id}: ${exclusion.reason}`,'exclusion'));
 const avatar=node('span',data.campaign.contact.split(' ').map(s=>s[0]).join(''),'avatar'),recipient=node('div');recipient.append(node('strong',data.campaign.recipient),node('span',`${data.campaign.contact} · destinatario ficticio`));$('#recipient').append(avatar,recipient);
 $('#message').textContent=data.campaign.message;$('#sender').textContent=data.campaign.sender;$('#campaign-status').textContent=reviewLabel;$('#campaign-status').className='badge '+(approved?'positive':'warning');
 for(const [key,value]of [['Adaptador','Local · dry-run'],['Tarea ejecutada',data.tasks.find(t=>t.stage==='handoff').identifier],['Resultado','Validado · no enviado'],['Llamadas a Meta',data.handoff.transport.networkRequestsToMeta],['Ejecutado',date(data.handoff.executedAt)]]){const row=node('div',undefined,'receipt-fact');row.append(node('span',key),node('strong',value));$('#receipt-facts').append(row);}
 $('#view-receipt').addEventListener('click',()=>detail('Recibo de ejecución del handoff',data.handoff));
 const names={director:'Brief de campaña',sales:'Informe de oportunidades',strategy:'Decisión de canal',outreach:'Borrador revisado',handoff:'Recibo del adaptador'};
 for(const task of data.tasks){const agent=data.agents.find(a=>a.id===task.assigneeAgentId)||data.agents.find(a=>a.name==='Outreach Operator');const latest=data.runs.filter(r=>r.taskId===task.id).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0];const row=node('tr'),who=node('td',agent?.name||'Revisión humana');who.append(node('span',task.humanAssigned?'Revisión asignada a una persona':'Adaptador process','agent-secondary'));row.append(who,node('td',task.identifier),node('td',names[task.stage]),node('td',latest?`${label[latest.status]||latest.status} · ${latest.durationSeconds??'—'} s`:'—'));const state=node('td');state.append(badge(task.status));row.append(state);$('#tasks').append(row);}
 for(const run of data.runs){const row=node('div',undefined,'run-row');row.append(badge(run.status),node('code',run.id),node('span',`${run.durationSeconds??'—'} s`));$('#runs').append(row);}
 const timeline=[['01 / Versión original',`Primer borrador registrado en ${campaignTask.identifier}. Se conserva sin borrar su revisión.`,'Ver versión 1',data.review.original],...(data.review.request?[['02 / Solicitud humana',date(data.review.request.at),'Leer solicitud de cambios',data.review.request]]:[]),...(data.review.version2?[['03 / Versión revisada','Nuevo mensaje, nueva ejecución y nueva revisión del documento.','Ver versión 2',data.review.version2]]:[]),['04 / Aprobación pendiente conservada',`Captura: ${date(data.review.pendingEvidence.capturedAt)}. Intento de cierre del agente rechazado con HTTP ${data.review.newAgentCloseHttpStatus}.`,'Ver evidencia de revisión',data.review.pendingEvidence]];
 for(const [title,text,action,evidence]of timeline){const item=node('article',undefined,'timeline-item');item.append(node('h3',title),node('p',text));const button=node('button',action,'text-button');button.addEventListener('click',()=>detail(title,evidence));item.append(button);$('#timeline').append(item);}
 $('#review-current').textContent=`Estado exportado: ${reviewLabel.toLowerCase()}`;$('#footer-source').textContent=`Paperclip ${data.source.version} · Batch ${data.source.batch.slice(0,8)} · Sin fuente externa de mercado`;
}).catch(error=>{$('#error').hidden=false;$('#error').textContent=`No se pudo cargar la evidencia: ${error.message}. No se muestran valores de ejemplo.`;$('#snapshot-badge').textContent='Evidencia no disponible';});
