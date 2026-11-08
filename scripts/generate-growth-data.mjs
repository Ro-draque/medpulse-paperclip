import fs from 'node:fs/promises';
import {validateDataset} from './growth-core.mjs';
const customers=[
 ['C01','Clínica Horizonte Demo','Clínica','Ana Demo',true],['C02','Consultorios del Parque Demo','Consultorio','Luis Demo',true],['C03','Centro Asistencial Sur Demo','Centro médico','Eva Demo',false],['C04','Laboratorio Río Demo','Laboratorio','Pablo Demo',true],['C05','Residencia Los Tilos Demo','Residencia','Marta Demo',true],['C06','Centro Médico Norte Demo','Centro médico','Lucía Demo',false]
].map(([id,name,segment,contact,valid])=>({id,name,segment,contact,recipient_ref:`FICTITIOUS-${id}`,email:`${id.toLowerCase()}@example.invalid`,consent:{valid,date:valid?'2026-07-01':null,source:valid?'Registro sintético de opt-in B2B':'No otorgado'}}));
const products=[
 {id:'P01',name:'Guantes de nitrilo, caja x100',category:'Protección',unit:'caja',price_ars:8500,stock:120,complements:['P02']},
 {id:'P02',name:'Gasas estériles, paquete x100',category:'Curación',unit:'paquete',price_ars:6200,stock:150,complements:[]},
 {id:'P03',name:'Jeringas descartables 5 ml, caja x100',category:'Descartables',unit:'caja',price_ars:12500,stock:0,complements:[]},
 {id:'P04',name:'Barbijos tricapa, caja x50',category:'Protección',unit:'caja',price_ars:4200,stock:80,complements:[]}
];
const rows=[['C01','P01','2026-07-22',10],['C01','P01','2026-08-21',10],['C01','P01','2026-09-20',12],['C02','P02','2026-08-26',6],['C02','P02','2026-09-25',6],['C02','P02','2026-10-25',6],['C03','P01','2026-08-02',8],['C03','P01','2026-09-01',8],['C04','P03','2026-08-16',4],['C04','P03','2026-09-15',4],['C05','P01','2026-09-10',5],['C05','P01','2026-10-10',5],['C05','P04','2026-10-10',3]];
const purchases=rows.map(([customer_id,product_id,date,quantity],i)=>({id:`ORD-${String(i+1).padStart(3,'0')}`,customer_id,product_id,date,quantity,unit_price_ars:products.find(p=>p.id===product_id).price_ars}));
const d=validateDataset({schema_version:1,dataset_kind:'synthetic',as_of:'2026-11-08',currency:'ARS',stock_as_of:'2026-11-08',note:'Todas las entidades, precios, stock y consentimientos son ficticios. No son cotizaciones reales.',customers,products,purchases});
await fs.mkdir('data',{recursive:true});await fs.writeFile('data/distributor.json',JSON.stringify(d,null,2)+'\n');console.log(`Dataset validado: ${customers.length} clientes, ${products.length} productos, ${purchases.length} compras.`);
