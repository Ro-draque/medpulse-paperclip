import fs from 'node:fs/promises';
const m=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8'));
const sandbox=process.argv.includes('--http-sandbox');
const mode=sandbox?'sandbox HTTP local':'dry-run';
const r=await fetch(`http://127.0.0.1:3100/api/companies/${m.companyId}/issues`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:`WhatsApp ${mode}: ejecutar y registrar handoff de ${m.tasks.outreach.identifier}`,description:JSON.stringify({kind:'medpulse-whatsapp-dry-run-v1',batch:m.batch,sourceTaskId:m.tasks.outreach.id,...(sandbox?{transport:'local_http_sandbox'}:{})}),status:'todo',priority:'high',assigneeAgentId:m.agents.outreach})});const task=await r.json();if(!r.ok)throw Error(JSON.stringify(task));console.log(JSON.stringify({taskId:task.id,identifier:task.identifier,sourceTask:m.tasks.outreach.identifier}));
