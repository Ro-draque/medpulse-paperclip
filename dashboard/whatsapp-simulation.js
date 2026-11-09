'use strict';

function whatsappSimulation({revision, message, recipient}) {
  const make=(tag,value,className)=>{
    const el=document.createElement(tag);
    if(value!==undefined)el.textContent=value;
    if(className)el.className=className;
    return el;
  };
  const open=make('button','Ver simulación de envío','button secondary');
  open.type='button';
  const status=make('p',undefined,'muted');
  status.setAttribute('role','status');
  const wrapper=make('div',undefined,'simulation-entry');
  wrapper.append(open,status);
  open.addEventListener('click',async()=>{
    open.disabled=true;
    status.textContent='';
    try{
      const response=await fetch('/data/whatsapp-sandbox.json',{cache:'no-store'});
      if(!response.ok)throw Error('Recibo no disponible.');
      const receipt=await response.json();
      const success=receipt.http?.cases?.find(entry=>entry.name==='success');
      const text=success?.request?.body?.text?.body;
      const simulatedId=success?.response?.body?.messages?.[0]?.id;
      if(receipt.taskIdentifier!=='MED-22'||receipt.sourceIdentifier!=='MED-6'||
        receipt.http?.environment!=='local_http_sandbox'||receipt.runStatus!=='succeeded'||
        receipt.transport?.messagesSent!==0||receipt.transport.networkRequestsToMeta!==0||
        success?.response?.status!==200||success.response.body.simulated!==true||
        !text||!simulatedId||simulatedId!==receipt.http.simulatedMessageId)
        throw Error('El recibo no contiene un resultado de simulación verificable.');
      const sameRevision=receipt.sourceDocumentRevisionId===revision;
      const destination=sameRevision&&recipient
        ? recipient+' · destinatario ficticio'
        : success.request.body.to+' · destinatario ficticio';
      const dialog=make('dialog',undefined,'simulation-dialog');
      dialog.setAttribute('aria-label','Simulación de envío de WhatsApp');
      const heading=make('div',undefined,'dialog-heading');
      const close=make('button','×');
      close.type='button';
      close.setAttribute('aria-label','Cerrar simulación');
      close.addEventListener('click',()=>dialog.close());
      heading.append(make('h2','Simulación de envío · MED-22'),close);
      const chat=make('div',undefined,'simulation-chat');
      chat.append(make('strong',destination),make('p',text,'simulation-bubble'));
      const date=new Intl.DateTimeFormat('es-AR',{
        dateStyle:'medium',timeStyle:'medium',timeZone:'America/Argentina/Buenos_Aires',
      }).format(new Date(receipt.executedAt));
      const details=make('details',undefined,'technical-details');
      details.append(make('summary','Ver detalles técnicos','button secondary'),
        make('p','Revisión de MED-6 utilizada: '+receipt.sourceDocumentRevisionId,'simulation-reference'),
        make('p','Recibo: '+receipt.receiptId,'simulation-reference'),
        make('p','Identificador simulado: '+simulatedId,'simulation-reference'));
      const names={invalid_payload:'Payload inválido',http_failure:'Fallo HTTP controlado',success:'Solicitud válida',replay:'Repetición idempotente'};
      for(const entry of receipt.http.cases){
        details.append(make('h3',(names[entry.name]??entry.name)+' · HTTP '+entry.response.status),
          make('pre',JSON.stringify({fecha:entry.at,solicitud:entry.request,respuesta:entry.response},null,2)));
      }
      details.append(make('p','Efectos simulados nuevos registrados: '+receipt.http.newSimulatedEffects+'. En la repetición, la respuesta conservó el identificador simulado.'));
      dialog.append(heading,make('p','Prueba de envío exitosa','simulation-result'),chat,
        make('p','El simulador local aceptó la solicitud. No se envió ningún WhatsApp real ni se llamó a Meta.'),
        make('p',sameRevision&&text===message?'El texto y la revisión coinciden con el borrador que estás viendo.':
          'Esta vista conserva el texto de la ejecución histórica. La revisión o el texto difieren del borrador que estás viendo.'),
        make('p','Fecha de ejecución: '+date+' (hora argentina)'),
        details);
      dialog.addEventListener('close',()=>{dialog.remove();open.focus();});
      document.body.append(dialog);
      dialog.showModal();
    }catch(error){status.textContent='No se pudo abrir la simulación. '+error.message;}
    finally{open.disabled=false;}
  });
  return wrapper;
}
