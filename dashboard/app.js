const $=s=>document.querySelector(s);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const date=value=>new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));
const label={done:'Completada',in_review:'En revisión',in_progress:'En ejecución',todo:'Pendiente',blocked:'Bloqueada',succeeded:'Exitosa',failed:'Fallida'};
function badge(status){return node('span',label[status]||status,'badge '+(['done','succeeded'].includes(status)?'positive':['failed','blocked'].includes(status)?'failure':'warning'));}
function detail(title,summary,evidence){
 $('#detail-title').textContent=title;
 $('#detail-body').replaceChildren(node('p',summary,'detail-summary'));
 if(evidence!==undefined){
  const technical=node('details',undefined,'technical-details');
  technical.append(node('summary','Ver detalles técnicos','button secondary'),node('pre',JSON.stringify(evidence,null,2)));
  $('#detail-body').append(technical);
 }
 $('#detail').showModal();
}
$('#close-detail').addEventListener('click',()=>$('#detail').close());
const approvals=node('a','Acceso empleados','button primary');
approvals.href=location.hostname==='127.0.0.1'&&location.port==='4173'
 ? 'http://127.0.0.1:4174/#review' : '/centro-privado/';
$('#review .panel-heading').after(approvals);
const employeeNav=node('a','Acceso empleados');
employeeNav.href=approvals.href;
$('nav').append(employeeNav);
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');}));
fetch('data/paperclip.json').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(async data=>{
 if(data.schema!=='medpulse.public-evidence.v1')throw Error('Formato de evidencia incompatible');
 const market=await fetch('data/market.json').then(r=>r.ok?r.json():null).catch(()=>null);
 const verifiedMarket=market?.schema==='medpulse.market-public.v1'?market:null;
 const campaignTask=data.tasks.find(t=>t.stage==='outreach');
 const approved=campaignTask.status==='done'&&campaignTask.approval?.status==='completed'&&campaignTask.approval?.lastOutcome==='approved';
 const reviewLabel=approved?'Aprobada en Paperclip':'Pendiente de aprobación';
 $('#content').hidden=false;$('#snapshot-badge').textContent=`Datos al ${date(data.exportedAt)}`;
 const runs=[...data.runs,...(verifiedMarket?.runs??[])];
 const metrics=[['Agentes participantes',String(verifiedMarket?.agents.length??data.agents.length),'Roles diferenciados en Paperclip'],['Ejecuciones exitosas',`${runs.filter(r=>r.status==='succeeded').length} / ${runs.length}`,'Incluye la comprobación del borrador'],['Mensajes enviados',String(data.handoff.transport.messagesSent+(verifiedMarket?.messagesSent??0)),'Prueba local sin envío'],['Revisión humana',approved?'Aprobada':'Pendiente',approved?'Decisión observada en la captura':'El agente no puede cerrar la tarea']];
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
   const button=node('button','Ver evidencia ↗','text-button');button.addEventListener('click',()=>detail(title,[
    'Origen: historial comercial sintético',
    'Corte de la captura: '+date(data.exportedAt),
    'Puntaje: '+opportunity.score+'/100',
    'Compras de referencia: '+opportunity.evidence.purchase_ids.join(', '),
    selected?data.decision.reason:opportunity.evidence.hypothesis
   ].filter(Boolean).join('\n\n')));foot.append(button);card.append(top,body,foot);$('#opportunity-grid').append(card);
  }$('#empty').hidden=count>0;
 }renderOpportunities();$('#search').addEventListener('input',e=>renderOpportunities(e.target.value));
 $('#score-formula').textContent=data.scoreFormula;
 for(const exclusion of data.exclusions)$('#exclusions').append(node('div',`${exclusion.customer_id} · ${exclusion.product_id}: ${exclusion.reason}`,'exclusion'));
 const avatar=node('span',data.campaign.contact.split(' ').map(s=>s[0]).join(''),'avatar'),recipient=node('div');recipient.append(node('strong',data.campaign.recipient),node('span',`${data.campaign.contact} · destinatario ficticio`));$('#recipient').append(avatar,recipient);
 $('#message').textContent=data.campaign.message;$('#sender').textContent=data.campaign.sender;$('#campaign-status').textContent=reviewLabel;$('#campaign-status').className='badge '+(approved?'positive':'warning');
 $('#message').after(whatsappSimulation({revision:data.campaign.revisionId,message:data.campaign.message,
  recipient:[data.campaign.recipient,data.campaign.contact].filter(Boolean).join(' · ')}));
 for(const [key,value]of [['Adaptador','Prueba local'],['Tarea ejecutada',data.tasks.find(t=>t.stage==='handoff').identifier],['Resultado','Validado · no enviado'],['Llamadas a Meta',data.handoff.transport.networkRequestsToMeta],['Ejecutado',date(data.handoff.executedAt)]]){const row=node('div',undefined,'receipt-fact');row.append(node('span',key),node('strong',value));$('#receipt-facts').append(row);}
 $('#view-receipt').addEventListener('click',()=>detail('Validación del borrador',
  `Paperclip comprobó el borrador el ${date(data.handoff.executedAt)}. El destinatario era ficticio y la prueba no envió ningún mensaje.`,data.handoff));
 const names={director:'Brief de campaña',sales:'Informe de oportunidades',strategy:'Decisión de canal',outreach:'Borrador revisado',handoff:'Recibo del adaptador'};
 for(const task of data.tasks){const agent=data.agents.find(a=>a.id===task.assigneeAgentId)||data.agents.find(a=>a.name==='Outreach Operator');const latest=data.runs.filter(r=>r.taskId===task.id).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))[0];const row=node('tr'),who=node('td',agent?.name||'Revisión humana');who.append(node('span',task.humanAssigned?'Revisión asignada a una persona':'Ejecución automatizada','agent-secondary'));row.append(who,node('td',task.identifier),node('td',names[task.stage]),node('td',latest?`${label[latest.status]||latest.status} · ${latest.durationSeconds??'—'} s`:'—'));const state=node('td');state.append(badge(task.status));row.append(state);$('#tasks').append(row);}
 for(const run of data.runs){
  const row=node('div',undefined,'run-row');
  const task=data.tasks.find(t=>t.id===run.taskId);
  row.append(badge(run.status),node('span',task?names[task.stage]:'Ejecución de Paperclip'),node('span',`${run.durationSeconds??'—'} s`));
  const button=node('button','Ver detalles técnicos','text-button');
  button.addEventListener('click',()=>detail('Ejecución en Paperclip',`Resultado: ${label[run.status]||run.status}. Inicio: ${date(run.startedAt)}.`,run));
  row.append(button);$('#runs').append(row);
 }
 const timeline=[['01 / Versión original',`Primer borrador registrado en ${campaignTask.identifier}. Se conserva sin borrar su revisión.`,'Ver versión 1',data.review.original],...(data.review.request?[['02 / Solicitud humana',date(data.review.request.at),'Leer solicitud de cambios',data.review.request]]:[]),...(data.review.version2?[['03 / Versión revisada','Nuevo mensaje, nueva ejecución y nueva revisión del documento.','Ver versión 2',data.review.version2]]:[]),['04 / Aprobación pendiente conservada',`Captura: ${date(data.review.pendingEvidence.capturedAt)}. Paperclip impidió que el agente cerrara la tarea sin revisión humana.`,'Ver evidencia de revisión',data.review.pendingEvidence]];
 for(const [title,text,action,evidence]of timeline){const item=node('article',undefined,'timeline-item');item.append(node('h3',title),node('p',text));const button=node('button',action,'text-button');button.addEventListener('click',()=>detail(title,evidence.message??evidence.text??text,evidence));item.append(button);$('#timeline').append(item);}
 $('#review-current').textContent=`Estado exportado: ${reviewLabel.toLowerCase()}`;$('#footer-source').textContent=`Paperclip ${data.source.version} · Capturas de solo lectura`;
 if(verifiedMarket)renderMarket(verifiedMarket);
}).catch(error=>{$('#error').hidden=false;$('#error').textContent=`No se pudo cargar la evidencia: ${error.message}. No se muestran valores de ejemplo.`;$('#snapshot-badge').textContent='Evidencia no disponible';});

function renderMarket(m){
 $('#data-label').textContent='Ejecuciones y avisos oficiales reales. Datos internos sintéticos.';
 const channels={whatsapp:'WhatsApp',instagram:'Instagram',both:'WhatsApp + Instagram',none:'Sin contacto'};
 const components={evidence:'Evidencia',productFit:'Encaje del producto',freshness:'Actualidad',stock:'Stock',actionability:'Posibilidad de actuar'};
 const status={historical_expired:'Plazo vencido',historical_award:'Antecedente de (pre)adjudicación',deadline_unverified:'Plazo no verificado'};
 const dateOnly=s=>new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(s));
 const sourceLink=(url,label)=>{const a=node('a',label,'text-button source-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
 const selected=m.opportunities.find(o=>o.id===m.decision.selectedOpportunityId);
 const ext=m.opportunities.find(o=>o.id===m.decision.externalRecommendation.opportunityId);
 $('#market-source').textContent=`${m.source.records} avisos oficiales · ${date(m.source.retrievedAt)} · compras internas y stock sintéticos`;
 for(const [kind,o,channel,reason,summary]of [
  ['PRIORIDAD COMERCIAL · SIMULACIÓN',selected,m.decision.channel,m.decision.reason,m.decision.campaignOutline],
  ['SEÑAL EXTERNA · INVESTIGACIÓN',ext,m.decision.externalRecommendation.channel,m.decision.externalRecommendation.reason,m.decision.externalRecommendation.conditionalCampaign]
 ]){
  const card=node('article',undefined,'panel market-decision');card.append(node('div',kind,'eyebrow'),node('h3',o.product.name),node('span',`${channels[channel]} · ${o.score.total}/100`,'badge '+(o.origin==='external'?'warning':'positive')),node('p',reason,'muted'),node('p',summary,'muted'),node('p',o.origin==='external'?'Campaña condicionada · sin aprobación ni contacto':'Propuesta · sin aprobación ni envío','fine'));
  const button=node('button','Ver decisión y alternativas ↗','text-button');button.addEventListener('click',()=>detail(o.product.name,[reason,summary].filter(Boolean).join('\n\n'),o.origin==='external'?m.decision.externalRecommendation:m.decision));card.append(button);$('#market-decisions').append(card);
 }
 const filters=document.querySelectorAll('[data-origin]');
 function cards(origin){
  const list=m.opportunities.filter(o=>origin==='all'||o.origin===origin);$('#market-count').textContent=`${list.length} oportunidades y antecedentes`;$('#market-grid').replaceChildren();
  for(const o of list){
   const external=o.origin==='external',isSelected=o.id===selected.id;
   const card=node('article',undefined,'opportunity'+(isSelected?' selected':'')),top=node('div',undefined,'opportunity-top'),score=node('div',undefined,'score');
   score.append(node('strong',o.score.total),node('small','/100'));top.append(node('span',external?'FUENTE OFICIAL REAL':'HISTORIAL SINTÉTICO','badge '+(external?'warning':'neutral')),score);
   const body=node('div',undefined,'opportunity-body');body.append(node('h3',o.product.name),node('div',external?status[o.classification.status]:`${o.type==='reorder'?'Recompra':'Venta cruzada'} · ${o.customer.name}`,'customer'));
   body.append(node('p',external?o.sourceTitle:o.type==='reorder'?`${o.evidence.elapsed_days} días desde la última compra frente a ${o.evidence.median_interval_days} habituales; señal para consultar reposición.`:o.evidence.hypothesis));
   const facts=node('ul',undefined,'market-facts');facts.append(node('li',o.certainty),node('li',`Stock sintético: ${o.product.syntheticStock} (${o.product.unit})`));
   if(external){const s=o.sources[0];facts.append(node('li',`Publicado: ${dateOnly(s.publishedAt)} · Consultado: ${date(s.retrievedAt)}`));if(o.classification.deadline)facts.append(node('li',`Plazo del aviso: ${dateOnly(o.classification.deadline.date)} ${o.classification.deadline.time??''}`));const li=node('li');li.append(sourceLink(s.url,`Abrir fuente oficial · ${s.id} ↗`));facts.append(li);}
   else{facts.append(node('li',`Fuente: ${o.sources[0].purchaseIds.join(', ')}`));for(const id of o.externalContextIds??[]){const match=m.opportunities.find(x=>x.id===id);if(match){const li=node('li');li.append(sourceLink(match.sources[0].url,`Contexto por familia · ${match.sources[0].id} ↗`));facts.append(li);}}}
   body.append(facts);
   const breakdown=node('details',undefined,'market-breakdown');breakdown.append(node('summary','Ver desglose del puntaje'));for(const [key,value]of Object.entries(o.score.components)){const row=node('div',undefined,'receipt-fact');row.append(node('span',components[key]),node('strong',`${value} / ${m.scoreFormula.components[key]}`));breakdown.append(row);}body.append(breakdown);
   const foot=node('div',undefined,'opportunity-footer');foot.append(node('span',external?'Investigar · sin campaña activa':isSelected?`${channels[m.decision.channel]} · propuesta`:'Sin canal seleccionado','badge neutral'));const view=node('button','Ver evidencia ↗','text-button');view.addEventListener('click',()=>detail(o.product.name,[
    'Corte de la captura: '+date(m.exportedAt),
    o.certainty,
    'Puntaje: '+o.score.total+'/100',
    external?'Estado: '+status[o.classification.status]:'Compras de referencia: '+o.sources[0].purchaseIds.join(', '),
    external?o.sources.map(s=>s.url).join('\n'):null,
    ...(o.limitations??[]),
    isSelected?m.decision.reason:o.recommendedNextStep
   ].filter(Boolean).join('\n\n')));foot.append(view);card.append(top,body,foot);$('#market-grid').append(card);
  }
 }
 filters.forEach(b=>b.addEventListener('click',()=>{filters.forEach(f=>f.setAttribute('aria-pressed',String(f===b)));cards(b.dataset.origin);}));cards('all');
 $('#market-score-meaning').textContent=m.scoreFormula.meaning;for(const [key,rule]of Object.entries(m.scoreFormula.rules))$('#market-score-rules').append(node('li',`${components[key]}: ${rule}`));
 for(const text of m.salesInterpretation.productPriorities)$('#market-products').append(node('li',text));
 for(const text of m.salesInterpretation.expansionResearch)$('#market-regions').append(node('li',text));
 for(const t of m.tasks){const run=m.runs.find(r=>r.id===t.runId),agent=m.agents.find(a=>a.id===t.agentId),deps=t.sourceTaskIds.map(id=>m.tasks.find(x=>x.id===id).identifier);$('#market-trace').append(node('p',`${t.identifier} · ${agent.name} · ${run.durationSeconds} s · ${deps.length?'Recibe '+deps.join(' y '):'Importación oficial'}`,'muted'));}
 const trace=node('button','Ver detalles técnicos','text-button');trace.addEventListener('click',()=>detail('Seguimiento en Paperclip','Paperclip registró las tareas que recopilaron los avisos, evaluaron las oportunidades y prepararon la recomendación.',{source:m.source,tasks:m.tasks,runs:m.runs}));$('#market-trace').append(trace);
 $('#market').hidden=false;
}

async function loadMarketMonitor(){
 const response=await fetch('data/market-monitor.json',{cache:'no-store'});
 if(!response.ok)return;
 const report=await response.json();
 if(report.schema!=='medpulse.market-monitor.v1')return;
 const sourceStatus={ok:'Consulta completada',partial:'Consulta parcial',unavailable:'Fuente no disponible'};
 const tenderStatus={historical_expired:'Histórico · plazo vencido',historical_award:'Histórico · adjudicación',historical_cancelled:'Histórico · cancelado',published_deadline_pending_confirmation:'Plazo publicado · vigencia por confirmar',status_unverified:'Estado sin verificar'};
 $('#monitor-date').textContent=`${date(report.observedAt)} · ${report.identifier}`;
 $('#monitor-coverage').textContent=report.coverage;
 const counts=report.counts;
 $('#monitor-counts').textContent=`${counts.new} expedientes nuevos · ${counts.updates} actualizaciones · ${counts.corrections} rectificaciones · ${counts.duplicates} avisos repetidos`;
 for(const source of report.sources){
  const card=node('article',undefined,'panel market-decision');
  const link=node('a',source.name,'source-link');link.href=source.url;
  card.append(link,node('p',`${sourceStatus[source.status]} · ${source.matches} coincidencias`,'muted'),node('p',source.reason,'muted'));
  if(source.errors)card.append(node('p',`${source.errors} lecturas incompletas`,'fine'));
  $('#monitor-sources').append(card);
 }
 for(const notice of report.notices.slice().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))){
  const row=node('tr'), info=node('td');
  const source=report.sources.find(s=>s.id===notice.sourceId);
  const link=node('a',notice.issuer||source.name,'source-link');link.href=notice.evidence.finalUrl;
  info.append(link,node('span',`${notice.expediente??notice.id} · Publicado ${notice.publishedAt} · ${notice.versionCount} ${notice.versionCount===1?'versión':'versiones'}`,'agent-secondary'));
  const products=notice.products.map(id=>report.criteria.find(p=>p.id===id)?.name??id);
  const proof=node('td');
  const button=node('button','Ver procedencia y documentos ↗','text-button');button.addEventListener('click',()=>detail('Aviso de '+(notice.issuer||source.name),`Publicado el ${notice.publishedAt}. ${tenderStatus[notice.status]}. Productos relacionados: ${products.join(', ')}.`,notice));
  proof.append(node('span',`Dominio oficial · ${notice.documents.filter(d=>d.verification==='downloaded_pdf').length} PDF conservados · investigar`),node('br'),button);
  row.append(info,node('td',products.join(', ')),node('td',tenderStatus[notice.status]),proof);
  $('#monitor-notices').append(row);
 }
 if(!report.notices.length){const row=node('tr'),cell=node('td','Sin coincidencias conservadas para los filtros consultados.');cell.colSpan=4;row.append(cell);$('#monitor-notices').append(row);}
 $('#market-monitor').hidden=false;
}
loadMarketMonitor().catch(error=>console.warn('Monitoreo no disponible',error.message));

async function loadInstagram(){
 const response=await fetch('data/instagram.json',{cache:'no-store'});
 if(!response.ok)return;
 const campaign=await response.json();
 if(campaign.schema!=='medpulse.instagram.v1')return;
 $('#instagram-image').src='data/instagram-campaign.jpg';
 $('#instagram-review').textContent=campaign.review.status==='in_review'?'Pendiente de aprobación humana':'Consultar revisión en Paperclip';
 const box=$('#instagram-detail');
 box.append(node('h3',campaign.headline),node('p',campaign.product.name,'instagram-product'),node('p',campaign.copy,'instagram-copy'));
 box.append(node('p',campaign.cta,'badge positive'));
 for(const [title,text] of [['Objetivo',campaign.objective],['Público',campaign.audience],['Formato',campaign.format],['Justificación',campaign.rationale],['Contexto epidemiológico',campaign.context.interpretation],['Demanda comercial',campaign.context.demandTrend]]){
  const paragraph=node('p',undefined,'muted');
  paragraph.append(node('strong',title+' · '),document.createTextNode(text));
  box.append(paragraph);
 }
 const sources=node('ul',undefined,'market-list');
 for(const source of campaign.sources){
  const item=node('li'),link=node('a',source.title,'source-link');
  link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
  item.append(link);sources.append(item);
 }
 box.append(node('h4','Fuentes oficiales'),sources,node('p',`Paperclip · ${campaign.sourceTask} → ${campaign.identifier} · captura ${date(campaign.exportedAt)}`,'fine'));
 if(campaign.lastResearch.reused)box.append(node('p',`Reconsulta ${campaign.lastResearch.identifier} · propuesta existente conservada`,'fine'));
 $('#suggested-campaigns').hidden=false;
}
loadInstagram().catch(error=>console.warn('Campaña no disponible',error.message));

async function loadInstagramDiscovery(){
 const response=await fetch('data/instagram-discovery.json',{cache:'no-store'});
 if(!response.ok)return;
 const data=await response.json();
 if(data.schema!=='medpulse.instagram-discovery.v1')return;
 const labels={queued:'Campaña encargada',irrelevant:'Descartada por relevancia',existing_campaign:'Campaña existente',repeated:'Repetida',editorial_review:'Pendiente de evaluación editorial'};
 const latest=data.latest;
 const summary=`${date(latest.observedAt)} · ${latest.identifier} · ${latest.publications.filter(p=>p.observation==='new').length} hallazgos nuevos · ${latest.publications.filter(p=>p.observation==='modified').length} modificados · ${latest.errors.length} fuentes con errores`;
 for(const p of latest.publications){
  const item=node('li'),link=node('a',p.sources[0].title||p.id,'source-link');
  link.href=p.sources[0].finalUrl;link.target='_blank';link.rel='noopener noreferrer';
  item.append(link,document.createTextNode(` · ${labels[p.decision]} · interés: ${p.classification.interestTrend} · demanda: ${p.classification.demandTrend}`));
  $('#instagram-discovery-findings').append(item);
 }
 let generated=0;
 for(const item of data.campaigns){
  const prefix='instagram-'+item.campaignKey.slice(0,12);
  const panel=node('article',undefined,'panel instagram-layout');
  const r=await fetch('data/'+prefix+'.json',{cache:'no-store'});
  if(!r.ok){
   panel.append(node('p',`${item.research} → ${item.campaign} · artefacto pendiente`));
  }else{
   const draft=await r.json();
   generated++;
   if(draft.imageFile===prefix+'.jpg'){
    const img=node('img');img.src='data/'+draft.imageFile;img.alt=draft.headline;img.width=1080;img.height=1350;panel.append(img);
   }else panel.append(node('p','Pieza pendiente de preparación visual'));
   const copy=node('div');
   copy.append(node('span','Pendiente de aprobación humana','badge warning'),node('h3',draft.headline),node('p',draft.product.name,'instagram-product'),node('p',draft.copy,'instagram-copy'),node('p',draft.cta,'badge positive'),node('p',draft.rationale,'muted'),node('p',`Paperclip · ${item.research} → ${item.campaign}`,'fine'));
   for(const source of draft.sources){const a=node('a',source.title||'Fuente oficial','source-link');a.href=source.finalUrl;a.target='_blank';a.rel='noopener noreferrer';copy.append(a,node('br'));}
   panel.append(copy);
  }
  $('#instagram-discovery-campaigns').append(panel);
 }
 const discarded=data.history.reduce((total,r)=>total+r.publications.filter(p=>p.decision==='irrelevant').length,0);
 $('#instagram-discovery-summary').textContent=`${summary} · Propuestas generadas y pendientes de revisión: ${generated} · Descartes en el historial visible: ${discarded}`;
 for(const prior of data.history.flatMap(r=>r.publications.filter(p=>p.decision==='irrelevant')).slice(-3)){
  const current=latest.publications.find(p=>p.id===prior.id);
  const item=node('li','Descartada anteriormente · '),link=node('a',current?.sources[0].title||prior.sources[0].title||'Noticia oficial','source-link');
  link.href=prior.sources[0].finalUrl;link.target='_blank';link.rel='noopener noreferrer';item.append(link);
  $('#instagram-discovery-findings').append(item);
 }
 $('#instagram-discovery').hidden=false;
}
loadInstagramDiscovery().catch(error=>console.warn('Consulta sanitaria no disponible',error.message));

async function loadWhatsAppSandbox(){
 const response=await fetch('data/whatsapp-sandbox.json',{cache:'no-store'});
 if(!response.ok)return;
 const receipt=await response.json();
 if(receipt.http?.environment!=='local_http_sandbox')return;
 const panel=node('section',undefined,'panel');
 panel.id='whatsapp-sandbox';
 const summary=`Paperclip ejecutó ${receipt.http.cases.length} comprobaciones en un simulador local. WhatsApp reales enviados: ${receipt.transport.messagesSent}.`;
 panel.append(node('div','WHATSAPP · EJECUCIÓN EN PAPERCLIP','eyebrow'),node('h2','Prueba de envío de WhatsApp'));
 panel.append(node('p',`${receipt.taskIdentifier} · ${date(receipt.executedAt)}`,'muted'),node('p',summary));
 const technical=node('details',undefined,'technical-details');
 technical.append(node('summary','Ver detalles técnicos','button secondary'),node('pre',JSON.stringify(receipt,null,2)));
 panel.append(technical);
 $('#campaign').after(panel);
}
loadWhatsAppSandbox().catch(error=>console.warn('Recibo de sandbox no disponible',error.message));
