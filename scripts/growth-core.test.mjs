import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {analyze,validateDataset,validateChoice} from './growth-core.mjs';
const data=JSON.parse(await fs.readFile(new URL('../data/distributor.json',import.meta.url),'utf8'));
test('Recompra usa mediana histórica y conserva compras de evidencia',()=>{
 const r=analyze(validateDataset(data)),o=r.opportunities.find(x=>x.id==='REORDER-C01-P01');
 assert.equal(o.evidence.median_interval_days,30);assert.equal(o.evidence.elapsed_days,49);assert.equal(o.evidence.overdue_days,19);assert.equal(o.quantity,12);assert.equal(o.estimated_order_ars,102000);assert.equal(o.score,89);assert.equal(o.evidence.purchase_ids.length,3);
 assert.ok(r.opportunities.some(x=>x.id==='CROSS-C01-P02'));
});
test('No propone campañas a clientes sin consentimiento, stock insuficiente ni recompra anticipada',()=>{
 const r=analyze(data);assert.ok(r.opportunities.every(x=>!['C03','C04','C05'].includes(x.customer_id)));
 assert.ok(r.exclusions.some(x=>x.customer_id==='C03'&&x.reason.includes('consentimiento')));
 assert.ok(r.exclusions.some(x=>x.customer_id==='C04'&&x.reason.includes('Stock')));
});
test('Revalida stock y consentimiento al seleccionar, aunque el informe previo era válido',()=>{
 const r=analyze(data),c={channel:'whatsapp',opportunity_id:'REORDER-C01-P01',why_whatsapp:'recompra',why_instagram:'no captación',why_none:'evidencia suficiente'};
 const changed=structuredClone(data);changed.customers[0].consent.valid=false;assert.throws(()=>validateChoice(c,r,changed),/Consent/);
 changed.customers[0].consent.valid=true;changed.products[0].stock=0;assert.throws(()=>validateChoice(c,r,changed),/stock/);
 assert.throws(()=>validateChoice({...c,opportunity_id:'inventada'},r,data),/Unknown/);
});
test('Rechaza referencias rotas y fechas posteriores al corte',()=>{
 const bad=structuredClone(data);bad.purchases[0].customer_id='missing';assert.throws(()=>validateDataset(bad));
 bad.purchases[0]= {...data.purchases[0],date:'2027-01-01'};assert.throws(()=>validateDataset(bad));
});
