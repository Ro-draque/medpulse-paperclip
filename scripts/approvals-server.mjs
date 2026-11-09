import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {approvals,auth,openStore,paperclipAt,problem,provision} from './approvals-core.mjs';
import {baseDemo,exportDemo,importDemo,importedDemo} from './demo-spreadsheet.mjs';
import {loomRehearsals} from './loom-rehearsal.mjs';

const home=path.join(process.env.LOCALAPPDATA,'MEDPULSE-Approvals');
const file=path.join(home,'private.sqlite');
if (!fs.existsSync(home)) throw Error('Primero ejecutá scripts/setup-approvals.ps1.');
const db=openStore(file);
if (process.argv[2]==='--setup') {
  const target=path.join(home,'credenciales-demo.txt');
  const descriptor=fs.openSync(target,'wx',0o600);
  try {
    const accounts=provision(db);
    fs.writeFileSync(descriptor,accounts.map(a=>a.name+' | '+a.id+' | '+a.password).join('\n')+'\n');
  } finally {fs.closeSync(descriptor);}
  process.exit(0);
}

const port=4174;
const host='127.0.0.1:'+port;
const origin='http://'+host;
const bridgePort=4175;
const bridgeSecret=process.env.MEDPULSE_REVIEW_BRIDGE_SECRET;
if(bridgeSecret&&!/^[a-f0-9]{64}$/.test(bridgeSecret))throw Error('Clave del puente inválida.');
const sessions=auth(db);
const remoteSessions=auth(db,true);
const center=approvals(db);
const loomPort=Number(process.env.MEDPULSE_LOOM_PAPERCLIP_PORT??3100);
if(!Number.isInteger(loomPort)||loomPort<1||loomPort>65535)throw Error('Puerto Paperclip de ensayo inválido.');
const loomApi=paperclipAt(loomPort);
const loomCenter=loomPort===3100?center:approvals(db,loomApi);
const loom=loomRehearsals(db,loomCenter,home,loomApi,loomPort);
db.exec('CREATE TABLE IF NOT EXISTS demo_spreadsheet (id INTEGER PRIMARY KEY CHECK(id=1), dataset TEXT NOT NULL, saved_at TEXT NOT NULL)');
const secureHeaders={
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.pdf':'application/pdf'};
const cookie=(value,age,remote)=> (remote?'__Host-':'')+'medpulse_review='+value+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+age;
const reply=(res,status,value,type='application/json; charset=utf-8',headers={})=>{
  res.writeHead(status,{'Content-Type':type,...secureHeaders,...headers});
  res.end(type.startsWith('application/json')&&!Buffer.isBuffer(value)?JSON.stringify(value):value);
};
async function body(req,limit=8192) {
  if (req.headers['content-type']!=='application/json') throw problem(415,'Formato inválido.');
  let bytes=0;
  const chunks=[];
  for await (const chunk of req) {
    bytes+=chunk.length;
    if (bytes>limit) throw problem(413,'Solicitud demasiado grande.');
    chunks.push(chunk);
  }
  try {
    const data=JSON.parse(Buffer.concat(chunks).toString());
    if (data && typeof data==='object' && !Array.isArray(data)) return data;
  } catch {}
  throw problem(400,'Solicitud inválida.');
}

async function handle(req,res,remote=false){
  try {
    if(remote){
      const supplied=req.headers['x-medpulse-bridge-secret'];
      if(typeof supplied!=='string'||!/^[a-f0-9]{64}$/.test(supplied)||
        !timingSafeEqual(Buffer.from(supplied),Buffer.from(bridgeSecret)))throw problem(403,'Puente no autorizado.');
    }else if(req.headers.host!==host) throw problem(403,'Usá la dirección local indicada.');
    const url=new URL(req.url,origin);
    const route=url.pathname;
    if(remote&&!route.startsWith('/private/'))throw problem(404,'Ruta desconocida.');
    const requestOrigin=remote?'https://medpulse-paperclip.vercel.app':origin;
    if(req.method!=='GET' && (req.method!=='POST'||req.headers.origin!==requestOrigin))
      throw problem(403,'Origen o método no permitido.');
    const sessionStore=remote?remoteSessions:sessions;
    const sessionPattern=remote?/(?:^|; )__Host-medpulse_review=([A-Za-z0-9_-]{43})(?:;|$)/:/(?:^|; )medpulse_review=([A-Za-z0-9_-]{43})(?:;|$)/;
    const value=req.headers.cookie?.match(sessionPattern)?.[1];
    const employee=sessionStore.user(value);
    if(req.method==='POST'&&route==='/private/login'){
      const {user,password}=await body(req);
      if(typeof user!=='string'||user.length>32||typeof password!=='string'||password.length>256)
        throw problem(400,'Ingresá usuario y contraseña.');
      const session=sessionStore.login(user,password);
      sessionStore.logout(value);
      return reply(res,200,{user:sessionStore.user(session)},undefined,{'Set-Cookie':cookie(session,28800,remote)});
    }
    if(route.startsWith('/private/')){
      if(!employee)throw problem(401,'Iniciá sesión para acceder.');
      const canViewHistory=employee.id==='sofia';
      if(remote&&/^\/private\/(?:loom|planillas)(?:\/|$)/.test(route))
        throw problem(403,'Esta función está disponible en el centro local.');
      if(route==='/private/loom'&&req.method==='POST'){
        if(!canViewHistory)throw problem(403,'Los ensayos están disponibles para Gerencia.');
        return reply(res,200,await loom.create((await body(req)).key));
      }
      if(route==='/private/planillas'||route.startsWith('/private/planillas/')){
        if(!canViewHistory)throw problem(403,'Carga de planillas disponible solo para Gerencia.');
        if(req.method==='POST'&&route==='/private/planillas'){
          const payload=await body(req,1_048_576);
          if(payload.synthetic!==true)throw problem(400,'Confirmá que la planilla solo contiene datos ficticios.');
          let dataset;
          try{dataset=importDemo(payload);}catch(error){throw problem(400,error.message);}
          db.prepare('INSERT OR REPLACE INTO demo_spreadsheet VALUES (1,?,?)').run(JSON.stringify(dataset),new Date().toISOString());
        }
        const saved=importedDemo(db);
        const dataset=saved?JSON.parse(saved.dataset):baseDemo();
        if(route==='/private/planillas')return reply(res,200,{
          savedAt:saved?.saved_at??null,asOf:dataset.as_of,customers:dataset.customers.length,
          products:dataset.products.length,purchases:dataset.purchases.length,
        });
        if(req.method==='GET'){
          const key=route.slice('/private/planillas/'.length);
          if(['clientes','productos','compras'].includes(key))return reply(res,200,exportDemo(dataset,key),'text/csv; charset=utf-8',
            {'Content-Disposition':'attachment; filename="medpulse-'+key+'.csv"'});
        }
        throw problem(404,'Planilla no disponible.');
      }
      if(req.method==='GET'&&route==='/private/session'){
        const rehearsals=db.prepare('SELECT id FROM loom_rehearsals ORDER BY rowid DESC').all().map(row=>row.id);
        return reply(res,200,{user:employee,ids:remote?[...center.ids(),...rehearsals]:center.ids(),canViewHistory,
          ...(canViewHistory&&!remote&&{rehearsals}),remote});
      }
      if(req.method==='GET'&&route==='/private/history'){
        if(!canViewHistory)throw problem(403,'Historial disponible solo para Gerencia.');
        return reply(res,200,center.history());
      }
      if(req.method==='POST'&&route==='/private/logout'){
        sessionStore.logout(value);
        return reply(res,200,{ok:true},undefined,{'Set-Cookie':cookie('',0,remote)});
      }
      const match=route.match(/^\/private\/campaigns\/([A-Z][A-Z0-9]*-\d+)(?:\/(image|decide|reconcile|simulation))?$/);
      if(!match)throw problem(404,'Ruta desconocida.');
      const [,id,action]=match;
      const rehearsal=!!db.prepare('SELECT 1 FROM loom_rehearsals WHERE id=?').get(id);
      const review=rehearsal?loomCenter:center;
      if(remote&&(action==='simulation'||(!rehearsal&&req.method==='POST')))
        throw problem(403,'El acceso remoto solo permite decidir sobre campañas de ensayo.');
      if(!remote&&(rehearsal||action==='simulation')&&!canViewHistory)throw problem(403,'Los ensayos están disponibles para Gerencia.');
      if(action==='simulation')return reply(res,200,await (req.method==='POST'?loom.simulate(id):loom.status(id)));
      if(req.method==='GET'&&!action){
        const {history,...card}=await review.view(id);
        return reply(res,200,{
          ...card,
          rehearsal:rehearsal&&!remote,
          canDecide:card.canDecide&&(!remote||rehearsal),
          approvedHere:history.some(row=>row.phase==='confirmed'&&row.action==='approve'&&row.revision===card.revision),
          decisionBlock:!remote||rehearsal?history.find(row=>row.phase==='pending'||row.phase==='conflict')?.phase??null:null,
          ...(canViewHistory&&{history}),
        });
      }
      if(req.method==='GET'&&action==='image')return reply(res,200,await review.image(id,url.searchParams.get('revision')),'image/jpeg');
      if(req.method==='POST'&&action==='decide')return reply(res,200,await review.decide(id,await body(req),employee));
      if(req.method==='POST'&&action==='reconcile'){
        const {paperclipId}=await review.reconcile(id,employee);
        return reply(res,200,{paperclipId});
      }
      throw problem(404,'Ruta desconocida.');
    }
    if(req.method!=='GET')throw problem(404,'Ruta desconocida.');
    if(route==='/'||route==='/review')
      return reply(res,200,fs.readFileSync('private-dashboard/index.html'),types['.html']);
    if(['/review-local.js','/review-local.css'].includes(route))
      return reply(res,200,fs.readFileSync('private-dashboard'+route),types[path.extname(route)]);
    if(!/^\/(?:app\.js|whatsapp-simulation\.js|style\.css|data\/[a-z0-9.-]+)$/.test(route))throw problem(404,'Archivo no disponible.');
    return reply(res,200,fs.readFileSync('dashboard'+route),types[path.extname(route)]??'application/octet-stream');
  } catch(error){
    reply(res,error.status??(error.code==='ENOENT'?404:502),{error:error.status?error.message:'El servicio o la evidencia no están disponibles.'});
  }
}
http.createServer((req,res)=>handle(req,res)).listen(port,'127.0.0.1',()=>console.log(origin+'/#review'));
if(bridgeSecret)http.createServer((req,res)=>handle(req,res,true)).listen(bridgePort,'127.0.0.1');
