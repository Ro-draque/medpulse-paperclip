import test from 'node:test';
import assert from 'node:assert/strict';
import {applyObservations, checkedUrl, latestVersion, tenderStatus} from './market-monitor.mjs';

test('una rectificación del mismo expediente agrega una versión sin duplicar el expediente',()=>{
  const history={};
  const notice={sourceId:'test',key:'exp:CONTROL-1',content:'Convocatoria',event:'notice',deadline:{date:'2026-11-15'},documents:[]};
  assert.deepEqual(applyObservations(history,[notice],'2026-11-08'),{new:1,updates:0,corrections:0,duplicates:0});
  assert.deepEqual(applyObservations(history,[notice],'2026-11-09'),{new:0,updates:0,corrections:0,duplicates:1});
  const corrected={...notice,content:'Rectificación del plazo',event:'correction',deadline:{date:'2026-11-18'}};
  assert.deepEqual(applyObservations(history,[corrected],'2026-11-10'),{new:0,updates:1,corrections:1,duplicates:0});
  assert.deepEqual(applyObservations(history,[notice,corrected],'2026-11-11'),{new:0,updates:0,corrections:0,duplicates:2});
  assert.equal(Object.values(history)[0].versions.length,2);
  assert.equal(tenderStatus(corrected,'2026-11-17'),'published_deadline_pending_confirmation');
  assert.equal(tenderStatus(corrected,'2026-11-19'),'historical_expired');
});

test('la validación de destino rechaza otro dominio y HTTP',()=>{
  const source={origin:'https://www.santafe.gob.ar'};
  assert.equal(checkedUrl('/boletinoficial/',source).origin,source.origin);
  assert.throws(()=>checkedUrl('https://www.santafe.gob.ar.example.invalid/',source));
  assert.throws(()=>checkedUrl('http://www.santafe.gob.ar/',source));
});

test('un aviso antiguo descubierto después no reemplaza la publicación más reciente',()=>{
  const newer={publishedAt:'2026-11-06',event:'correction'};
  const older={publishedAt:'2026-11-04',event:'notice'};
  assert.equal(latestVersion([newer,older]),newer);
});
