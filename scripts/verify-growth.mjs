import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {hash} from './growth-core.mjs';
const m=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8')),base='http://127.0.0.1:3100',dir=path.join('evidence/growth',m.batch);
async function get(route){const r=await fetch(base+route);assert.equal(r.status,200);return r.json();}
const runs=await get(`/api/companies/${m.companyId}/heartbeat-runs`),checks=[];
let previous=null;
for(const [stage,t] of Object.entries(m.tasks)){
 let stageDir=dir;try{stageDir=JSON.parse(await fs.readFile(path.join(dir,`${stage}-latest.json`),'utf8')).directory}catch(e){if(e.code!=='ENOENT')throw e;}
 const task=await get(`/api/issues/${t.id}`),doc=await get(`/api/issues/${t.id}/documents/result`),attachments=await get(`/api/issues/${t.id}/attachments`);
 const receipt=JSON.parse(await fs.readFile(path.join(stageDir,`${stage}-receipt.json`),'utf8'));
 const execution=JSON.parse(await fs.readFile(path.join(stageDir,`${stage}-execution.json`),'utf8'));
 const result=JSON.parse(await fs.readFile(path.join(stageDir,`${stage}-result.json`),'utf8'));
 const registered=JSON.parse(doc.body.replace(/^```json\s*|\s*```$/g,''));
 assert.equal(hash(registered),hash(result));assert.equal(receipt.resultHash,hash(result));assert.equal(doc.createdByAgentId,m.agents[stage]);assert.ok(execution.codexThreadId);
 assert.equal(receipt.sourceTaskId,previous);if(previous)assert.ok(task.blockedBy.some(b=>b.id===previous));
 const run=runs.find(r=>r.id===receipt.runId);assert.equal(run?.status,'succeeded');assert.equal(run.exitCode,0);assert.ok(attachments.length>0);
 if(stage==='outreach'){
   assert.equal(task.status,'in_review');assert.equal(task.assigneeUserId,'local-board');assert.equal(task.executionState.currentStageType,'approval');assert.equal(task.executionState.currentParticipant.type,'user');assert.equal(task.executionState.status,'pending');assert.notEqual(task.executionState.lastDecisionOutcome,'approved');
   assert.equal(receipt.approvalGateTest.secondAgentCloseHttpStatus,403);assert.equal(result.messages_sent,0);assert.equal(result.payload.sendable,false);
 }else assert.equal(task.status,'done');
 checks.push({stage,identifier:task.identifier,taskStatus:task.status,runId:run.id,runStatus:run.status,codexThreadId:execution.codexThreadId,documentId:doc.id,attachmentIds:attachments.map(a=>a.id),sourceTaskId:previous,artifactHash:hash(result)});previous=t.id;
}
const evidence={batch:m.batch,verifiedAt:new Date().toISOString(),checks,humanApproval:'pending_not_granted',messagesSent:0};await fs.writeFile(path.join(dir,'verification-latest.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
