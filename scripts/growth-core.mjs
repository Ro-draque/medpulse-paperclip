import crypto from 'node:crypto';
export const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const days = (a,b) => Math.round((Date.parse(a)-Date.parse(b))/86400000);
export function analyze(d) {
  const opportunities=[], exclusions=[];
  for(const c of d.customers) {
    const orders=d.purchases.filter(o=>o.customer_id===c.id);
    for(const p of d.products) {
      const history=orders.filter(o=>o.product_id===p.id).sort((a,b)=>a.date.localeCompare(b.date));
      if(history.length<2) continue;
      const intervals=history.slice(1).map((o,i)=>days(o.date,history[i].date)).sort((a,b)=>a-b);
      const n=intervals.length, interval=n%2?intervals[(n-1)/2]:(intervals[n/2-1]+intervals[n/2])/2;
      const last=history.at(-1), elapsed=days(d.as_of,last.date), overdue=elapsed-interval;
      const reason=!c.consent.valid?'Sin consentimiento comercial':p.stock<last.quantity?'Stock insuficiente':overdue<=0?'Recompra aún no vencida':null;
      const evidence={purchase_ids:history.map(o=>o.id),last_purchase:last.date,elapsed_days:elapsed,median_interval_days:interval,overdue_days:overdue,stock:p.stock,quantity:last.quantity};
      if(reason){exclusions.push({customer_id:c.id,product_id:p.id,reason,evidence});continue;}
      opportunities.push({id:`REORDER-${c.id}-${p.id}`,type:'reorder',customer_id:c.id,product_id:p.id,quantity:last.quantity,estimated_order_ars:last.quantity*p.price_ars,evidence,score:Math.round(40+30*Math.min(overdue/interval,1)+20+10)});
      for(const pid of p.complements) {
        const cp=d.products.find(x=>x.id===pid);
        if(cp?.stock>=1&&!orders.some(o=>o.product_id===pid)) opportunities.push({id:`CROSS-${c.id}-${pid}`,type:'cross_sell',customer_id:c.id,product_id:pid,quantity:1,estimated_order_ars:cp.price_ars,score:55,evidence:{purchase_ids:[last.id],complement_of:p.id,stock:cp.stock,quantity:1,hypothesis:'Complementariedad definida en catálogo sintético; no demuestra propensión de compra.'}});
      }
    }
  }
  return {dataset_kind:d.dataset_kind,as_of:d.as_of,dataset_hash:hash(d),opportunities:opportunities.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),exclusions,score_formula:'Recompra: 40 base + 30*min(días_vencidos/intervalo,1) + 20 stock suficiente + 10 consentimiento. Cross-sell: 55 fijo, hipótesis. Heurística 0–100; no probabilidad.',limitations:['Datos totalmente sintéticos','Sin fuentes externas en esta etapa','Importe potencial bruto; no venta ni beneficio obtenido']};
}
export function validateDataset(d) {
  if(d.dataset_kind!=='synthetic'||!/^\d{4}-\d{2}-\d{2}$/.test(d.as_of)) throw Error('Dataset metadata invalid');
  const unique=xs=>new Set(xs.map(x=>x.id)).size===xs.length;
  if(!unique(d.customers)||!unique(d.products)||!unique(d.purchases))throw Error('Duplicate IDs');
  for(const c of d.customers) if(c.consent.valid&&(!c.consent.date||c.consent.date>d.as_of))throw Error('Invalid consent');
  for(const p of d.products) if(p.stock<0||p.price_ars<=0||p.complements.some(id=>!d.products.some(x=>x.id===id)))throw Error('Invalid product');
  for(const o of d.purchases) if(!d.customers.some(c=>c.id===o.customer_id)||!d.products.some(p=>p.id===o.product_id)||o.date>d.as_of||o.quantity<=0||o.unit_price_ars<=0)throw Error('Invalid purchase');
  return d;
}
export function validateChoice(choice, report, d) {
  if(!['whatsapp','instagram','none'].includes(choice.channel))throw Error('Invalid channel');
  if(choice.channel==='none')return null;
  const o=report.opportunities.find(o=>o.id===choice.opportunity_id);
  if(!o)throw Error('Unknown opportunity');
  const c=d.customers.find(c=>c.id===o.customer_id),p=d.products.find(p=>p.id===o.product_id);
  if(p.stock<o.quantity)throw Error('Insufficient stock');
  if(choice.channel==='whatsapp'&&!c.consent.valid)throw Error('Consent required');
  if(['why_whatsapp','why_instagram','why_none'].some(k=>!choice[k]?.trim()))throw Error('Missing channel comparison');
  return o;
}
