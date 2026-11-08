import fs from 'node:fs/promises';
import path from 'node:path';
const m=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8')),base='http://127.0.0.1:3100';
async function get(route){const r=await fetch(base+route);if(!r.ok)throw Error(`${route}: ${r.status}`);return r.json();}
const tasks=[];
const agents=await get(`/api/companies/${m.companyId}/agents`);
for(const [stage,t]of Object.entries(m.tasks)){
 const task=await get(`/api/issues/${t.id}`),comments=await get(`/api/issues/${t.id}/comments`),docs=await get(`/api/issues/${t.id}/documents`);
 tasks.push({stage,id:t.id,identifier:task.identifier,status:task.status,assigneeAgentId:task.assigneeAgentId,assigneeUserId:task.assigneeUserId,blockedBy:task.blockedBy,executionPolicy:task.executionPolicy,executionState:task.executionState,completedAt:task.completedAt,comments,documents:docs});
}
const runs=(await get(`/api/companies/${m.companyId}/heartbeat-runs`)).filter(r=>Object.values(m.tasks).some(t=>t.id===r.issueId)).map(r=>({id:r.id,issueId:r.issueId,agentId:r.agentId,status:r.status,startedAt:r.startedAt,finishedAt:r.finishedAt,exitCode:r.exitCode,error:r.error,...(r.status==='failed'?{stderr:r.resultJson?.stderr,stdout:r.resultJson?.stdout?.slice(-3500)}:{})}));
const snapshot={batch:m.batch,capturedAt:new Date().toISOString(),tasks,runs};
await fs.writeFile(path.join('evidence/growth',m.batch,'paperclip-status.json'),JSON.stringify(snapshot,null,2));
console.log(JSON.stringify({batch:m.batch,agents:agents.filter(a=>Object.values(m.agents).includes(a.id)).map(a=>({name:a.name,status:a.status,lifecycleState:a.lifecycleState,error:a.errorReason})),tasks:tasks.map(t=>({stage:t.stage,identifier:t.identifier,status:t.status,documents:Array.isArray(t.documents)?t.documents.length:undefined,comments:t.comments.length,review:t.executionState})),runs},null,2));
