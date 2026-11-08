import test from 'node:test';import assert from 'node:assert/strict';
import {humanFeedback,documentUpdate,validateOutreachMessage} from './review-support.mjs';
test('Usa comentarios humanos completos y no mensajes del agente',()=>{
 const feedback=humanFeedback([{id:'agent',authorAgentId:'a',body:'old'},{id:'human',authorUserId:'local-board',createdAt:'2026-11-08',body:'No decir MEDPULSE ni sugerir 12 cajas.'}]);
 assert.equal(feedback.length,1);assert.equal(feedback[0].id,'human');assert.match(feedback[0].body,/12 cajas/);
});
test('Actualiza con la revisión leída y nunca fuerza un documento obsoleto',()=>{
 assert.deepEqual(documentUpdate({latestRevisionId:'rev-1'},{body:'nuevo'}),{body:'nuevo',baseRevisionId:'rev-1'});
 assert.deepEqual(documentUpdate(null,{body:'inicial'}),{body:'inicial'});
});
test('Exige distribuidora, cotización y baja sin filtrar cantidades internas',()=>{
 const s={display_name:'Distribuidora SaludPro Demo'};
 const good='Hola Ana, te escribo de Distribuidora SaludPro Demo. ¿Necesitan reponer guantes? Te preparo una cotización. Si no querés recibir mensajes, respondé BAJA.';
 assert.doesNotThrow(()=>validateOutreachMessage(good,s));
 assert.throws(()=>validateOutreachMessage(good.replace('Distribuidora SaludPro Demo','MEDPULSE'),s));
 assert.throws(()=>validateOutreachMessage(good+' 12 cajas.',s));
 assert.throws(()=>validateOutreachMessage(good.replace('cotización','propuesta'),s));
});
