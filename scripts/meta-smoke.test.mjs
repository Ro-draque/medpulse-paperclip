import test from 'node:test';import assert from 'node:assert/strict';
import {buildMetaPlan,executeMetaPlan} from './meta-smoke.mjs';
const now=new Date('2026-11-09T02:30:00Z');
const env={META_GRAPH_VERSION:'v99.0',META_WA_TEST_PHONE_ID:'123456',META_WA_TEST_RECIPIENT:'+15550101001',META_WA_ACCESS_TOKEN:'fake-for-mock-only',META_IG_USER_ID:'234567',META_IG_IMAGE_URL:'https://example.invalid/test.jpg',META_IG_PAGE_TOKEN:'fake-for-mock-only',MEDPULSE_META_ALLOW_LIVE:'1'};
test('Cualquier cambio de contenido o falta de aprobación bloquea toda llamada',async()=>{
 const p=buildMetaPlan('whatsapp',env,now),options={clock:now,record:()=>assert.fail('record called'),fetcher:()=>assert.fail('network called')};
 await assert.rejects(executeMetaPlan(p,null,env,options),/aprobación/);
 await assert.rejects(executeMetaPlan(p,p.id,{...env,META_WA_TEST_RECIPIENT:'+15550101002'},options),/cambiaron/);
 await assert.rejects(executeMetaPlan(p,p.id,env,{...options,clock:new Date(+now+3600000)}),/aprobación/);
});
test('WhatsApp solo prepara plantilla de prueba y distingue aceptación de entrega',async()=>{
 const p=buildMetaPlan('whatsapp',env,now),records=[];
 const r=await executeMetaPlan(p,p.id,env,{clock:now,record:(k,d)=>records.push([k,d]),fetcher:async(url,req)=>{assert.match(url,/graph\.facebook\.com\/v99\.0\/123456\/messages$/);assert.equal(JSON.parse(req.body).template.name,'hello_world');return Response.json({messages:[{id:'wamid.mock'}]});}});
 assert.deepEqual(records.map(x=>x[0]),['started','result']);assert.equal(r.deliveryVerified,false);
});
test('Instagram no publica hasta que Meta confirma contenedor listo',async()=>{
 const p=buildMetaPlan('instagram',env,now),calls=[];
 const mock=async(url,req)=>{calls.push(url);if(url.endsWith('/media')){assert.equal(req.body.get('image_url'),env.META_IG_IMAGE_URL);return Response.json({id:'1234567'});}if(url.includes('status_code'))return Response.json({status_code:'ERROR'});assert.fail('publish called');};
 await assert.rejects(executeMetaPlan(p,p.id,env,{clock:now,record:async()=>{},fetcher:mock}),/no publicable/);assert.equal(calls.length,2);
 calls.length=0;const r=await executeMetaPlan(p,p.id,env,{clock:now,record:async()=>{},fetcher:async(url,req)=>{calls.push(url);if(url.endsWith('/media'))return Response.json({id:'1234567'});if(url.includes('status_code'))return Response.json({status_code:'FINISHED'});assert.equal(req.body.get('creation_id'),'1234567');return Response.json({id:'2345678'});}});assert.equal(r.mediaId,'2345678');assert.equal(calls.length,3);
});
