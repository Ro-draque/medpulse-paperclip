import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {approvals,auth,employees,openStore,provision} from './approvals-core.mjs';

test('tres cuentas, contraseña incorrecta, sesión, salida y límite de intentos',()=>{
  const db=openStore(':memory:');
  const access=auth(db);
  const users=provision(db);
  assert.equal(new Set(users.map(user=>user.password)).size,3);
  for(const user of users){
    const session=access.login(user.id,user.password);
    assert.equal(access.user(session).id,user.id);
    access.logout(session);
    assert.equal(access.user(session),null);
  }
  for(let i=0;i<10;i++)assert.throws(()=>access.login('sofia','incorrecta'),{status:401});
  assert.throws(()=>access.login('sofia',users[2].password),{status:429});
  db.close();
});
function fixture(db){
  const comments=[];
  const task={id:'fixture',title:'fixture',status:'in_review',executionState:{
    status:'pending',currentStageType:'approval',currentStageId:'stage',currentParticipant:{type:'user',userId:'local-board'},
  }};
  const doc={body:'{"message":"borrador"}',latestRevisionId:'revision1'};
  let calls=0;
  const failures={};
  async function api(route,method,body){
    if(route.endsWith('/result'))return {...doc};
    if(route.endsWith('/comments'))return comments;
    if(method==='PATCH'){
      calls++;
      if(failures.before)throw Error('conexión interrumpida antes de escribir');
      task.status=body.status;
      task.executionState={...task.executionState,status:body.status==='done'?'completed':'changes_requested',
        lastDecisionId:'decision-'+calls,lastDecisionOutcome:body.status==='done'?'approved':'changes_requested'};
      comments.push({authorUserId:'local-board',body:body.comment});
      if(failures.concurrent)doc.latestRevisionId='revision2';
      if(failures.after)throw Error('conexión interrumpida después de escribir');
    }
    if(failures.unavailable)throw Error('Paperclip no disponible');
    return structuredClone(task);
  }
  const center=approvals(db,api);
  return {api,center,failures,doc,calls:()=>calls};
}
const id='MED-6';
const input=async (center,action='approve')=>{
  const {hash,revision}=await center.view(id);
  return {hash,revision,action,comment:'Revisión de prueba'};
};

test('valida identidad, comentario, revisión y doble clic',async()=>{
  const db=openStore(':memory:');
  const {center,doc,calls}=fixture(db);
  const decision=await input(center);
  await assert.rejects(center.decide(id,decision,{id:'agent'}),{status:403});
  await assert.rejects(center.decide(id,{...decision,comment:42},employees[0]),{status:400});
  doc.latestRevisionId='revision2';
  await assert.rejects(center.decide(id,decision,employees[0]),{status:409});
  assert.equal(calls(),0);
  const newDecision={...await input(center),comment:' '};
  const outcomes=await Promise.allSettled([center.decide(id,newDecision,employees[0]),center.decide(id,newDecision,employees[1])]);
  assert.equal(outcomes[0].value.paperclipId,'decision-1');
  assert.equal(outcomes[0].value.comment,'');
  assert.equal(outcomes[1].reason.status,409);
  assert.equal(calls(),1);
  db.close();
});

test('edición concurrente durante la escritura bloquea la ficha y conserva el conflicto',async()=>{
  const db=openStore(':memory:');
  const {center,failures}=fixture(db);
  failures.concurrent=true;
  await assert.rejects(center.decide(id,await input(center),employees[0]),{status:409});
  const view=await center.view(id);
  assert.equal(view.canDecide,false);
  assert.equal(view.history[0].phase,'conflict');
  assert.equal(view.history[0].revision,'revision1');
  db.close();
});

test('servicio caído antes de la lectura no escribe ni bloquea un reintento posterior',async()=>{
  const db=openStore(':memory:');
  const {center,failures,calls}=fixture(db);
  const decision=await input(center);
  failures.unavailable=true;
  await assert.rejects(center.decide(id,decision,employees[1]),/no disponible/);
  failures.unavailable=false;
  assert.equal(calls(),0);
  assert.equal((await center.view(id)).canDecide,true);
  db.close();
});

test('desconexión antes de escribir conserva el bloqueo ante resultado no comprobable',async()=>{
  const db=openStore(':memory:');
  const {center,failures,calls}=fixture(db);
  const decision=await input(center);
  failures.before=true;
  await assert.rejects(center.decide(id,decision,employees[1]),{status:503});
  await assert.rejects(center.reconcile(id,employees[1]),{status:503});
  await assert.rejects(center.decide(id,decision,employees[1]),{status:409});
  assert.equal(calls(),1);
  db.close();
});

test('desconexión después de escribir: conciliación sin nuevo PATCH y persistencia tras reinicio',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'medpulse-review-'));
  const file=path.join(dir,'demo.sqlite');
  let db=openStore(file);
  try{
    const {center,failures,api,calls}=fixture(db);
    failures.after=true;
    await assert.rejects(center.decide(id,await input(center,'changes'),employees[2]),{status:503});
    db.close();
    db=openStore(file);
    const restarted=approvals(db,api);
    const row=await restarted.reconcile(id,employees[2]);
    assert.equal(row.paperclipId,'decision-1');
    assert.equal(row.employee,'Sofía Demo');
    assert.equal(row.phase,'confirmed');
    assert.equal(row.paperclipStatus,'in_progress');
    assert.equal(calls(),1);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
