import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {hash} from './growth-core.mjs';
import {unwrapDocument} from './review-support.mjs';
const base='http://127.0.0.1:3100';
async function get(route){
  const response=await fetch(base+route,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(`${route}: HTTP ${response.status}`);
  return response.json();
}
const pointer=JSON.parse(await fs.readFile('evidence/latest-http-handoff.json','utf8'));
const [task,run,doc]=await Promise.all([
  get('/api/issues/'+pointer.taskId),get('/api/heartbeat-runs/'+pointer.runId),
  get('/api/issues/'+pointer.taskId+'/documents/receipt')
]);
const receipt=unwrapDocument(doc);
const [source,sourceDoc]=await Promise.all([get('/api/issues/'+receipt.sourceTaskId),get('/api/issues/'+receipt.sourceTaskId+'/documents/result')]);
assert.equal(task.status,'done');
assert.equal(run.status,'succeeded');
assert.equal(receipt.paperclipRunId,pointer.runId);
assert.equal(receipt.taskId,task.id);
assert.equal(source.status,'in_review');
assert.equal(source.executionState.status,'pending');
assert.equal(receipt.sourceDocumentRevisionId,sourceDoc.latestRevisionId);
assert.equal(receipt.sourceCampaignHash,hash(unwrapDocument(sourceDoc)));
assert.equal(receipt.http.environment,'local_http_sandbox');
assert.equal(receipt.transport.networkRequestsToMeta,0);
assert.equal(receipt.transport.messagesSent,0);
assert.deepEqual(receipt.http.cases.map(c=>c.response.status),[400,503,200,200]);
assert.ok(receipt.http.cases.every(c=>new URL(c.request.url).hostname==='127.0.0.1'));
const attachments=await get('/api/issues/'+task.id+'/attachments');
const attachment=attachments.find(a=>a.originalFilename==='whatsapp-dry-run-receipt.json' || a.filename==='whatsapp-dry-run-receipt.json');
assert.ok(attachment,'El recibo JSON debe estar adjunto');
assert.deepEqual(await get('/api/attachments/'+attachment.id+'/content'),receipt);
const snapshot={...receipt,verifiedAt:new Date().toISOString(),runStatus:run.status,receiptRevisionId:doc.latestRevisionId,receiptAttachmentId:attachment.id,review:{status:source.status,state:source.executionState.status}};
await fs.writeFile('dashboard/data/whatsapp-sandbox.json',JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({task:task.identifier,runId:run.id,runStatus:run.status,source:source.identifier,review:source.status,http:receipt.http.cases.map(c=>c.response.status),simulatedMessageId:receipt.http.simulatedMessageId,simulatedEffects:receipt.http.newSimulatedEffects}));
