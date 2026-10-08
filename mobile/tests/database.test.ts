import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schema } from '../src/database/migrations/001';
import { FamilyRepository } from '../src/database/repositories/FamilyRepository';
import type { Database, SqlValue } from '../src/services/database/types';
export function testDb(): {db:Database;close:()=>void} {
  const native=new DatabaseSync(':memory:');
  const db:Database={execAsync:async sql=>{native.exec(sql);},runAsync:async(sql,...p:SqlValue[])=>{const r=native.prepare(sql).run(...p);return {changes:Number(r.changes),lastInsertRowId:Number(r.lastInsertRowid)};},getFirstAsync:async<T>(sql:string,...p:SqlValue[])=>native.prepare(sql).get(...p) as T??null,getAllAsync:async<T>(sql:string,...p:SqlValue[])=>native.prepare(sql).all(...p) as T[],withTransactionAsync:async work=>{native.exec('BEGIN');try{await work();native.exec('COMMIT');}catch(e){native.exec('ROLLBACK');throw e;}}};
  return {db,close:()=>native.close()};
}
test('migrations are idempotent and every required table exists',async()=>{
  const {db,close}=testDb();try{await db.execAsync(schema);await db.execAsync(schema);const rows=await db.getAllAsync<{name:string}>('SELECT name FROM sqlite_master WHERE type=\'table\'');for(const table of ['children','lessons','lesson_progress','surahs','ayahs','quran_resources','quran_sync','hadiths','hadith_lessons','duas','quiz_questions','quiz_attempts','memorization_progress','bookmarks','downloads','app_settings','content_sources'])assert.ok(rows.some(r=>r.name===table));}finally{close();}
});
test('children retain separate progress, retries increment attempts, reset is isolated',async()=>{
  const {db,close}=testDb();try{await db.execAsync(schema);const repo=new FamilyRepository(db);const a=await repo.addChild('Yusuf','⭐',8),b=await repo.addChild('Maryam','🌙',11);await repo.saveProgress(a,'arabic-alif',80);await repo.saveProgress(a,'arabic-alif',100);await repo.saveProgress(b,'quran-1',90);assert.equal((await repo.progress(a))[0].attempts,2);assert.equal((await repo.progress(b))[0].lesson_id,'quran-1');await repo.resetProgress(a);assert.equal((await repo.progress(a)).length,0);assert.equal((await repo.progress(b)).length,1);await repo.deleteChild(b);assert.equal((await repo.progress(b)).length,0);}finally{close();}
});
test('practice history retains repeated attempts and reset deletes only the chosen child',async()=>{
  const {db,close}=testDb();try{
    await db.execAsync(schema);
    const repo=new FamilyRepository(db);
    const a=await repo.addChild('Yusuf','⭐',8),b=await repo.addChild('Maryam','🌙',11);
    await repo.saveProgress(a,'arabic-alif',80);
    await repo.saveProgress(a,'arabic-alif',100);
    await repo.saveProgress(b,'quran-1',90);
    const count=async(child:number)=>(await db.getFirstAsync<{count:number}>('SELECT COUNT(*) AS count FROM learning_activity WHERE child_id=?',child))?.count;
    assert.equal(await count(a),2);
    assert.equal(await count(b),1);
    await repo.resetProgress(a);
    assert.equal(await count(a),0);
    assert.equal(await count(b),1);
    await repo.deleteChild(b);
    assert.equal(await count(b),0);
  }finally{close();}
});
test('settings and canonical Arabic round-trip without normalization',async()=>{
  const {db,close}=testDb();try{await db.execAsync(schema);const repo=new FamilyRepository(db);await repo.setSetting('goal',{minutes:10});assert.deepEqual(await repo.setting('goal',{}),{minutes:10});const canonical='ٱلْيَتِيمَ';await db.runAsync('INSERT INTO ayahs VALUES (?,?,?,?,?,?)','107:2',107,2,canonical,'{}','{}');assert.equal((await db.getFirstAsync<{canonical_text:string}>('SELECT canonical_text FROM ayahs'))?.canonical_text,canonical);}finally{close();}
});
test('reject invalid child ages and progress scores',async()=>{const {db,close}=testDb();try{await db.execAsync(schema);const repo=new FamilyRepository(db);await assert.rejects(repo.addChild('','⭐'));await assert.rejects(repo.addChild('x','⭐',1.5));const id=await repo.addChild('x','⭐');await assert.rejects(repo.saveProgress(id,'x',NaN));}finally{close();}});
test('SQLite retains profile and progress after closing and reopening',()=>{const dir=mkdtempSync(join(tmpdir(),'kids-islam-test-'));const file=join(dir,'persist.db');let db=new DatabaseSync(file);try{db.exec(schema);db.prepare('INSERT INTO children VALUES (?,?,?,?,?)').run(1,'Yusuf',8,'⭐','2026-10-07');db.prepare('INSERT INTO lesson_progress VALUES (?,?,?,?,?,?,?,?)').run(1,'arabic-alif','completed',100,1,'2026-10-07','2026-10-07',null);db.close();db=new DatabaseSync(file);assert.equal((db.prepare('SELECT nickname FROM children').get() as {nickname:string}).nickname,'Yusuf');assert.equal((db.prepare('SELECT score FROM lesson_progress').get() as {score:number}).score,100);}finally{db.close();rmSync(dir,{recursive:true,force:true});}});
