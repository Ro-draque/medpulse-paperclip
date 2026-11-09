import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startSandbox,runSandboxCases,sandboxRoute,sandboxRecipient} from './whatsapp-http-sandbox.mjs';
const payload={messaging_product:'whatsapp',to:sandboxRecipient,type:'text',text:{body:'Consulta ficticia'}};
async function temp(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'medpulse-wa-'));
  t.after(async()=>{
    for(const file of await fs.readdir(dir))await fs.unlink(path.join(dir,file));
    await fs.rmdir(dir);
  });
  return dir;
}
test('ejecuta los cuatro casos por HTTP y conserva idempotencia al reiniciar',async t=>{
  const dir=await temp(t);
  const first=await runSandboxCases(payload,'revision-1',dir);
  const second=await runSandboxCases(payload,'revision-1',dir);
  assert.deepEqual(first.cases.map(c=>c.response.status),[400,503,200,200]);
  assert.equal(first.newSimulatedEffects,1);
  assert.equal(second.newSimulatedEffects,0);
  assert.equal(second.simulatedMessageId,first.simulatedMessageId);
  assert.equal((await fs.readdir(dir)).length,1);
});
test('valida método, ruta, JSON, destinatario y conflicto de idempotencia',async t=>{
  const sandbox=await startSandbox(await temp(t));
  try{
    const url=sandbox.origin+sandboxRoute;
    const post=(body,endpoint=url)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'a'.repeat(64)},body});
    assert.equal((await fetch(url)).status,405);
    assert.equal((await post('{}',sandbox.origin+'/otra')).status,404);
    assert.equal((await post('{')).status,400);
    assert.equal((await post(JSON.stringify({...payload,to:'12345'}))).status,400);
    assert.equal((await post(JSON.stringify(payload))).status,200);
    assert.equal((await post(JSON.stringify({...payload,text:{body:'distinto'}}))).status,409);
    assert.equal(sandbox.effects(),1);
  }finally{await sandbox.close();}
});
