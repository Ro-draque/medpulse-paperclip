import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const numbers=(v,name)=>{if(!/^\d{5,30}$/.test(v??''))throw Error(`Completar ${name} con el ID de Meta`);return v;};
const caption='Prueba técnica de MEDPULSE: señales comerciales trazables y revisión humana. Demostración sin oferta de productos.';
export function buildMetaPlan(channel,env,now=new Date()){
 const version=env.META_GRAPH_VERSION;if(!/^v\d+\.\d+$/.test(version??''))throw Error('Completar META_GRAPH_VERSION con la versión del panel Meta');
 const base='https://graph.facebook.com/'+version;
 let requests,target;
 if(channel==='whatsapp'){
  const phoneId=numbers(env.META_WA_TEST_PHONE_ID,'META_WA_TEST_PHONE_ID');
  if(!/^\+?[1-9]\d{7,14}$/.test(env.META_WA_TEST_RECIPIENT??''))throw Error('Completar META_WA_TEST_RECIPIENT con el número verificado y su código de país');
  const to=env.META_WA_TEST_RECIPIENT.replace(/^\+/,'');target='número verificado terminado en '+to.slice(-4);
  requests=[{path:`${base}/${phoneId}/messages`,body:{messaging_product:'whatsapp',to,type:'template',template:{name:'hello_world',language:{code:'en_US'}}}}];
 }else if(channel==='instagram'){
  const ig=numbers(env.META_IG_USER_ID,'META_IG_USER_ID');
  const image=new URL(env.META_IG_IMAGE_URL??'');if(image.protocol!=='https:'||image.username||image.password||image.search||image.hash||!(/\.jpe?g$/i).test(image.pathname)||!image.hostname.includes('.')||/^(?:localhost|\d)/i.test(image.hostname))throw Error('Usar una URL HTTPS pública de JPEG, sin credenciales ni parámetros');
  const text=env.META_IG_CAPTION??caption;if(!text.trim()||text.length>2200)throw Error('Caption fuera de rango');
  target='cuenta profesional ID '+ig;
  requests=[{path:`${base}/${ig}/media`,body:{image_url:image.href,caption:text}},{path:`${base}/${ig}/media_publish`,body:{creation_id:'<CONTENEDOR_VALIDADO>'}}];
 }else throw Error('Canal inválido');
 const plan={schema:'medpulse.meta-smoke.v1',channel,target,mode:'dry_run',createdAt:now.toISOString(),expiresAt:new Date(+now+60*60000).toISOString(),requests};return {...plan,id:hash(plan)};
}
export function assertApproved(plan,id,env,now=new Date()){
 const {id:stored,...body}=plan;
 if(!id||id!==stored||id!==hash(body)||env.MEDPULSE_META_ALLOW_LIVE!=='1'||+now>=Date.parse(plan.expiresAt))throw Error('No hay aprobación válida para este plan exacto. No se llamó a Meta.');
 const configured=buildMetaPlan(plan.channel,env,new Date(plan.createdAt));if(configured.id!==id)throw Error('La cuenta, el destinatario o el contenido cambiaron desde la revisión');
}
async function graph(url,token,body,fetcher){
 const r=await fetcher(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:body?new URLSearchParams(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
 const v=await r.json().catch(()=>({}));if(!r.ok||v.error)throw Error(`Meta HTTP ${r.status}; code=${Number(v.error?.code)||'unknown'}; subcode=${Number(v.error?.error_subcode)||'unknown'}`);return v;
}
export async function executeMetaPlan(plan,id,env,{fetcher=fetch,record,clock=new Date(),pause=wait}={}){
 assertApproved(plan,id,env,clock);const token=env[plan.channel==='whatsapp'?'META_WA_ACCESS_TOKEN':'META_IG_PAGE_TOKEN'];if(!token||!record)throw Error('Token y registro de prueba local requeridos');
 // Reserve before the first write. A timeout/ambiguous outcome must never auto-retry.
 await record('started',{planId:id,channel:plan.channel});
 if(plan.channel==='whatsapp'){
  const req=plan.requests[0],r=await fetcher(req.path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(req.body),redirect:'error',signal:AbortSignal.timeout(20000)});
  const v=await r.json().catch(()=>({}));if(!r.ok||v.error)throw Error(`Meta HTTP ${r.status}; code=${Number(v.error?.code)||'unknown'}`);const messageId=v.messages?.[0]?.id;if(!messageId)throw Error('Meta response missing message ID; verify before retry');
  const result={status:'accepted_by_api',messageId,deliveryVerified:false};await record('result',result);return result;
 }
 const [create,publish]=plan.requests,base=new URL(create.path).origin+'/'+new URL(create.path).pathname.split('/')[1];
 const {id:container}=await graph(create.path,token,create.body,fetcher);numbers(container,'container ID');await record('container',{container});
 let ready=false;for(let i=0;i<6;i++){
  const state=await graph(`${base}/${container}?fields=status_code`,token,null,fetcher);
  if(state.status_code==='FINISHED'){ready=true;break;}
  if(state.status_code!=='IN_PROGRESS')throw Error('Contenedor no publicable; consultar estado en Meta');
  await pause(3000);
 }
 if(!ready)throw Error('Contenedor no confirmado; no se publicó');
 const {id:mediaId}=await graph(publish.path,token,{creation_id:container},fetcher);numbers(mediaId,'media ID');
 const result={status:'published_by_api',mediaId,container};await record('result',result);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const [channel,action='plan',approval]=process.argv.slice(2),dir='delivery-local/meta';await fs.mkdir(dir,{recursive:true});
 if(!['whatsapp','instagram'].includes(channel))throw Error('Usar whatsapp o instagram');
 const file=path.join(dir,channel+'-plan.json');
 if(action==='plan'){
  const plan=buildMetaPlan(channel,process.env);await fs.writeFile(file,JSON.stringify(plan,null,2)+'\n');
  console.log(JSON.stringify({channel,target:plan.target,mode:'dry_run',id:plan.id,expiresAt:plan.expiresAt,content:channel==='whatsapp'?'Plantilla hello_world / en_US':plan.requests[0].body,networkRequests:0},null,2));
 }else if(action==='execute'){
  const plan=JSON.parse(await fs.readFile(file,'utf8'));if(plan.channel!==channel)throw Error('Plan incompatible');
  const record=(kind,data)=>fs.writeFile(path.join(dir,plan.id+'-'+kind+'.json'),JSON.stringify({...data,at:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
  try{console.log(JSON.stringify(await executeMetaPlan(plan,approval?.replace(/^--approve=/,''),process.env,{record}),null,2));}
  catch(e){if(e.code==='EEXIST')throw Error('Ya hay un intento registrado. Confirmar su resultado antes de generar otro plan.');throw e;}
 }else throw Error('Usar plan o execute');
}
