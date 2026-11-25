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
const api=load('../src/db.ts',{'../data/guide-catalog.json':catalog});
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
