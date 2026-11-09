import test from 'node:test';
import assert from 'node:assert/strict';
import {findEdition,respiratoryContext,createDraft,campaignKey} from './instagram-campaign.mjs';

test('descubre una nueva edición desde el índice sin fijar el número de boletín',()=>{
  const edition=(number,week)=>`<h4>BEN ${number} SE ${week} (octubre 2026)</h4><a href="/${number}.pdf">Descargar BEN ${number}</a>`;
  assert.equal(findEdition(edition(832,42)).number,832);
  assert.equal(findEdition(edition(832,42)+edition(833,43)).week,43);
});
test('distingue contexto respiratorio de demanda y rechaza una semana diferente',()=>{
  const html='<p>4 de noviembre de 2026</p><p>(SE) 42: tendencia descendente en la circulación de virus respiratorios.</p>';
  const context=respiratoryContext(html,42,2026);
  assert.equal(context.signal,'descenso_posinvernal');
  assert.equal(context.demandTrend,'sin evidencia comercial');
  assert.throws(()=>respiratoryContext(html,43,2026));
  const report={productId:'P04',context,audience:'Compras',campaignKey};
  const product={id:'P04',name:'Barbijos tricapa, caja x50',stock:80};
  const draft=createDraft(report,product);
  assert.doesNotMatch(draft.copy,/\b80\b|brote|urgente|eficacia|previene/i);
  assert.throws(()=>createDraft(report,{...product,stock:0}));
  assert.throws(()=>createDraft(report,{...product,name:'Otro SKU'}));
});
