const productionOrigin='https://medpulse-paperclip.vercel.app';
const readRoutes=/^(?:session|history|campaigns\/[A-Z][A-Z0-9]*-\d+(?:\/image)?)$/;
const writeRoutes=/^(?:login|logout|campaigns\/[A-Z][A-Z0-9]*-\d+\/(?:decide|reconcile))$/;

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  const {route,revision}=req.query??{};
  const post=req.method==='POST';
  const deploymentHost=process.env.VERCEL_URL;
  const deploymentOrigin=/^[a-z0-9-]+\.vercel\.app$/.test(deploymentHost??'')?'https://'+deploymentHost:null;
  if(req.method!=='GET'&&!post)return res.status(405).json({error:'Método no permitido.'});
  if(typeof route!=='string'||!(post?writeRoutes:readRoutes).test(route))return res.status(404).json({error:'Ruta desconocida.'});
  if(post&&((req.headers.origin!==productionOrigin&&(!deploymentOrigin||req.headers.origin!==deploymentOrigin))||
    req.headers['content-type']!=='application/json'))
    return res.status(403).json({error:'Solicitud de origen no permitido.'});

  const secret=process.env.MEDPULSE_REVIEW_BRIDGE_SECRET;
  const origin=process.env.MEDPULSE_REVIEW_BRIDGE_URL;
  const gatewayPassword=process.env.MEDPULSE_REVIEW_GATEWAY_PASSWORD;
  if(!/^[a-f0-9]{64}$/.test(secret??'')||!/^[a-f0-9]{48}$/.test(gatewayPassword??'')||!origin)
    return res.status(503).json({error:'El centro privado aún no está conectado.'});
  try {
    const upstream=new URL(origin);
    if(upstream.protocol!=='https:'||upstream.origin!==origin||upstream.port||
      !/^[a-z0-9-]+\.ngrok-free\.(?:dev|app)$/.test(upstream.hostname))throw Error('Invalid bridge URL');
    const destination=new URL('/private/'+route,upstream);
    if(typeof revision==='string')destination.searchParams.set('revision',revision);
    const cookie=req.headers.cookie?.match(/(?:^|; )(__Host-medpulse_review=[A-Za-z0-9_-]{43})(?=;|$)/)?.[1];
    const response=await fetch(destination,{
      method:req.method,redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{'x-medpulse-bridge-secret':secret,authorization:'Basic '+Buffer.from('medpulse-vercel:'+gatewayPassword).toString('base64'),
        'ngrok-skip-browser-warning':'1',
        ...(cookie&&{cookie}),...(post&&{'Content-Type':'application/json',origin:productionOrigin})},
      ...(post&&{body:typeof req.body==='string'?req.body:JSON.stringify(req.body??{})}),
    });
    for(const name of ['content-type','content-disposition']){
      const value=response.headers.get(name);
      if(value)res.setHeader(name,value);
    }
    const session=response.headers.getSetCookie().find(value=>value.startsWith('__Host-medpulse_review='));
    if(session)res.setHeader('Set-Cookie',session);
    return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  }catch{
    return res.status(503).json({error:'El centro privado no está disponible. Revisá la conexión con MEDPULSE.'});
  }
}
