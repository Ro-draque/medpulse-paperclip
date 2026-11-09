import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {hash} from './growth-core.mjs';

export const sandboxRoute='/v1/sandbox-phone/messages';
export const sandboxRecipient='<FICTIONAL_RECIPIENT_NOT_SENDABLE>';
const reply=(res,status,body)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));

export async function startSandbox(directory){
  await fs.mkdir(directory,{recursive:true});
  let effects=0;
  const server=http.createServer(async(req,res)=>{
    try{
      if(req.url!==sandboxRoute)return reply(res,404,{error:'sandbox_route_not_found'});
      if(req.method!=='POST')return reply(res,405,{error:'sandbox_post_required'});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return reply(res,415,{error:'sandbox_json_required'});
      let size=0;
      const chunks=[];
      for await(const chunk of req){
        size+=chunk.length;
        if(size>8192)return reply(res,413,{error:'sandbox_payload_too_large'});
        chunks.push(chunk);
      }
      let body;
      try{body=JSON.parse(Buffer.concat(chunks));}catch{return reply(res,400,{error:'sandbox_invalid_json'});}
      if(body?.messaging_product!=='whatsapp'||body.to!==sandboxRecipient||body.type!=='text'||typeof body.text?.body!=='string'||!body.text.body.trim()||body.text.body.length>4096){
        return reply(res,400,{error:'sandbox_invalid_whatsapp_payload'});
      }
      const key=req.headers['idempotency-key'];
      if(!/^[a-f0-9]{64}$/.test(key??''))return reply(res,400,{error:'sandbox_idempotency_key_required'});
      if(req.headers['x-sandbox-fault']==='503')return reply(res,503,{error:'sandbox_injected_failure',simulated:true});
      const payloadHash=hash(body);
      const record={payloadHash,response:{messaging_product:'whatsapp',messages:[{id:'simulated.whatsapp.'+key.slice(0,24)}],simulated:true}};
      const file=path.join(directory,key+'.json');
      try{
        await fs.writeFile(file,JSON.stringify(record),{flag:'wx'});
        effects++;
        return reply(res,200,{...record.response,replayed:false});
      }catch(error){
        if(error.code!=='EEXIST')throw error;
        const saved=JSON.parse(await fs.readFile(file,'utf8'));
        if(saved.payloadHash!==payloadHash)return reply(res,409,{error:'sandbox_idempotency_conflict'});
        return reply(res,200,{...saved.response,replayed:true});
      }
    }catch{
      if(!res.headersSent)reply(res,500,{error:'sandbox_internal_error'});
      else res.destroy();
    }
  });
  server.requestTimeout=5000;
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return {origin:'http://127.0.0.1:'+server.address().port,effects:()=>effects,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}

export async function runSandboxCases(payload,revisionId,directory){
  const sandbox=await startSandbox(directory);
  const key=hash(['whatsapp-http-sandbox-v1',revisionId,payload]);
  async function exchange(name,body,fault=false){
    const at=new Date().toISOString();
    const headers={'Content-Type':'application/json','Idempotency-Key':key,...(fault?{'X-Sandbox-Fault':'503'}:{})};
    const url=sandbox.origin+sandboxRoute;
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});
    return {name,at,request:{method:'POST',url,headers,body},response:{status:response.status,body:await response.json()}};
  }
  try{
    const invalid=await exchange('invalid_payload',{...payload,text:{}});
    const failure=await exchange('http_failure',payload,true);
    const success=await exchange('success',payload);
    const repeated=await exchange('replay',payload);
    const cases=[invalid,failure,success,repeated];
    const simulatedMessageId=success.response.body.messages?.[0]?.id;
    if(cases.some((c,i)=>c.response.status!==[400,503,200,200][i])
      ||!simulatedMessageId?.startsWith('simulated.whatsapp.')
      ||repeated.response.body.messages?.[0]?.id!==simulatedMessageId
      ||repeated.response.body.replayed!==true
      ||sandbox.effects()!==(success.response.body.replayed?0:1))throw Error('El sandbox no superó la verificación HTTP');
    return {environment:'local_http_sandbox',cases,simulatedMessageId,newSimulatedEffects:sandbox.effects()};
  }finally{await sandbox.close();}
}
