import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const entries=JSON.parse(readFileSync(new URL('../data/guide-catalog.json',import.meta.url),'utf8'));
const official='https://www.rockstargames.com/';
test('catalog has unique stable IDs and meaningful entries',()=>{
 assert.ok(entries.length>=35);
 assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
 for(const e of entries){
  assert.match(e.id,/^[a-z0-9-]+$/);
  assert.ok(e.title.length>0 && e.summary.length>0 && e.body.length>0);
  assert.ok(['Places','People','Play Guides','Collections','Money','Story','Vehicles'].includes(e.category));
  assert.ok(['official','template','community'].includes(e.sourceType));
  assert.equal(typeof e.spoiler,'boolean');
  assert.ok(Array.isArray(e.tags)&&Array.isArray(e.steps));
  assert.equal(new Set(e.steps.map(s=>s.id)).size,e.steps.length);
  for(const src of e.sources??[])assert.match(src.url,/^https:\/\//);
  if(e.sourceType==='community')assert.ok(e.sources.length>0);
  if(e.sourceType==='official')assert.ok((e.sources??[]).some(s=>s.url.startsWith(official)));
 }
});
test('Brian Heder links Rockstar and the Fandom reference',()=>{
 const brian=entries.find(e=>e.id==='brian-heder');
 assert.ok(brian);
 assert.ok(brian.sources.some(s=>s.url==='https://www.rockstargames.com/VI/only-in-leonida/brian'));
 assert.ok(brian.sources.some(s=>s.url==='https://gta.fandom.com/wiki/Brian_Heder'));
});
test('templates do not masquerade as verified discoveries',()=>{
 for(const e of entries.filter(e=>e.sourceType==='template')){
  assert.ok(e.body.length>0);
  assert.ok(!e.sourceUrl);
 }
});

test('money, story, cars, aircraft and boats have distinct sourced pages',()=>{
 for(const [category,tag] of [['Money','money'],['Story','story'],['Vehicles','cars'],['Vehicles','aircraft'],['Vehicles','boats']]) {
  const matches=entries.filter(e=>e.category===category&&e.tags.includes(tag));
  assert.ok(matches.length>0,`${category}: ${tag}`);
  assert.ok(matches.some(e=>e.sources.length>=1));
 }
});
test('early published recommendations are not misrepresented as Rockstar-verified',()=>{
 for(const e of entries.filter(e=>['Money','Story','Vehicles'].includes(e.category))){
  assert.notEqual(e.sourceType,'official');
  assert.ok(['reported','template'].includes(e.confidence));
  assert.ok(e.stage);
 }
});
