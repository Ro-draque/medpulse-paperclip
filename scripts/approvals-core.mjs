import {createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {unwrapDocument} from './review-support.mjs';

export const employees = [
  {id:'valentina', name:'Valentina Demo', role:'Responsable comercial'},
  {id:'martin', name:'Martín Demo', role:'Responsable de marketing'},
  {id:'sofia', name:'Sofía Demo', role:'Gerencia'},
];
export const originals = ['MED-6','MED-15','MED-20'];
export const sha = value => createHash('sha256').update(value).digest('hex');
const passwordHash = (password, salt) => scryptSync(password, salt, 64, {N:32768,r:8,p:1,maxmem:64*1024*1024});
const token = () => randomBytes(32).toString('base64url');
export const problem = (status, message) => Object.assign(new Error(message), {status});
export const paperclip = async (route, method='GET', body) => {
  const response = await fetch('http://127.0.0.1:3100'+route, {
    method, redirect:'error', signal:AbortSignal.timeout(8000),
    ...(body && {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}),
  });
  if (!response.ok) throw Object.assign(problem(502, 'Paperclip respondió HTTP '+response.status+'.'), {upstreamStatus:response.status, upstream:await response.text()});
  if (route.endsWith('/content')) return Buffer.from(await response.arrayBuffer());
  return response.json();
};

export function openStore(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, salt TEXT, hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user TEXT, expires INTEGER);
    CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, at INTEGER);
    CREATE TABLE IF NOT EXISTS demos (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY, task TEXT, revision TEXT, hash TEXT, employee TEXT, role TEXT,
      at TEXT, action TEXT, comment TEXT, previous TEXT, stage TEXT, phase TEXT, paperclipId TEXT, paperclipStatus TEXT,
      draft TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending ON decisions(task) WHERE phase IN ('pending','conflict');
    CREATE UNIQUE INDEX IF NOT EXISTS one_revision ON decisions(task,revision) WHERE phase IN ('pending','conflict','confirmed');
  `);
  return db;
}
export function provision(db) {
  if (db.prepare('SELECT count(*) AS n FROM users').get().n) throw Error('Las cuentas ya están inicializadas.');
  const list = employees.map(employee => ({...employee,password:token(),salt:token()}));
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const {id,password,salt} of list) db.prepare('INSERT INTO users VALUES (?,?,?)').run(id,salt,passwordHash(password,salt).toString('hex'));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return list.map(({id,name,password}) => ({id,name,password}));
}

export function auth(db) {
  return {
    login(id, password, now=Date.now()) {
      db.prepare('DELETE FROM attempts WHERE at<=?').run(now-600_000);
      if (db.prepare('SELECT count(*) AS n FROM attempts').get().n>=10) throw problem(429,'Demasiados intentos. Esperá 10 minutos.');
      const row=db.prepare('SELECT * FROM users WHERE id=?').get(id);
      const actual=passwordHash(password,row?.salt??'medpulse-invalid');
      if (!row || !timingSafeEqual(actual,Buffer.from(row.hash,'hex'))) {
        db.prepare('INSERT INTO attempts(at) VALUES (?)').run(now);
        throw problem(401,'Usuario o contraseña incorrectos.');
      }
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
      const value=token();
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(sha(value),id,now+28_800_000);
      return value;
    },
    user(value) {
      if (!value) return null;
      const session=db.prepare('SELECT user FROM sessions WHERE hash=? AND expires>?').get(sha(value),Date.now());
      return employees.find(employee=>employee.id===session?.user)??null;
    },
    logout(value) { if (value) db.prepare('DELETE FROM sessions WHERE hash=?').run(sha(value)); },
  };
}

export function approvals(db, api=paperclip) {
  const active = new Set();
  const route = id=>'/api/issues/'+encodeURIComponent(id);
  const allowed = id=>originals.includes(id)||!!db.prepare('SELECT 1 FROM demos WHERE id=?').get(id);
  const check = id=>{if (!allowed(id)) throw problem(404,'Campaña fuera del centro de revisión.');};
  const image = async draft=>{
    const attachment = draft.image;
    if (!attachment) return null;
    if (!/^[\da-f-]{36}$/i.test(attachment.attachmentId)) throw problem(502,'Identificador de imagen inválido.');
    const bytes=await api('/api/attachments/'+attachment.attachmentId+'/content');
    if (sha(bytes)!==attachment.sha256 || bytes[0]!==255 || bytes[1]!==216) throw problem(502,'La imagen no coincide con la evidencia.');
    return bytes;
  };
  async function read(id) {
    check(id);
    const task=await api(route(id));
    const doc=await api(route(task.id)+'/documents/result');
    const draft=unwrapDocument(doc);
    const bytes=await image(draft);
    const hash=sha(JSON.stringify([doc.body, bytes ? sha(bytes) : null]));
    return {task,doc,draft,hash,bytes};
  }
  const pending = task=>task.status==='in_review' && task.executionState?.status==='pending' &&
    task.executionState.currentStageType==='approval' && task.executionState.currentParticipant?.type==='user' &&
    task.executionState.currentParticipant?.userId==='local-board';
  const history = (id=null)=>db.prepare(`SELECT id,task,revision,hash,employee,role,at,action,comment,phase,paperclipId,paperclipStatus,
    COALESCE(json_extract(draft,'$.headline'), 'WhatsApp · ' || json_extract(draft,'$.recipient.name'), task) AS campaign
    FROM decisions WHERE (? IS NULL OR task=?) ORDER BY rowid DESC`).all(id,id);
  const marker = row=>[row.comment,'[MEDPULSE '+row.id+' · SHA-256 '+row.hash+']'].filter(Boolean).join('\n\n');
  const outcome = action=>action==='approve'?'approved':'changes_requested';

  async function confirm(row, response) {
    // Match the unique comment marker and the stage decision. A prior decision cannot satisfy this check.
    const current=await read(row.task);
    const state=current.task.executionState;
    const observed=response?.executionState??state;
    const decision=observed?.lastDecisionId;
    const comments=await api(route(current.task.id)+'/comments');
    if (!decision || decision===row.previous || observed.lastDecisionOutcome!==outcome(row.action) ||
        !(observed.currentStageId===row.stage || observed.completedStageIds?.includes(row.stage)) ||
        !comments.some(comment=>comment.authorUserId==='local-board' && comment.body===marker(row))) {
      throw problem(503,'Decisión sin confirmar. Los nuevos intentos están bloqueados hasta conciliar.');
    }
    if (current.doc.latestRevisionId!==row.revision || current.hash!==row.hash || state?.lastDecisionId!==decision) {
      db.prepare("UPDATE decisions SET phase='conflict',paperclipId=?,paperclipStatus=? WHERE id=?").run(decision,current.task.status,row.id);
      throw problem(409,'Paperclip registró una decisión, pero la versión o el estado cambió. Requiere revisión manual.');
    }
    db.prepare("UPDATE decisions SET phase='confirmed',paperclipId=?,paperclipStatus=? WHERE id=?").run(decision,current.task.status,row.id);
    return history(row.task).find(record=>record.id===row.id);
  }

  return {
    history:()=>history(),
    ids:()=>[...originals,...db.prepare('SELECT id FROM demos ORDER BY id').all().map(row=>row.id)],
    async view(id) {
      const {task,doc,draft,hash,bytes}=await read(id);
      const records=history(id);
      return {id,title:task.title,status:task.status,stage:task.executionState?.status,review:task.executionState?.lastDecisionOutcome,
        revision:doc.latestRevisionId,version:doc.latestRevisionNumber,updated:doc.updatedAt,hash,
        draft,hasImage:!!bytes,demo:!originals.includes(id),history:records,
        canDecide:pending(task)&&!records.some(row=>['pending','conflict'].includes(row.phase)||(row.phase==='confirmed'&&row.revision===doc.latestRevisionId))};
    },
    async image(id, revision) {
      const record=await read(id);
      if (!record.bytes || record.doc.latestRevisionId!==revision) throw problem(404,'Imagen de esa revisión no disponible.');
      return record.bytes;
    },
    async decide(id, {action,comment='',revision,hash}, employee) {
      check(id);
      if (!employees.includes(employee)) throw problem(403,'La cuenta no tiene permisos de revisión.');
      if (!['approve','changes'].includes(action)||typeof comment!=='string'||comment.length>2000 ||
          typeof revision!=='string'||!revision||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))
        throw problem(400,'Decisión inválida o comentario de más de 2000 caracteres.');
      if (active.has(id)) throw problem(409,'Ya hay una operación para esta campaña.');
      active.add(id);
      try {
        if (history(id).some(row=>['pending','conflict'].includes(row.phase)||(row.phase==='confirmed'&&row.revision===revision)))
          throw problem(409,'Ya existe una decisión o una conciliación pendiente para esta campaña.');
        const {task,doc,draft,hash:actual}=await read(id);
        if (doc.latestRevisionId!==revision||actual!==hash) throw problem(409,'El borrador cambió. Volvé a abrirlo y revisalo.');
        if (!pending(task)) throw problem(409,'La etapa de aprobación humana ya no está pendiente.');
        const row={id:randomUUID(),task:id,revision,hash,comment:comment.trim(),previous:task.executionState.lastDecisionId??null,stage:task.executionState.currentStageId};
        db.prepare("INSERT INTO decisions VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',NULL,NULL,?)").run(
          row.id,id,revision,hash,employee.name,employee.role,new Date().toISOString(),action,row.comment,row.previous,
          task.executionState.currentStageId,JSON.stringify(draft));
        row.action=action;
        try {
          const response=await api(route(task.id),'PATCH',{status:action==='approve'?'done':'in_progress',comment:marker(row)});
          return await confirm(row,response);
        } catch (error) {
          if (error.status===409) throw error;
          throw problem(503,'Paperclip no confirmó la decisión. No vuelvas a enviarla. Usá «Conciliar» para comprobar el resultado.');
        }
      } finally {active.delete(id);}
    },
    async reconcile(id,employee) {
      check(id);
      if (!employees.includes(employee)) throw problem(403,'La cuenta no tiene permisos de revisión.');
      if (active.has(id)) throw problem(409,'La operación todavía está en curso.');
      const row=db.prepare("SELECT * FROM decisions WHERE task=? AND phase='pending'").get(id);
      if (!row) throw problem(409,'No hay una decisión pendiente de conciliación.');
      active.add(id);
      try {return await confirm(row);}
      finally {active.delete(id);}
    },
  };
}
