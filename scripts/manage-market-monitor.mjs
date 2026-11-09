const base='http://127.0.0.1:3100';
const title='MEDPULSE · Monitoreo de compras públicas';
async function api(route,method='GET',body){
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(`${method} ${route}: HTTP ${response.status} ${JSON.stringify(result)}`);
  return result;
}
const company=(await api('/api/companies')).find(c=>c.name==='MEDPULSE');
if(!company)throw Error('No se encontró MEDPULSE');
const route=`/api/companies/${company.id}/routines`;
const list=await api(route);
let routine=list.find(r=>r.title===title);
const action=process.argv[2]??'status';
if(!routine&&action==='run'){
  const agent=(await api(`/api/companies/${company.id}/agents`)).find(a=>a.name==='Market Intelligence Analyst');
  if(!agent)throw Error('No se encontró Market Intelligence Analyst');
  routine=await api(route,'POST',{title,assigneeAgentId:agent.id,description:'MEDPULSE_MARKET_MONITOR_V1\nConsulta pública y comparación de expedientes. Sin llamadas a modelos ni acciones comerciales.',concurrencyPolicy:'skip_if_active',catchUpPolicy:'skip_missed'});
}
if(!routine)throw Error('Primero verificar con run');
const item='/api/routines/'+routine.id;
if(action==='run'){
  const key=process.argv[3];
  if(!key)throw Error('Indicar clave de ejecución manual');
  console.log(JSON.stringify(await api(item+'/run','POST',{idempotencyKey:key}),null,2));
}else if(action==='schedule'||action==='schedule-check'){
  const detail=await api(item);
  if(!Array.isArray(detail.triggers))throw Error('No se pudo leer la configuración de horarios');
  const existing=detail.triggers.find(t=>t.kind==='schedule'&&!t.archived);
  let fields={label:'Días hábiles · 09:00 Argentina',cronExpression:'0 9 * * 1-5',timezone:'America/Argentina/Buenos_Aires',enabled:true};
  if(action==='schedule-check'){
    if(existing)throw Error('Ya existe un horario');
    const next=new Date(Date.now()+90000);
    fields={label:'Prueba de disparo programado',cronExpression:`${next.getUTCMinutes()} ${next.getUTCHours()} ${next.getUTCDate()} ${next.getUTCMonth()+1} *`,timezone:'UTC',enabled:true};
  }
  const trigger=existing?await api('/api/routine-triggers/'+existing.id,'PATCH',fields):await api(item+'/triggers','POST',{kind:'schedule',...fields});
  console.log(JSON.stringify({routineId:routine.id,trigger},null,2));
}else if(action==='status'){
  const detail=await api(item), runs=await api(item+'/runs');
  console.log(JSON.stringify({detail,runs},null,2));
}else throw Error('Usar run, schedule o status');
