import crypto from 'node:crypto';
import {analyze,hash} from './growth-core.mjs';
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function textOf(html){return html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&#x([\da-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(+v)).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();}
export function parseSearch(html,query){
 return [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map(([article])=>{
  const heading=article.match(/<h[1-6]\b[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const published=article.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})"/i)?.[1];
  if(!heading||!published)throw Error('Official search markup changed: missing title/date');
  const url=new URL(heading[1]);if(url.origin!=='https://compras.tierradelfuego.gob.ar'||!/^\d+$/.test(url.searchParams.get('p')||''))throw Error('Unexpected official article URL');
  return {id:`TDF-${url.searchParams.get('p')}`,url:url.href,title:textOf(heading[2]),publishedAt:published,query,excerpt:textOf(article),sourceKind:'official_public_procurement',dataKind:'real'};
 });
}
export function classifySignal(record,asOf){
 const age=Math.floor((Date.parse(asOf)-Date.parse(record.publishedAt))/86400000);
 if(!Number.isFinite(age)||age<0)throw Error('Invalid publication date');
 const historical=/adjudicaci[oó]n|adjudicada|preadjudicaci[oó]n/i.test(record.title);
 // A category called "apertura próxima" is not proof that the deadline is still open.
 const deadline=record.deadline??null;
 return {ageDays:age,status:historical?'historical_award':deadline&&deadline.date<asOf?'historical_expired':'deadline_unverified',deadline,openTenderVerified:false,demandConfirmedForDistributor:false,trendEstablished:false};
}
export function extractDeadline(html){
 const m=textOf(html).match(/FECHA (?:L[IÍ]MITE PARA LA PRESENTACI[ÓO]N|DE RECEPCI[ÓO]N) DE OFERTAS\s*:\s*[^\d]{0,30}(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^\d]{0,35}(\d{2}:\d{2}))?/i);
 if(!m)return null;
 const date=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 if(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Invalid source deadline');
 return {date,time:m[4]??null,zone:'America/Argentina/Ushuaia'};
}
export const SCORE_FORMULA={version:'opportunity-score-v1',meaning:'Índice de prioridad por reglas, 0–100; no es probabilidad de compra ni estimación de ventas.',components:{evidence:35,productFit:25,freshness:15,stock:15,actionability:10},rules:{evidence:'Fuente oficial de compra 35; recompra interna con >=2 compras 30; complementariedad interna 20.',productFit:'Producto interno exacto 25; coincidencia de familia externa 15, exige verificar especificación.',freshness:'<=30 días 15; 31–90 días 10; 91–180 días 5; >180 días 0. Internas: fecha de la última compra.',stock:'Stock sintético suficiente 15; insuficiente 0.',actionability:'Interna con consentimiento 10. Externa solo con plazo abierto verificado 10; de otro modo 0.'}};
export function scoreOpportunity(components){
 if(Object.keys(components).length!==Object.keys(SCORE_FORMULA.components).length)throw Error('Unexpected score components');
 for(const [k,max]of Object.entries(SCORE_FORMULA.components))if(!Number.isFinite(components[k])||components[k]<0||components[k]>max)throw Error(`Invalid score component ${k}`);
 return {total:Object.values(components).reduce((a,b)=>a+b,0),components,formulaVersion:SCORE_FORMULA.version,notProbability:true};
}
const freshness=age=>age<=30?15:age<=90?10:age<=180?5:0;
export function marketFindings(records,d,asOf){
 return records.flatMap(r=>{
  const term=/nitrilo/i.test(r.title)?'nitrilo':/gasas/i.test(r.title)?'gasas':null;
  if(!term)return [];
  return d.products.filter(p=>p.name.toLowerCase().includes(term)).map(p=>{
   const classification=classifySignal(r,asOf);
   const limitations=['Coincidencia de familia, no equivalencia técnica: verificar pliego, presentación, certificaciones y logística.','El aviso no acredita demanda de los clientes sintéticos ni un pedido a la distribuidora.','No se verificó plazo vigente; no presentar ofertas ni contactar al organismo automáticamente.','Una muestra acotada de avisos no demuestra una tendencia de mercado.'];
   return {id:`EXT-${r.id}-${p.id}`,origin:'external',type:'public_procurement_signal',product_id:p.id,customer_id:null,quantity:null,title:r.title,sourceIds:[r.id],sources:[{id:r.id,url:r.url,publishedAt:r.publishedAt,retrievedAt:r.retrievedAt,evidenceSha256:r.detailSha256,evidenceAttachmentId:r.evidenceAttachmentId}],classification,match:'family_only',dataKinds:{signal:'real',catalogStockPrices:'synthetic'},score:scoreOpportunity({evidence:35,productFit:15,freshness:freshness(classification.ageDays),stock:p.stock>0?15:0,actionability:0}),limitations,recommendedNextStep:'Verificar estado y especificaciones del proceso; usar como contexto comercial, sin atribuir intención de compra a un cliente.',recommendedChannel:'none',approval:'not_requested_no_execution'};
  });
 });
}
export function combinedOpportunities(d,marketReport){
 if(marketReport.datasetHash!==hash(d))throw Error('Market handoff dataset mismatch');
 const internal=analyze(d);
 const opportunities=internal.opportunities.map(o=>{
  const customer=d.customers.find(c=>c.id===o.customer_id),p=d.products.find(p=>p.id===o.product_id);
  const last=d.purchases.filter(x=>x.customer_id===customer.id).map(x=>x.date).sort().at(-1);
  const age=Math.floor((Date.parse(d.as_of)-Date.parse(last))/86400000);
  return {...o,legacyScore:o.score,origin:'internal',score:scoreOpportunity({evidence:o.type==='reorder'?30:20,productFit:25,freshness:freshness(age),stock:p.stock>=o.quantity?15:0,actionability:customer.consent.valid?10:0}),sources:[{kind:'synthetic_purchase_history',datasetHash:hash(d),purchaseIds:o.evidence.purchase_ids}],externalContextIds:marketReport.findings.filter(f=>f.product_id===o.product_id).map(f=>f.id),dataKinds:{customer:'synthetic',purchases:'synthetic',consent:'synthetic'}};
 });
 return {opportunities:[...opportunities,...marketReport.findings].sort((a,b)=>b.score.total-a.score.total||a.id.localeCompare(b.id)),exclusions:internal.exclusions,scoreFormula:SCORE_FORMULA};
}
export function validateMarketDecision(decision,report,d){
 const best=report.opportunities[0];if(decision.selectedOpportunityId!==best.id)throw Error('Decision must respect published score ranking');
 if(!['whatsapp','instagram','both','none'].includes(decision.channel))throw Error('Invalid channel');
 if(['whyWhatsapp','whyInstagram','whyBoth','whyNone','reason'].some(k=>!decision[k]?.trim()))throw Error('Missing channel rationale');
 if(['whatsapp','both'].includes(decision.channel)){
  const c=d.customers.find(c=>c.id===best.customer_id);if(!c?.consent.valid||best.origin!=='internal')throw Error('No consented recipient for WhatsApp');
 }
 if(best.origin==='external'&&decision.channel!=='none')throw Error('Unverified procurement signal cannot trigger outreach');
 const external=report.opportunities.filter(o=>o.origin==='external').sort((a,b)=>b.score.total-a.score.total||a.id.localeCompare(b.id))[0];
 if(decision.externalRecommendation.opportunityId!==external?.id||decision.externalRecommendation.channel!=='none')throw Error('External recommendation must hold outreach until verification');
 return best;
}
