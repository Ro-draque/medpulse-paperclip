import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const d=JSON.parse(await fs.readFile(new URL('../dashboard/data/paperclip.json',import.meta.url),'utf8'));
test('El recibo público se vincula a una ejecución exitosa y a MED-6',()=>{
 const run=d.runs.find(r=>r.id===d.handoff.runId);assert.equal(run.status,'succeeded');assert.equal(run.taskId,d.handoff.taskId);assert.equal(d.tasks.find(t=>t.id===d.handoff.sourceTaskId).stage,'outreach');assert.equal(d.handoff.sourceDocumentRevisionId,d.campaign.revisionId);assert.equal(d.handoff.transport.messagesSent,0);assert.equal(d.handoff.transport.networkRequestsToMeta,0);
});
test('Conserva versión 1, pedido humano, versión 2 y evidencia pendiente',()=>{
 assert.ok(d.review.revisionIds.includes(d.review.original.revisionId));
 if(d.review.version2){assert.notEqual(d.review.original.revisionId,d.review.version2.revisionId);assert.ok(d.review.revisionIds.includes(d.review.version2.revisionId));assert.match(d.review.request.text,/Solicito cambios/);}else assert.equal(d.review.request,null);
 assert.equal(d.review.pendingEvidence.status,'in_review');assert.equal(d.review.originalAgentCloseHttpStatus,403);assert.equal(d.review.newAgentCloseHttpStatus,403);
});
test('La exportación pública no contiene credenciales, emails o rutas de usuario',()=>{
 assert.doesNotMatch(JSON.stringify(d),/C:[\\/]|Users[\\/]|Bearer |sk-[a-zA-Z0-9]{15}|access_token|refresh_token|auth\.json|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
 assert.equal(d.source.live,false);assert.equal(d.dataKind.execution,'real');assert.equal(d.dataKind.commercial,'synthetic');
});
test('Vercel despliega únicamente el directorio estático',async()=>{
 const v=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url),'utf8'));assert.equal(v.outputDirectory,'dist/dashboard');assert.equal(v.buildCommand,'node scripts/build-dashboard.mjs');assert.equal(Object.keys(JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8')).dependencies||{}).length,0);
});
test('La segunda demo exporta el handoff real, los plazos históricos y puntajes verificables',async()=>{
 const market=JSON.parse(await fs.readFile(new URL('../dashboard/data/market.json',import.meta.url),'utf8'));
 assert.equal(market.agents.length,5);assert.equal(market.tasks.length,3);
 for(const t of market.tasks)assert.ok(market.runs.some(r=>r.id===t.runId&&r.taskId===t.id&&r.status==='succeeded'));
 assert.ok(market.runs.some(r=>r.status==='failed'&&r.taskId===market.tasks.find(t=>t.stage==='sales').id));
 assert.equal(market.originalCampaign.id,d.tasks.find(t=>t.stage==='outreach').id);
 assert.equal(market.messagesSent,0);assert.equal(market.approval,'not_granted');
 const ext=market.opportunities.filter(o=>o.origin==='external');assert.equal(ext.length,market.source.records);
 for(const o of market.opportunities){
  assert.equal(o.score.total,Object.values(o.score.components).reduce((a,b)=>a+b,0));assert.equal(o.score.notProbability,true);
  if(o.origin==='external'){assert.equal(o.classification.openTenderVerified,false);assert.equal(o.score.components.actionability,0);assert.match(o.sources[0].evidenceSha256,/^[a-f0-9]{64}$/);assert.equal(new URL(o.sources[0].url).hostname,'compras.tierradelfuego.gob.ar');}
 }
 assert.ok(ext.some(o=>o.classification.status==='historical_expired'&&o.classification.deadline.date<market.source.asOf));assert.equal(market.decision.externalRecommendation.channel,'none');
});
