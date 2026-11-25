import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

// Compile the real application modules, substituting only Expo's database adapter.
// This validates SQL behavior on SQLite, not Expo's native bridge or RN rendering.
const catalog=JSON.parse(readFileSync(new URL('../data/guide-catalog.json',import.meta.url),'utf8'));
function load(path,modules){
 const raw=readFileSync(new URL(path,import.meta.url),'utf8');
 const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>{if(!(name in modules))throw Error('Unexpected import '+name);return modules[name]},mod,mod.exports);
 return mod.exports;
}
const rec=load('../src/recommendations.ts',{});
const api=load('../src/db.ts',{'../data/guide-catalog.json':catalog,'./recommendations':rec});
const sync=load('../src/sync.ts',{'./db':api});
function adapter(path=':memory:'){
 const conn=new DatabaseSync(path);
 const db={
  execAsync:async sql=>conn.exec(sql),
  runAsync:async(sql,...args)=>conn.prepare(sql).run(...args),
  getAllAsync:async(sql,...args)=>conn.prepare(sql).all(...args),
  getFirstAsync:async(sql,...args)=>conn.prepare(sql).get(...args),
  withExclusiveTransactionAsync:async fn=>{conn.exec('BEGIN IMMEDIATE');try{await fn(db);conn.exec('COMMIT')}catch(e){conn.exec('ROLLBACK');throw e}},
  close:()=>conn.close()
 };
 return db;
}
const original='my-first-playthrough';
const entry={id:'vf-test-guide',title:'Test guide',category:'Money',summary:'Summary',body:'Body',region:'General',sourceType:'community',sourceUrl:'https://example.com/source',sourceLabel:'Source',spoiler:false,tags:['money'],steps:[{id:'first',label:'First step'}],confidence:'reported'};
test('fresh launch, per-profile storage, restart, deletion and repeated migrations',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ivice-sql-'));const path=join(dir,'guide.db');let db=adapter(path);
 try{
 await api.migrate(db);await api.migrate(db);
 assert.equal((await api.readGuides(db)).length,catalog.length);
 const other=await api.addProfile(db,'Second save');
 await api.setProgress(db,other,'guide-first-hour','first',true);
 await api.setFavorite(db,other,'brian-heder',true);
 await api.addNote(db,other,"Quote's note","Some text");
 await api.writeSetting(db,'activeProfile',other);
 assert.equal((await api.readProgress(db,original)).size,0);
 assert.equal((await api.readFavorites(db,original)).size,0);
 assert.equal((await api.readNotes(db,original)).length,0);
 db.close();db=adapter(path);await api.migrate(db);
 assert.equal(await api.readSetting(db,'activeProfile',''),other);
 assert.ok((await api.readProgress(db,other)).has('guide-first-hour:first'));
 assert.ok((await api.readFavorites(db,other)).has('brian-heder'));
 assert.equal((await api.readNotes(db,other))[0].title,"Quote's note");
 await api.setProgress(db,other,'guide-first-hour','first',false);
 await api.setFavorite(db,other,'brian-heder',false);
 assert.equal((await api.readProgress(db,other)).size,0);
 assert.equal((await api.readFavorites(db,other)).size,0);
 const note=(await api.readNotes(db,other))[0];
 await api.removeNote(db,original,note.id);
 assert.equal((await api.readNotes(db,other)).length,1);
 await api.removeProfile(db,other);
 assert.equal((await api.readNotes(db,other)).length,0);
 await assert.rejects(()=>api.removeProfile(db,original));
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
test('remote replacement leaves local notes, progress and bundled catalog intact',async()=>{
 const db=adapter();
 try{await api.migrate(db);await api.setProgress(db,original,'guide-first-hour','first',true);await api.addNote(db,original,'Mine','Private');
 await api.replaceRemoteGuides(db,[entry]);assert.equal((await api.readGuides(db)).length,catalog.length+1);
 await api.replaceRemoteGuides(db,[]);assert.equal((await api.readGuides(db)).length,catalog.length);
 assert.equal((await api.readProgress(db,original)).size,1);assert.equal((await api.readNotes(db,original)).length,1);
 await assert.rejects(()=>api.replaceRemoteGuides(db,[{...entry,id:'brian-heder'}]));
 assert.equal((await api.readGuides(db)).length,catalog.length);
 }finally{db.close()}
});
test('remote validation rejects malformed, unsourced and duplicate-step records without throwing',()=>{
 assert.equal(sync.isGuide(entry),true);
 for(const item of [null,[],{...entry,region:[]},{...entry,steps:[null]},{...entry,sources:[null]},{...entry,sourceUrl:null,sources:[]},{...entry,sourceUrl:'javascript:alert(1)'},{...entry,sourceUrl:'https://user:pass@example.com/'},{...entry,steps:[entry.steps[0],entry.steps[0]]},{...entry,confidence:false},{...entry,id:'brian-heder'}])assert.equal(sync.isGuide(item),false,JSON.stringify(item));
});

test('chapter, region and resume persist per playthrough and cascade on deletion',async()=>{
 const db=adapter();try{await api.migrate(db);const other=await api.addProfile(db,'Other save');
 assert.deepEqual(await api.readSession(db,original),rec.DEFAULT_SESSION);
 await api.writeSession(db,other,{chapter:3,region:'Port Gellhorn',lastGuideId:'money-chapter-three'});
 assert.deepEqual(await api.readSession(db,other),{chapter:3,region:'Port Gellhorn',lastGuideId:'money-chapter-three'});
 assert.deepEqual(await api.readSession(db,original),rec.DEFAULT_SESSION);
 await api.migrate(db);assert.equal((await api.readSession(db,other)).chapter,3);
 await assert.rejects(()=>api.writeSession(db,other,{chapter:6,region:'',lastGuideId:null}));
 await api.removeProfile(db,other);assert.deepEqual(await api.readSession(db,other),rec.DEFAULT_SESSION);
 }finally{db.close()}
});
test('chapter filtering, spoiler opt-in, regional results, completion and resume',()=>{
 const session={chapter:2,region:'Port Gellhorn',lastGuideId:'money-chapter-three'};
 const future=catalog.find(e=>e.id==='money-chapter-three'),spoiler=catalog.find(e=>e.id==='money-vault-jobs');
 assert.equal(rec.canRead(future,session,false),false);assert.equal(rec.canRead(future,session,true),true);
 assert.equal(rec.canRead(spoiler,session,false),false);assert.equal(rec.canRead(spoiler,session,true),true);
 const picks=rec.recommend(catalog,session,new Set(),false);
 assert.equal(picks.money[0].id,'money-stolen-cars');assert.equal(picks.resume,null);
 assert.ok(picks.nearby.some(e=>e.id==='port-gellhorn'));assert.equal(picks.rides.length,3);
 assert.ok(picks.rides.every(e=>rec.accessLabel(e,session)==='Check access in game'));
 const full=rec.recommend(catalog,session,new Set(),true);
 assert.ok(!full.money.some(e=>e.id===future.id||e.id===spoiler.id));assert.equal(full.resume.id,future.id);
 const later=rec.recommend(catalog,{...session,chapter:3},new Set(),false);assert.equal(later.money[0].id,future.id);
 const done=new Set(future.steps.map(s=>future.id+':'+s.id));assert.ok(!rec.recommend(catalog,{...session,chapter:3},done,false).money.some(e=>e.id===future.id));
 const unset=rec.recommend(catalog,rec.DEFAULT_SESSION,new Set(),false);assert.ok(unset.money.every(e=>!e.minChapter));
});
test('remote chapter and ranking metadata must be valid',()=>{
 assert.equal(sync.isGuide({...entry,minChapter:2,access:'chapter',priority:80}),true);
 for(const extra of [{minChapter:0},{minChapter:6},{access:'chapter'},{access:'guaranteed'},{priority:101},{priority:1.5}])assert.equal(sync.isGuide({...entry,...extra}),false);
});
test('unclassified remote guides require explicit spoiler opt-in and are not recommended',()=>{const g={...entry};assert.equal(rec.canRead(g,rec.DEFAULT_SESSION,false),false);assert.equal(rec.canRead(g,rec.DEFAULT_SESSION,true),true);assert.equal(rec.recommend([g],rec.DEFAULT_SESSION,new Set(),true).money.length,0)});

test('time-sensitive earlier chapter tips remain readable but stop being recommended',()=>{const e=catalog.find(e=>e.id==='reddit-chapter-one-cutoff');const early={chapter:1,region:'Leonida Keys',lastGuideId:null};const late={...early,chapter:3};assert.ok(rec.recommend(catalog,early,new Set(),false).optional.some(x=>x.id===e.id));assert.ok(!rec.recommend(catalog,late,new Set(),true).optional.some(x=>x.id===e.id));assert.equal(rec.canRead(e,late,false),true);assert.match(rec.accessLabel(e,late),/Earlier chapter/);assert.equal(sync.isGuide({...entry,minChapter:2,maxChapter:1}),false);assert.equal(sync.isGuide({...entry,minChapter:1,maxChapter:1}),true)});
