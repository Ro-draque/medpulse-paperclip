import fs from 'node:fs/promises';
import path from 'node:path';
import {documentUpdate,unwrapDocument} from './review-support.mjs';
const m=JSON.parse(await fs.readFile('evidence/latest-growth.json','utf8'));
const batchDir=path.join('evidence/growth',m.batch);
let dir=batchDir;try{dir=JSON.parse(await fs.readFile(path.join(batchDir,'outreach-latest.json'),'utf8')).directory}catch(e){if(e.code!=='ENOENT')throw e;}
const campaign=JSON.parse(await fs.readFile(path.join(dir,'outreach-result.json'),'utf8'));
const strategy=JSON.parse(await fs.readFile(path.join(batchDir,'strategy-result.json'),'utf8'));
const body=`# Campaña preparada — revisión humana pendiente

Datos totalmente sintéticos. Este documento de revisión lo prepara el operador a partir de los artefactos de los agentes; no concede aprobación.

**Destinatario:** ${campaign.recipient.name}; contacto ${campaign.recipient.contact}; referencia ${campaign.recipient.recipient_ref}. No existe teléfono configurado.

**Producto:** ${campaign.product.name}. Cantidad sugerida: ${campaign.product.quantity}. Stock de la fixture: ${campaign.product.stock}.

La cantidad es una referencia interna, no una cantidad propuesta en el mensaje inicial. Remitente comercial: ${campaign.sender?.display_name||'Identidad de remitente no definida en esta versión'}; MEDPULSE es la herramienta de IA.

**Motivo:** ${strategy.decision.reason}

## Mensaje propuesto

${campaign.message}

## Canales considerados

- WhatsApp: ${strategy.decision.why_whatsapp}
- Instagram: ${strategy.decision.why_instagram}
- Ninguno: ${strategy.decision.why_none}

## Precisión sobre consentimiento y ejecución

El dataset acredita consentimiento comercial **sintético general**. No especifica su alcance para WhatsApp; falta validarlo antes de cualquier uso real. La recomendación es para preparar y revisar el borrador. No es autorización de contacto.

El payload es un borrador no enviable (sendable=false), con destinatario ficticio y transporte deshabilitado. No se contactó a Meta ni se enviaron mensajes. La aprobación de esta tarea solo acepta el artefacto dry-run; no activa ningún envío.

## Trazabilidad

${Object.entries(m.tasks).map(([stage,t])=>`- ${stage}: ${t.identifier} (${t.id})`).join('\n')}

En la tarea están registrados el documento result, el JSON adjunto y el comentario del agente. La verificación local conserva las cuatro sesiones Codex, hashes y el rechazo HTTP 403 al intento de cierre del agente.

## Decisión pendiente

Revisar el mensaje y el payload. Aprobar o solicitar cambios usando la revisión de Paperclip. La tarea debe permanecer en in_review hasta una decisión de la persona revisora.
`;
await fs.writeFile(path.join(dir,'HUMAN-REVIEW.md'),body);
const url=`http://127.0.0.1:3100/api/issues/${m.tasks.outreach.id}/documents/review`;
const previousResponse=await fetch(url);if(!previousResponse.ok&&previousResponse.status!==404)throw Error(`Review read failed ${previousResponse.status}`);
const previous=previousResponse.ok?await previousResponse.json():null;
const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(documentUpdate(previous,{title:'Campaña WhatsApp — revisar borrador dry-run',format:'markdown',body,changeSummary:'Resumen actualizado tras cambios humanos; no se aprobó la campaña'}))});
if(!r.ok)throw Error(`${r.status}: ${await r.text()}`);const doc=await r.json();console.log(JSON.stringify({task:m.tasks.outreach.identifier,documentId:doc.id,humanApproval:'still_pending'}));
