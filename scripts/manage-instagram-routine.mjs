import path from 'node:path';
import {trendMarker} from './instagram-discovery.mjs';

const base='http://127.0.0.1:3100';
const title='MEDPULSE · Tendencias sanitarias para Instagram';
async function api(route,method='GET',body){
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw Error(`${method} ${route}: HTTP ${response.status} ${JSON.stringify(value)}`);
  return value;
}
const company=(await api('/api/companies')).find(c=>c.name==='MEDPULSE');
const route='/api/companies/'+company.id;
const action=process.argv[2]??'status';
let routine=(await api(route+'/routines')).find(r=>r.title===title);
if(!routine&&['schedule','schedule-check'].includes(action)){
  const agents=await api(route+'/agents');
  const name='Health Trends Scanner';
  const root=path.resolve(import.meta.dirname,'..');
  const scanner=agents.find(a=>a.name===name)??await api(route+'/agents','POST',{
    name,role:'general',title:'Consulta determinista de fuentes sanitarias',adapterType:'process',
    adapterConfig:{command:process.execPath,args:[path.join(root,'scripts','instagram-discovery-worker.mjs')],cwd:root,timeoutSec:150},
    runtimeConfig:{heartbeat:{enabled:false,wakeOnDemand:true}}
  });
  await api('/api/agents/'+scanner.id+'/permissions','PATCH',{canCreateAgents:false,canAssignTasks:true});
  routine=await api(route+'/routines','POST',{title,assigneeAgentId:scanner.id,description:trendMarker+'\nConsulta de fuentes oficiales y auditoría de novedades.',concurrencyPolicy:'skip_if_active',catchUpPolicy:'skip_missed'});
}
if(!routine)throw Error('Configurar con schedule');
const item='/api/routines/'+routine.id;
if(action==='schedule'||action==='schedule-check'){
  const detail=await api(item);
  const existing=detail.triggers.find(t=>t.kind==='schedule'&&!t.archived);
  let fields={label:'Lun, mié y vie · 09:30 Argentina',cronExpression:'30 9 * * 1,3,5',timezone:'America/Argentina/Buenos_Aires',enabled:true};
  if(action==='schedule-check'){
    if(existing&&!process.argv.includes('--replace-temporarily'))throw Error('Ya hay un horario en esta rutina');
    const next=new Date(Date.now()+90000);
    fields={label:'Prueba por horario',cronExpression:`${next.getUTCMinutes()} ${next.getUTCHours()} ${next.getUTCDate()} ${next.getUTCMonth()+1} *`,timezone:'UTC',enabled:true};
  }
  const result=existing?await api('/api/routine-triggers/'+existing.id,'PATCH',fields):await api(item+'/triggers','POST',{kind:'schedule',...fields});
  const trigger=result.trigger??result;
  console.log(JSON.stringify({routineId:routine.id,triggerId:trigger.id,nextRunAt:trigger.nextRunAt,cron:trigger.cronExpression,timezone:trigger.timezone}));
}else if(action==='run'){
  if(!process.argv[3])throw Error('Indicar clave del intento');
  console.log(JSON.stringify(await api(item+'/run','POST',{idempotencyKey:process.argv[3]}),null,2));
}else if(action==='status'){
  const detail=await api(item),runs=await api(item+'/runs');
  console.log(JSON.stringify({id:routine.id,triggers:detail.triggers,runs},null,2));
}else throw Error('Usar schedule, schedule-check, run o status');
