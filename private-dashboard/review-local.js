const panel=document.querySelector('#private-review');
const element=(tag,text)=>{
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  return node;
};
const paragraph=(parent,text)=>parent.appendChild(element('p',text));
const notice=element('p');
notice.setAttribute('role','status');
const content=element('div');
panel.replaceChildren(element('h1','Centro privado de aprobaciones'),notice,content);
const base='/private/campaigns/';
const labels={in_review:'En revisión',in_progress:'En curso',done:'Finalizada',approved:'Aprobada',changes_requested:'Cambios solicitados',confirmed:'Confirmada',pending:'Por conciliar',conflict:'Conflicto'};
const label=value=>labels[value]??value??'Sin decisión';
const format=value=>value?new Date(value).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'Sin fecha';
async function api(route,data){
  const response=await fetch('/private/'+route,data===undefined?{}:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),
  });
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}
function button(text,handler){
  const node=element('button',text);
  node.type='button';
  node.className='button secondary';
  node.addEventListener('click',handler);
  return node;
}
function historyRows(parent,rows){
  parent.replaceChildren();
  if(!rows.length){paragraph(parent,'Todavía no hay decisiones registradas.');return;}
  for(const row of rows){
    const item=element('article');
    item.append(element('h4',row.task+' · '+row.campaign));
    paragraph(item,row.employee+' · '+row.role+' · '+format(row.at)+' (hora argentina)');
    const decision=row.action==='approve'?'Aprobada':'Cambios solicitados';
    paragraph(item,row.phase==='confirmed'?decision:'Decisión intentada: '+decision);
    paragraph(item,'Comentario: '+(row.comment||'Sin comentario'));
    paragraph(item,row.phase==='confirmed'
      ? 'Paperclip confirmó la decisión · '+label(row.paperclipStatus)
      : 'Paperclip: '+label(row.phase));
    const technical=element('details');
    technical.append(element('summary','Ver detalles técnicos'),element('pre',JSON.stringify({
      revision:row.revision,hash:row.hash,registroMEDPULSE:row.id,decisionPaperclip:row.paperclipId,
      identidadPaperclip:row.paperclipId?'local-board':null,
    },null,2)));
    item.append(technical);parent.append(item);
  }
}
async function refreshHistory(){
  const target=document.querySelector('#approval-records');
  if(!target)return;
  try{historyRows(target,await api('history'));}
  catch(error){target.textContent='No se pudo consultar el historial. '+error.message;}
}
function login(){
  content.replaceChildren();
  paragraph(content,'Ingresá con tu cuenta demo. Las decisiones son editoriales y no activan los adaptadores de envío.');
  const form=element('form');
  const user=element('select');
  for(const [id,name] of [['valentina','Valentina Demo'],['martin','Martín Demo'],['sofia','Sofía Demo']]){
    const option=element('option',name);
    option.value=id;
    user.append(option);
  }
  const pass=element('input');
  pass.type='password'; pass.required=true; pass.autocomplete='current-password';
  const username=element('label','Empleado'); username.append(user);
  const password=element('label','Contraseña'); password.append(pass);
  const submit=element('button','Ingresar'); submit.className='button primary';
  form.append(username,password,submit);
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    submit.disabled=true;
    try{await api('login',{user:user.value,password:pass.value});pass.value='';await session();}
    catch(error){notice.textContent=error.message;pass.value='';}
    finally{submit.disabled=false;}
  });
  content.append(form);
}
function display(parent,card){
  const section=element('article');
  const draft=card.draft;
  section.append(element('h3',card.id+' · '+(draft.headline??card.title)));
  if(card.demo)paragraph(section,'Tarea de demostración');
  paragraph(section,'Paperclip: '+label(card.status)+' · Última decisión: '+label(card.review));
  const approval=card.history?.find(row=>row.phase==='confirmed'&&row.action==='approve'&&row.revision===card.revision);
  if(card.review==='approved'&&approval)paragraph(section,'Aprobó esta versión: '+approval.employee+' · '+approval.role+' · '+format(approval.at));
  if(card.review==='approved'&&!card.approvedHere)paragraph(section,'La decisión de Paperclip no acredita la aprobación de esta versión en MEDPULSE.');
  paragraph(section,'Versión '+(card.version??card.revision)+' · '+format(card.updated));
  paragraph(section,draft.recipient?'Destino: '+[draft.recipient.name,draft.recipient.contact,draft.recipient.phone].filter(Boolean).join(' · ')+' (ficticio)':
    'Cuenta de Instagram: '+(draft.account??'sin cuenta configurada'));
  const copy=paragraph(section,draft.message??draft.copy);
  copy.className='private-copy';
  if(card.id==='MED-6')section.append(whatsappSimulation({revision:card.revision,message:draft.message,
    recipient:[draft.recipient?.name,draft.recipient?.contact].filter(Boolean).join(' · ')}));
  if(draft.cta)paragraph(section,'CTA: '+draft.cta);
  if(draft.rationale)paragraph(section,draft.rationale);
  if(card.hasImage){
    const image=element('img');
    image.src=base+card.id+'/image?revision='+encodeURIComponent(card.revision);
    image.alt=draft.visual??'Pieza gráfica del borrador';
    image.loading='lazy';
    section.append(image);
  }
  for(const source of draft.sources??[]){
    const url=new URL(source.url);
    if(url.protocol!=='https:')continue;
    const link=element('a',source.title??source.url);
    link.href=url.href;link.rel='noopener noreferrer';link.target='_blank';
    section.append(link,element('br'));
  }
  if(draft.sourceTaskId)paragraph(section,'Evidencia de origen: '+(draft.sourceTask??draft.sourceTaskId));
  if(card.history)appendCampaignHistory(section,card);
  const details=element('details');
  details.append(element('summary','Ver detalles técnicos'),element('pre',JSON.stringify({
    revision:card.revision,sha256:card.hash,stage:card.stage,
  },null,2)));
  section.append(details);
  appendDecisionActions(section,parent,card);
  if(card.rehearsal)appendLoomSimulation(section,card);
  parent.append(section);
}
function paperclipLink(text,url){
  const link=element('a',text);
  link.href=url;link.target='_blank';link.rel='noopener noreferrer';
  return link;
}
function appendLoomSimulation(section,card){
  const area=element('div');
  const route='campaigns/'+card.id+'/simulation';
  section.append(area);
  async function load(start=false){
    area.replaceChildren();
    const message=paragraph(area,start?'Paperclip está preparando la simulación…':'Consultando evidencia en Paperclip…');
    message.setAttribute('role','status');
    try{
      let state=await api(route,start?{}:undefined);
      if(start)for(let attempt=0;attempt<20&&state.simulation&&!state.simulation.receipt&&area.isConnected;attempt++){
        await new Promise(resolve=>setTimeout(resolve,750));
        state=await api(route);
      }
      area.replaceChildren(paperclipLink('Abrir borrador en Paperclip',state.sourceUrl));
      if(state.simulation){
        const {id,url,receipt}=state.simulation;
        paragraph(area,'Tarea de simulación '+id);
        area.append(paperclipLink('Abrir simulación en Paperclip',url));
        if(receipt){
          const details=element('details');
          details.append(element('summary','Ver recibo de simulación'));
          const success=receipt.http.cases.find(entry=>entry.name==='success');
          paragraph(details,success.request.body.text.body).className='private-copy';
          paragraph(details,'HTTP 200 · Sandbox local · Cero mensajes reales y cero llamadas a Meta.');
          paragraph(details,'Identificador simulado: '+receipt.http.simulatedMessageId);
          paragraph(details,'Recibo: '+receipt.receiptId+' · '+format(receipt.executedAt));
          paragraph(details,'Revisión: '+receipt.sourceDocumentRevisionId+' · Decisión en Paperclip: '+receipt.loomDecisionId);
          area.append(details);
          return;
        }
        paragraph(area,'Todavía no hay un recibo confirmado. Consultá el estado. Si Paperclip muestra una ejecución fallida, abrí la misma tarea para revisar el error antes de reintentar.');
      }else if(!state.canSimulate){
        paragraph(area,'La simulación se habilita cuando Paperclip confirma la aprobación de esta versión.');
        return;
      }
      if(state.canSimulate&&(!state.simulation||state.simulation.status==='backlog'))
        area.append(button(state.simulation?'Recuperar simulación':'Ejecutar simulación HTTP',()=>load(true)));
      if(state.simulation)area.append(button('Consultar estado',()=>load()));
    }catch(error){
      message.textContent='No se pudo confirmar la simulación. '+error.message;
      area.append(button('Consultar estado',()=>load()));
    }
  }
  void load();
}
function appendLoom(rehearsals){
  const section=element('section');
  const cards=element('div');
  const result=paragraph(section,'Elegí un ensayo anterior o prepará una toma nueva.');
  const select=element('select');
  const placeholder=element('option','Elegir un ensayo');
  placeholder.value='';
  select.append(placeholder);
  const field=element('label','Ensayos guardados');
  field.append(select);
  const add=id=>{const option=element('option',id);option.value=id;select.append(option);};
  rehearsals.forEach(add);
  async function show(id){
    cards.replaceChildren();
    if(!id)return;
    try{
      const card=await api('campaigns/'+id);
      if(select.value===id)display(cards,card);
    }catch(error){result.textContent=error.message;}
  }
  select.addEventListener('change',()=>show(select.value));
  const keyName='medpulse-loom-pending';
  const create=button(sessionStorage.getItem(keyName)?'Recuperar nuevo ensayo':'Nuevo ensayo',async()=>{
    create.disabled=true;
    result.textContent='Preparando borrador en Paperclip…';
    const key=sessionStorage.getItem(keyName)??crypto.randomUUID();
    sessionStorage.setItem(keyName,key);
    try{
      const {id}=await api('loom',{key});
      sessionStorage.removeItem(keyName);
      if(![...select.options].some(option=>option.value===id))add(id);
      select.value=id;
      result.textContent=id+' · Ensayo listo para revisar.';
      await show(id);
    }catch(error){result.textContent='No se pudo confirmar el nuevo ensayo. '+error.message;}
    finally{
      create.textContent=sessionStorage.getItem(keyName)?'Recuperar nuevo ensayo':'Nuevo ensayo';
      create.disabled=false;
    }
  });
  section.prepend(element('h2','Ensayos para el Loom'),create,field);
  section.append(cards);
  content.append(section);
}
function appendCampaignHistory(section,card){
  const historyLink=element('a','Ver historial de decisiones');
  const historyDetails=element('details');
  historyDetails.id='historial-'+card.id;
  historyLink.href='#'+historyDetails.id;
  historyLink.addEventListener('click',()=>{historyDetails.open=true;});
  const campaignRecords=element('div');
  historyRows(campaignRecords,card.history);
  historyDetails.append(element('summary','Decisiones de '+card.id),campaignRecords);
  section.append(historyLink,historyDetails);
}
function appendDecisionActions(section,parent,card){
  const actions=element('div');
  const comment=element('textarea');
  const controls=[];
  async function run(action){
    for(const control of controls)control.disabled=true;
    comment.disabled=true;
    try{
      const result=await api('campaigns/'+card.id+'/'+(action==='reconcile'?'reconcile':'decide'),
        {action,comment:comment.value,revision:card.revision,hash:card.hash});
      notice.textContent='Decisión confirmada en Paperclip: '+result.paperclipId;
    }catch(error){notice.textContent=error.message;}
    void refreshHistory();
    try{const current=await api('campaigns/'+card.id);section.remove();display(parent,current);}
    catch{paragraph(section,'No se pudo actualizar la ficha. Recargá la página antes de volver a decidir.');}
  }
  if(card.canDecide){
    const label=element('label','Comentario opcional');
    comment.maxLength=2000;comment.rows=3;label.append(comment);actions.append(label);
    controls.push(button('Aprobar borrador',()=>run('approve')),button('Solicitar cambios',()=>run('changes')));
  }else if(card.decisionBlock==='pending'){
    paragraph(actions,'Operación pendiente de conciliación. Los nuevos intentos están bloqueados.');
    controls.push(button('Conciliar con Paperclip',()=>run('reconcile')));
  }else if(card.decisionBlock==='conflict'){
    paragraph(actions,'La decisión y la versión difieren. Se requiere revisión manual.');
  }
  actions.append(...controls);section.append(actions);
}
function appendDemoSpreadsheets(){
  const link=element('a','Datos de la demo');
  link.href='#datos-demo';
  content.append(' · ',link);
  const section=element('section');
  section.id='datos-demo';
  section.append(element('h2','Datos de la demo'));
  paragraph(section,'Descargá las tres planillas, editalas en Excel y guardalas como CSV UTF-8. Usá solo datos ficticios y conservá los encabezados.');
  const summary=paragraph(section,'Consultando los datos disponibles…');
  const form=element('form');
  const files={};
  for(const key of ['clientes','productos','compras']){
    const download=element('a','Descargar '+key+' (.csv)');
    download.href='/private/planillas/'+key;
    const label=element('label','Subir '+key+' (.csv)');
    const file=element('input');
    file.type='file';file.accept='.csv,text/csv';file.required=true;
    files[key]=file;
    label.append(file);
    form.append(download,label);
  }
  const dateLabel=element('label','Fecha de corte del análisis');
  const date=element('input');date.type='date';date.required=true;
  dateLabel.append(date);
  const syntheticLabel=element('label','Confirmo que las tres planillas contienen solo datos ficticios.');
  const synthetic=element('input');synthetic.type='checkbox';synthetic.required=true;
  syntheticLabel.prepend(synthetic);
  const save=element('button','Guardar planillas');save.className='button primary';
  form.append(dateLabel,syntheticLabel,save);
  const result=paragraph(section,'');
  result.setAttribute('role','status');
  const render=data=>{
    date.value=data.asOf;
    summary.textContent=(data.savedAt?'Planillas guardadas. ':'Datos originales de la demo. ')+
      data.customers+' clientes · '+data.products+' productos · '+data.purchases+' compras.';
  };
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    save.disabled=true;
    try{
      const selected=Object.entries(files);
      if(selected.reduce((size,[,input])=>size+input.files[0].size,0)>900_000)
        throw Error('Las tres planillas juntas deben pesar menos de 900 KB.');
      const rows=await Promise.all(selected.map(async([key,input])=>[key,await input.files[0].text()]));
      render(await api('planillas',{...Object.fromEntries(rows),asOf:date.value,synthetic:synthetic.checked}));
      for(const input of Object.values(files))input.value='';
      synthetic.checked=false;
      result.textContent='Planillas guardadas y listas para una nueva prueba.';
    }catch(error){result.textContent=error.message;}
    finally{save.disabled=false;}
  });
  section.append(form,result);
  content.append(section);
  api('planillas').then(render).catch(error=>{summary.textContent=error.message;});
}

function appendApprovalHistory(){
  const historyLink=element('a','Historial de aprobaciones');
  historyLink.href='#historial-aprobaciones';
  content.append(historyLink);
  const historyPanel=element('section');
  historyPanel.id='historial-aprobaciones';
  const records=element('div','Cargando historial…');
  records.id='approval-records';
  historyPanel.append(element('h2','Historial de aprobaciones'),records);
  content.append(historyPanel);
  void refreshHistory();
}
async function session(){
  const {user,ids,canViewHistory,rehearsals,remote}=await api('session');
  notice.textContent='';
  content.replaceChildren();
  paragraph(content,user.name+' · '+user.role+' · Paperclip registra como local-board.');
  if(remote)paragraph(content,'Las campañas originales se pueden consultar. Usá las campañas de demostración para registrar una nueva decisión.');
  content.append(button('Cerrar sesión',async()=>{
    try{await api('logout',{});notice.textContent='Sesión cerrada.';login();}
    catch(error){notice.textContent=error.message;}
  }));
  if(canViewHistory){
    if(!remote){
      appendLoom(rehearsals);
      appendDemoSpreadsheets();
    }
    appendApprovalHistory();
    if(location.hash==='#datos-demo')document.querySelector('#datos-demo')?.scrollIntoView();
  }else{
    paragraph(content,remote?'El historial completo está disponible para Gerencia.':
      'Para cargar planillas o consultar quién aprobó una campaña, cerrá sesión e ingresá como Sofía Demo (Gerencia).');
  }
  const grid=element('div');grid.className='private-cards';
  content.append(grid);
  for(const id of ids){
    try{
      const card=await api('campaigns/'+id);
      if(grid.isConnected)display(grid,card);
    }catch(error){if(grid.isConnected)paragraph(grid,id+' · '+error.message);}
  }
}
session().catch(error=>{
  if(error.status!==401)notice.textContent='No se pudo comprobar la sesión. '+error.message;
  login();
});
