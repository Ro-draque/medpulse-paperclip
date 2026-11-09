import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPublication,comparePublication,kitDraft,kitKey,officialTitle} from './instagram-discovery.mjs';
import {campaignKey} from './instagram-campaign.mjs';
const product={id:'P02',name:'Gasas estériles, paquete x100',stock:5};
test('usa el título de la publicación aunque la cabecera del portal tenga otro h1',()=>{
  assert.equal(officialTitle('<meta property="og:title" content="Botiquín de primeros auxilios"><h1>Presidencia de la Nación</h1>'),'Botiquín de primeros auxilios');
});
test('la guía recién incorporada habilita una pieza distinta, con stock y sin evidencia de demanda',()=>{
  const classification=classifyPublication('kit','Gasas. Reponer insumos.',[product]);
  assert.equal(classification.eligible,true);
  assert.equal(classification.demandTrend,'sin evidencia comercial');
  assert.notEqual(kitKey,campaignKey);
  assert.equal(kitDraft({},product).headline,'Tu botiquín, al día.');
  assert.equal(classifyPublication('kit','Gasas. Reponer insumos.',[{...product,stock:0}]).eligible,false);
});
test('el historial distingue novedades, repeticiones y modificaciones',()=>{
  const first={sha256:'a'},modified={sha256:'b'};
  assert.equal(comparePublication(undefined,first),'new');
  assert.equal(comparePublication(first,first),'repeated');
  assert.equal(comparePublication(first,modified),'modified');
});
test('una noticia institucional nueva no tiene campaña automática',()=>{
  assert.equal(comparePublication(undefined,{sha256:'news'}),'new');
  const c=classifyPublication('news','Reconocimiento de especialidades',[product]);
  assert.equal(c.relevant,false);
  assert.equal(c.eligible,false);
  assert.equal(c.interestTrend,'no medido');
});
