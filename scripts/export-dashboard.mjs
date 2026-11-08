import fs from 'node:fs/promises';import path from 'node:path';
import assert from 'node:assert/strict';
import {hash} from './growth-core.mjs';import {unwrapDocument} from './review-support.mjs';
const base='http://127.0.0.1:3100',m=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8')),h=JSON.parse(await fs.readFile('evidence/latest-handoff.json','utf8'));
async function get(route){const r=await fetch(base+route);if(!r.ok)throw Error(`${route}: ${r.status}`);return r.json();}
const health=await get('/api/health'),agents=await get(`/api/companies/${m.companyId}/agents`),allRuns=await get(`/api/companies/${m.companyId}/heartbeat-runs`);
const tasks=[];
for(const [stage,ref]of Object.entries({...m.tasks,handoff:{id:h.taskId}})){
 const t=await get(`/api/issues/${ref.id}`);tasks.push({stage,id:t.id,identifier:t.identifier,title:t.title,status:t.status,assigneeAgentId:t.assigneeAgentId,humanAssigned:!!t.assigneeUserId,completedAt:t.completedAt,sourceTaskIds:t.blockedBy.map(b=>b.id),approval:t.executionState?{status:t.executionState.status,stage:t.executionState.currentStageType,lastOutcome:t.executionState.lastDecisionOutcome,decisionId:t.executionState.lastDecisionId,humanParticipant:t.executionState.currentParticipant?.type==='user'}:null});
}
const runs=allRuns.filter(r=>tasks.some(t=>t.id===r.issueId)).map(r=>({id:r.id,taskId:r.issueId,agentId:r.agentId,status:r.status,startedAt:r.startedAt,finishedAt:r.finishedAt,exitCode:r.exitCode,durationSeconds:r.startedAt&&r.finishedAt?Math.round((Date.parse(r.finishedAt)-Date.parse(r.startedAt))/1000):null,errorCode:r.errorCode}));
const sales=unwrapDocument(await get(`/api/issues/${m.tasks.sales.id}/documents/result`)),strategy=unwrapDocument(await get(`/api/issues/${m.tasks.strategy.id}/documents/result`)),campaignDoc=await get(`/api/issues/${m.tasks.outreach.id}/documents/result`),campaign=unwrapDocument(campaignDoc);
const handoff=unwrapDocument(await get(`/api/issues/${h.taskId}/documents/receipt`));
assert.equal(handoff.paperclipRunId,h.runId);assert.equal(handoff.sourceTaskId,m.tasks.outreach.id);assert.equal(handoff.sourceCampaignHash,hash(campaign));assert.equal(runs.find(r=>r.id===h.runId)?.status,'succeeded');assert.equal(handoff.transport.messagesSent,0);
const revisions=await get(`/api/issues/${m.tasks.outreach.id}/documents/result/revisions`),comments=await get(`/api/issues/${m.tasks.outreach.id}/comments`);
let historical,original,originalReceipt,hasReviewCycle=true;
try{
 historical=JSON.parse(await fs.readFile(path.join('evidence/growth',m.batch,'review-fix/verification.json'),'utf8'));
 original=JSON.parse(await fs.readFile(path.join('evidence/growth',m.batch,'review-fix/original-published-document.json'),'utf8'));
 originalReceipt=JSON.parse(await fs.readFile(path.join('evidence/growth',m.batch,'review-fix/original-403-receipt.json'),'utf8'));
}catch(e){
 if(e.code!=='ENOENT')throw e;hasReviewCycle=false;original=campaignDoc;
 let receiptDir=path.join('evidence/growth',m.batch);try{receiptDir=JSON.parse(await fs.readFile(path.join(receiptDir,'outreach-latest.json'),'utf8')).directory}catch(error){if(error.code!=='ENOENT')throw error;}
 originalReceipt=JSON.parse(await fs.readFile(path.join(receiptDir,'outreach-receipt.json'),'utf8'));
 historical={verifiedAt:originalReceipt.finishedAt,status:originalReceipt.transitionStatus,approval:'pending_not_granted',formalChangesDecisionId:null,newRevisionId:campaignDoc.latestRevisionId,message:campaign.message,runId:originalReceipt.runId,newAgentCloseStatus:originalReceipt.approvalGateTest.secondAgentCloseHttpStatus};
}
assert.equal(hash(unwrapDocument(original)),originalReceipt.resultHash);
const humanComment=hasReviewCycle?comments.find(c=>c.id===historical.originalCommentId):{id:null,createdAt:null,body:null};assert.ok(humanComment);
const snapshot={schema:'medpulse.public-evidence.v1',exportedAt:new Date().toISOString(),source:{system:'Paperclip',version:health.version,batch:m.batch,mode:'read_only_snapshot',live:false},dataKind:{execution:'real',commercial:'synthetic',asOf:sales.as_of,externalMarketSource:false},agents:agents.filter(a=>Object.values(m.agents).includes(a.id)).map(a=>({id:a.id,name:a.name,title:a.title,adapter:a.adapterType,reportsTo:a.reportsTo,status:a.status})),tasks,runs,opportunities:sales.opportunities,exclusions:sales.exclusions,scoreFormula:sales.score_formula,decision:strategy.decision,campaign:{revisionId:campaignDoc.latestRevisionId,recipient:campaign.recipient.name,contact:campaign.recipient.contact,sender:campaign.sender.display_name,product:campaign.product.name,message:campaign.message,mode:campaign.mode,messagesSent:campaign.messages_sent,sendable:campaign.payload.sendable},handoff:{receiptId:handoff.receiptId,taskId:h.taskId,runId:h.runId,sourceTaskId:handoff.sourceTaskId,sourceDocumentRevisionId:handoff.sourceDocumentRevisionId,executedAt:handoff.executedAt,outcome:handoff.outcome,adapter:handoff.adapter,requestHash:handoff.requestHash,campaignHash:handoff.sourceCampaignHash,transport:handoff.transport,validation:handoff.validation,limitations:handoff.limitations},review:{original:{revisionId:original.latestRevisionId,message:unwrapDocument(original).message},request:{commentId:humanComment.id,at:humanComment.createdAt,text:humanComment.body},formalDecisionId:historical.formalChangesDecisionId,version2:{revisionId:historical.newRevisionId,message:historical.message,runId:historical.runId},pendingEvidence:{capturedAt:historical.verifiedAt,status:historical.status,approval:historical.approval},originalAgentCloseHttpStatus:originalReceipt.approvalGateTest.secondAgentCloseHttpStatus,newAgentCloseHttpStatus:historical.newAgentCloseStatus,revisionIds:revisions.map(r=>r.id)},limitations:['Snapshot exportado: no controla Paperclip ni actualiza automáticamente el estado.','Datos comerciales ficticios; las ejecuciones y revisiones son reales.','Handoff local ejecutado: no se contactó a Meta y no hay mensajes entregados.','Market Intelligence y fuentes externas pendientes.']};
if(!hasReviewCycle){snapshot.review.request=null;snapshot.review.version2=null;}
const serialized=JSON.stringify(snapshot,null,2)+'\n';
if(/C:[\\/]|Users[\\/]|Bearer |sk-[a-zA-Z0-9]{15}|access_token|refresh_token|auth\.json/i.test(serialized))throw Error('Unsafe export rejected');
await fs.mkdir('dashboard/data',{recursive:true});await fs.writeFile('dashboard/data/paperclip.json',serialized);
console.log(JSON.stringify({exportedAt:snapshot.exportedAt,tasks:tasks.length,runs:runs.length,approval:tasks.find(t=>t.stage==='outreach').approval,receipt:snapshot.handoff.receiptId}));
