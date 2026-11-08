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
