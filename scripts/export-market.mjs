import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {hash} from './growth-core.mjs';import {unwrapDocument} from './review-support.mjs';
const m=JSON.parse(await fs.readFile('evidence/latest-market.json','utf8'));
const dir=path.join('evidence/market',m.batch),v=JSON.parse(await fs.readFile(path.join(dir,'verification.json'),'utf8'));
assert.equal(v.batch,m.batch);const base='http://127.0.0.1:3100';
async function get(route){const r=await fetch(base+route);if(!r.ok)throw Error(`${r.status} ${route}`);return r.json();}
const d=JSON.parse(await fs.readFile(m.datasetPath,'utf8'));assert.equal(hash(d),m.datasetHash);
const reports={},tasks=[];for(const [stage,t]of Object.entries(v.tasks)){
 const current=await get('/api/issues/'+t.id);assert.equal(current.status,'done');
 const run=v.runs.find(r=>r.taskId===t.id&&r.status==='succeeded');
 const receipt=JSON.parse(await fs.readFile(path.join(dir,'runs',run.id,'receipt.json'),'utf8'));
 const doc=await get('/api/issues/'+t.id+'/documents/result');assert.equal(doc.latestRevisionId,receipt.documentRevisionId);
 const result=unwrapDocument(doc);assert.equal(hash(result),receipt.resultHash);reports[stage]=result;
 tasks.push({stage,...t,runId:run.id,documentRevisionId:doc.latestRevisionId,resultHash:receipt.resultHash});
}
const companyAgents=await get('/api/companies/'+m.companyId+'/agents');
const agents=companyAgents.filter(a=>Object.values(m.agents).includes(a.id)).map(a=>({id:a.id,name:a.name,adapter:a.adapterType}));assert.equal(agents.length,5);
const source=JSON.parse(await fs.readFile(m.sourceManifestPath,'utf8'));assert.equal(hash(source),m.sourceManifestHash);
const {market,sales,strategy}=reports;
const opportunities=sales.opportunities.map(o=>{
 const product=d.products.find(p=>p.id===o.product_id),customer=d.customers.find(c=>c.id===o.customer_id);
 return {id:o.id,origin:o.origin,type:o.type,product:{id:product.id,name:product.name,syntheticStock:product.stock,unit:product.unit},customer:customer?{id:customer.id,name:customer.name,segment:customer.segment,synthetic:true}:null,score:o.score,sources:o.sources,evidence:o.evidence,classification:o.classification,externalContextIds:o.externalContextIds,limitations:o.limitations,certainty:o.origin==='external'?'Documento oficial verificado; alcance comercial sin confirmar':o.type==='reorder'?'Patrón en historial sintético':'Hipótesis de complementariedad sintética',recommendedNextStep:o.recommendedNextStep,sourceTitle:o.title};
});
const snapshot={schema:'medpulse.market-public.v1',exportedAt:new Date().toISOString(),batch:m.batch,source:{provider:market.sourceProvider,url:source.sourceUrl,asOf:market.sourceAsOf,retrievedAt:source.retrievedAt,manifestHash:m.sourceManifestHash,sampling:market.sampling,records:market.records.length,importSeconds:source.elapsedSeconds,apiProbeStatus:source.attempts.find(a=>a.file==='api-probe.html')?.httpStatus??null},agents,tasks,runs:v.runs,opportunities,scoreFormula:sales.scoreFormula,salesInterpretation:sales.interpretation,marketInterpretation:market.interpretation,decision:strategy.decision,originalCampaign:v.originalCampaign,messagesSent:strategy.messagesSent,approval:strategy.approval,mode:strategy.mode};
const serialized=JSON.stringify(snapshot,null,2)+'\n';if(/C:[\\/]|Users[\\/]|Bearer |sk-[a-zA-Z0-9]{15}|access_token|refresh_token|auth\.json|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(serialized))throw Error('Unsafe public market export');
await fs.writeFile('dashboard/data/market.json',serialized);console.log(JSON.stringify({tasks:tasks.map(t=>t.identifier),records:market.records.length,opportunities:opportunities.length,approval:strategy.approval,messagesSent:strategy.messagesSent}));
