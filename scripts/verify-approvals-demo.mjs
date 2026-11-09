import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {originals,paperclip} from './approvals-core.mjs';

const ids=process.argv.slice(2);
assert.equal(ids.length,2,'Indicá dos tareas demo pendientes.');
assert.ok(ids.every(id=>/^MED-\d+$/.test(id)&&!originals.includes(id)));
assert.notEqual(...ids);
const origin='http://127.0.0.1:4174';
const credentials=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'MEDPULSE-Approvals','credenciales-demo.txt'),'utf8').trim().split(/\r?\n/);
const originalSnapshot=()=>Promise.all(originals.map(async id=>{
  const task=await paperclip('/api/issues/'+id);
  const doc=await paperclip('/api/issues/'+task.id+'/documents/result');
  return {id,status:task.status,updated:task.updatedAt,decision:task.executionState?.lastDecisionId,revision:doc.latestRevisionId};
}));
const before=await originalSnapshot();
async function request(route,{data,cookie,requestOrigin=origin}={}){
  const response=await fetch(origin+'/private/'+route,{
    ...(data!==undefined?{method:'POST',body:JSON.stringify(data)}:{}),
    headers:{Origin:requestOrigin,...(data!==undefined&&{'Content-Type':'application/json'}),...(cookie&&{Cookie:cookie})},
  });
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
}
assert.equal((await request('session')).status,401);
assert.equal((await request('campaigns/'+ids[0]+'/decide',{data:{}})).status,401);
assert.equal((await request('login',{data:{user:'valentina',password:'incorrecta'}})).status,401);
const sessions=[];
for(const line of credentials){
  const [,user,password]=line.split(' | ');
  const login=await request('login',{data:{user,password}});
  assert.equal(login.status,200);
  assert.equal(login.data.user.id,user);
  assert.match(login.cookie,/HttpOnly; Secure; SameSite=Strict/);
  sessions.push(login.cookie.split(';')[0]);
}
assert.equal(sessions.length,3);
assert.equal((await request('campaigns/'+ids[0]+'/decide',{cookie:sessions[0],data:{},requestOrigin:'http://example.invalid'})).status,403);
assert.equal((await request('campaigns/MED-1',{cookie:sessions[0]})).status,404);
for(const id of originals){
  const card=await request('campaigns/'+id,{cookie:sessions[2]});
  assert.equal(card.status,200,card.data.error);
  assert.equal(card.data.status,'in_review');
  assert.ok(card.data.revision);
  if(id!=='MED-6'){
    assert.ok(card.data.hasImage);
    const image=await fetch(origin+'/private/campaigns/'+id+'/image?revision='+card.data.revision,{headers:{Cookie:sessions[2]}});
    assert.equal(image.headers.get('content-type'),'image/jpeg');
    assert.ok((await image.arrayBuffer()).byteLength>0);
  }
}
const decisions=[];
for(let index=0;index<ids.length;index++){
  const id=ids[index],cookie=sessions[index];
  const card=await request('campaigns/'+id,{cookie});
  assert.ok(card.data.demo&&card.data.canDecide);
  const route='campaigns/'+id+'/decide';
  const data={action:index===0?'approve':'changes',comment:'Prueba aislada del centro de aprobaciones de MEDPULSE.',revision:card.data.revision,hash:card.data.hash};
  const stale=await request(route,{cookie,data:{...data,revision:'antigua'}});
  assert.equal(stale.status,409);
  const results=await Promise.all([request(route,{cookie,data}),request(route,{cookie,data})]);
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409],JSON.stringify(results.map(result=>result.data)));
  const receipt=results.find(result=>result.status===200).data;
  const task=await paperclip('/api/issues/'+id);
  assert.equal(task.executionState.lastDecisionId,receipt.paperclipId);
  assert.equal(task.executionState.lastDecisionOutcome,index===0?'approved':'changes_requested');
  const after=await request('campaigns/'+id,{cookie:sessions[2]});
  assert.equal(after.data.history.length,1);
  decisions.push({task:id,employee:receipt.employee,outcome:task.executionState.lastDecisionOutcome,
    decisionId:receipt.paperclipId,revision:receipt.revision,sha256:receipt.hash,at:receipt.at});
}
for(const cookie of sessions){
  assert.equal((await request('logout',{cookie,data:{}})).status,200);
  assert.equal((await request('session',{cookie})).status,401);
}
assert.deepEqual(await originalSnapshot(),before);
console.log(JSON.stringify({accountsVerified:3,technicalActor:'local-board',decisions,originalsUnchanged:before},null,2));
