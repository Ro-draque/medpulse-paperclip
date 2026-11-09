import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const m=JSON.parse(await fs.readFile('evidence/latest-market.json','utf8'));
const base='http://127.0.0.1:3100',id=m.tasks.sales.id;
async function api(route,body){const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const result=await r.json();if(!r.ok)throw Error(`${r.status} ${route}: ${JSON.stringify(result)}`);return result;}
const dir=path.join('evidence/market',m.batch,'recovery');await fs.mkdir(dir,{recursive:true});
let task=await api('/api/issues/'+id);
if(task.status!=='blocked'||!task.executionBlocker?.runId)throw Error('No blocked Sales run to recover');
const failedId=task.executionBlocker.runId,run=await api('/api/heartbeat-runs/'+failedId),log=await api('/api/heartbeat-runs/'+failedId+'/log');
if(run.status!=='failed'||!run.finishedAt||!log.content.includes('500 /api/issues/'+id+'/checkout')||task.documentSummaries.length)throw Error('Unexpected side effects; inspect manually');
await fs.writeFile(path.join(dir,'failed-checkout.json'),JSON.stringify({task,run,log},null,2));
const doc=await fetch(base+'/api/issues/'+id+'/documents/result');if(doc.status!==404)throw Error('Unexpected existing Sales result');
const evidence='El intento '+failedId+' terminó con exitCode 1 y HTTP 500 en checkout antes de abrir Codex, crear el informe o adjuntar resultados. El log y la ausencia de documento result se verificaron. Los cuatro adjuntos e informe de Market Intelligence permanecen intactos. Se evita repetir checkout cuando la ejecución ya tiene la tarea reclamada; no se modificó MED-6.';
for(let i=0;i<3&&task.executionBlocker?.recoveryActionId;i++){
 if(task.executionBlocker.runId!==failedId)throw Error('Another run requires separate reconciliation');
 const body={actionId:task.executionBlocker.recoveryActionId,outcome:'restored',sourceIssueStatus:'todo',resolutionNote:evidence,executionReconciliation:{runId:failedId,providerStopped:true,actionOutcome:'not_performed',outcomeEvidence:evidence}};
 const receipt=await api('/api/issues/'+id+'/recovery-actions/resolve',body);await fs.writeFile(path.join(dir,`resolve-${i}.json`),JSON.stringify(receipt,null,2));
 task=await api('/api/issues/'+id);
}
if(task.executionBlocker)throw Error('Paperclip still reports an execution blocker');
const runs=await api('/api/companies/'+m.companyId+'/heartbeat-runs');
if(task.status!=='done'&&!runs.some(r=>r.issueId===id&&['queued','running'].includes(r.status))){
 const receipt=await api('/api/issues/'+id+'/retry',{idempotencyKey:crypto.randomUUID(),observedRunId:task.interruption?.observedRunId??failedId});await fs.writeFile(path.join(dir,'retry.json'),JSON.stringify(receipt,null,2));
}
console.log(JSON.stringify({identifier:task.identifier,failedId,status:task.status,historyPreserved:true}));
