import fs from 'node:fs';
import path from 'node:path';
import {validateDataset} from './growth-core.mjs';

const columns={
  clientes:['id','nombre','segmento','contacto','consentimiento','fecha_consentimiento'],
  productos:['id','nombre','categoria','unidad','precio_ars','stock','complementos'],
  compras:['id','cliente_id','producto_id','fecha','cantidad','precio_unitario_ars'],
};

export const demoDatabasePath=()=>path.join(process.env.LOCALAPPDATA,'MEDPULSE-Approvals','private.sqlite');
export const baseDemo=()=>JSON.parse(fs.readFileSync(new URL('../data/distributor.json',import.meta.url),'utf8'));
export const importedDemo=db=>db.prepare('SELECT dataset,saved_at FROM demo_spreadsheet WHERE id=1').get();

function readRows(text,key){
  if(typeof text!=='string')throw Error('Falta la planilla de '+key+'.');
  text=text.replace(/^\uFEFF/,'').trimEnd();
  const header=columns[key];
  const separator=text.split(/\r?\n/,1)[0].includes(';')?';':',';
  const field=new RegExp(`(?:"((?:[^"]|"")*)"|([^"${separator}\\r\\n]*))(${separator}|\\r\\n|\\n|\\r|$)`,'y');
  const rows=[];
  let row=[];
  let position=0;
  do{
    field.lastIndex=position;
    const match=field.exec(text);
    if(!match)throw Error('CSV inválido en '+key+', fila '+(rows.length+1)+'.');
    row.push((match[1]?.replaceAll('""','"')??match[2]).trim());
    position=field.lastIndex;
    if(match[3]!==separator){
      if(row.some(Boolean))rows.push(row);
      row=[];
    }
  }while(position<text.length||row.length);
  const first=rows.shift();
  if(first?.join('|')!==header.join('|'))throw Error('Encabezados incorrectos en '+key+'. Usá la planilla del centro.');
  return rows.map((values,index)=>{
    if(values.length!==header.length)throw Error('Cantidad de columnas incorrecta en '+key+', fila '+(index+2)+'.');
    return Object.fromEntries(header.map((name,i)=>[name,values[i]]));
  });
}

function date(value){
  const localized=value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(localized)value=localized[3]+'-'+localized[2].padStart(2,'0')+'-'+localized[1].padStart(2,'0');
  const parsed=new Date(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==value)
    throw Error('Fecha inválida. Usá AAAA-MM-DD o DD/MM/AAAA.');
  return value;
}
function number(value,minimum,integer=false){
  const n=Number(value.replace(',','.'));
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(value)||!Number.isFinite(n)||n<minimum||n>1e12||(integer&&!Number.isSafeInteger(n)))
    throw Error('Cantidad, stock o precio inválido. Usá números sin separador de miles.');
  return n;
}
function id(value){
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(value))throw Error('Usá códigos de hasta 40 letras, números, guiones o guiones bajos.');
  return value;
}
function label(value){
  if(!value||value.length>160||/^[=+@-]|[\x00-\x1f]/.test(value))throw Error('Nombre, segmento, contacto, categoría o unidad inválidos.');
  return value;
}
function consent(row){
  const choice=row.consentimiento.toLowerCase();
  if(!['sí','si','no'].includes(choice))throw Error('En consentimiento escribí Sí o No.');
  const valid=choice!=='no';
  return {valid,date:valid?date(row.fecha_consentimiento):null,source:valid?'Consentimiento ficticio de la planilla':'No otorgado'};
}

export function importDemo({asOf,clientes,productos,compras}){
  const as_of=date(asOf);
  const customers=readRows(clientes,'clientes').map(row=>({
    id:id(row.id),name:label(row.nombre),segment:label(row.segmento),contact:label(row.contacto),
    recipient_ref:'FICTITIOUS-'+row.id,email:row.id.toLowerCase()+'@example.invalid',consent:consent(row),
  }));
  const products=readRows(productos,'productos').map(row=>({
    id:id(row.id),name:label(row.nombre),category:label(row.categoria),unit:label(row.unidad),
    price_ars:number(row.precio_ars,0.01),stock:number(row.stock,0,true),
    complements:row.complementos?row.complementos.split('|').map(v=>id(v.trim())):[],
  }));
  const purchases=readRows(compras,'compras').map(row=>({
    id:id(row.id),customer_id:id(row.cliente_id),product_id:id(row.producto_id),date:date(row.fecha),
    quantity:number(row.cantidad,1,true),unit_price_ars:number(row.precio_unitario_ars,0.01),
  }));
  if(!customers.length||!products.length)throw Error('Agregá al menos un cliente y un producto.');
  try{
    return validateDataset({schema_version:1,dataset_kind:'synthetic',currency:'ARS',as_of,stock_as_of:as_of,
      note:'Datos ficticios cargados para una prueba privada.',customers,products,purchases});
  }catch(error){
    const messages={'Duplicate IDs':'Hay códigos duplicados.','Invalid consent':'La fecha de consentimiento supera el corte.',
      'Invalid product':'Un producto complementario no existe.','Invalid purchase':'Una compra referencia un cliente o producto inexistente, o su fecha supera el corte.'};
    throw Error(messages[error.message]??error.message);
  }
}

export function exportDemo(dataset,key){
  const header=columns[key];
  if(!header)return null;
  const entries={
    clientes:()=>dataset.customers.map(c=>[c.id,c.name,c.segment,c.contact,c.consent.valid?'Sí':'No',c.consent.date??'']),
    productos:()=>dataset.products.map(p=>[p.id,p.name,p.category,p.unit,p.price_ars,p.stock,p.complements.join('|')]),
    compras:()=>dataset.purchases.map(p=>[p.id,p.customer_id,p.product_id,p.date,p.quantity,p.unit_price_ars]),
  };
  const escape=value=>'"'+String(value).replaceAll('"','""')+'"';
  return '\uFEFF'+header.join(';')+'\r\n'+entries[key]().map(row=>row.map(escape).join(';')).join('\r\n')+'\r\n';
}
