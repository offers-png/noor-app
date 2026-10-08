import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import { transferQuranAudio, verifiedAudioPath, type AudioDownloadRuntime } from '../src/services/quran/QuranAudioDownloadEngine';
import { estimateAudioDownloads, type QuranAudioDownload } from '../src/services/quran/QuranAudioDownloads';
import { QuranFoundationProvider } from '../src/services/quran/QuranFoundationProvider';
import { QuranSyncService, type SyncStore } from '../src/services/quran/QuranSyncService';
import type { ResourceSnapshot } from '../src/types/quran';

function database() {
  const native=new DatabaseSync(':memory:');native.exec(schema);
  const db:Database={execAsync:async sql=>{native.exec(sql);},runAsync:async(sql,...params:SqlValue[])=>{const result=native.prepare(sql).run(...params);return {changes:Number(result.changes),lastInsertRowId:Number(result.lastInsertRowid)};},getFirstAsync:async<T>(sql:string,...params:SqlValue[])=>native.prepare(sql).get(...params) as T??null,getAllAsync:async<T>(sql:string,...params:SqlValue[])=>native.prepare(sql).all(...params) as T[],withTransactionAsync:async work=>{native.exec('BEGIN');try{await work(db);native.exec('COMMIT');}catch(error){native.exec('ROLLBACK');throw error;}}};return {db,close:()=>native.close()};
}
const files:QuranAudioDownload[]=[1,2].map(number=>({id:`audio:${number}`,resource:'recitations',resourceId:'7',verseKey:`1:${number}`,url:`https://audio.example.test/${number}.mp3`,bytes:1200}));
function runtime() {
  const local=new Map<string,number>();const requested:string[]=[];let released=0;let removed=0;
  const api:AudioDownloadRuntime={inspect:uri=>({exists:local.has(uri),size:local.get(uri)??0}),availableBytes:()=>10*1024*1024,create:(file,signal,progress)=>{requested.push(file.id);const uri=`file:///quran/${file.id}.mp3`;return {download:async()=>{if(signal.aborted)throw new Error('cancelled');progress(600);local.set(uri,file.bytes!);return {uri,size:file.bytes!};},remove:()=>{removed++;local.delete(uri);},release:()=>{released++;}};}};
  return {api,local,requested,get released(){return released;},get removed(){return removed;}};
}

test('confirmed recordings persist verified paths and retries skip already complete files',async()=>{
  const {db,close}=database();const native=runtime();const progress:number[]=[];
  try{
    await transferQuranAudio(db,files,()=>true,native.api,()=>undefined,{onBytes:bytes=>progress.push(bytes)});
    assert.equal(native.released,2);assert.deepEqual(native.requested,['audio:1','audio:2']);assert.ok(progress.includes(600));assert.equal(progress.at(-1),2400);
    assert.equal(await verifiedAudioPath(db,'audio:1',native.api),'file:///quran/audio:1.mp3');
    await transferQuranAudio(db,files,()=>true,native.api,()=>undefined);
    assert.equal(native.requested.length,2,'Retry must not download verified files again');
    assert.equal((await db.getFirstAsync<{count:number}>('SELECT COUNT(*) AS count FROM downloads WHERE status=?','complete'))?.count,2);
  }finally{close();}
});
test('partial failure preserves completed recordings, removes incomplete file and permits retry',async()=>{
  const {db,close}=database();const native=runtime();const create=native.api.create;let fail=true;
  native.api.create=(file,signal,progress)=>{const transfer=create(file,signal,progress);if(file.id==='audio:2'&&fail){transfer.download=async()=>{native.local.set('file:///quran/audio:2.mp3',100);throw new Error('private native diagnostic');};}return transfer;};
  try{await assert.rejects(transferQuranAudio(db,files,()=>true,native.api,()=>undefined),/Check your connection/);assert.equal(await verifiedAudioPath(db,'audio:1',native.api),'file:///quran/audio:1.mp3');assert.equal(native.local.has('file:///quran/audio:2.mp3'),false);const failed=await db.getFirstAsync<{status:string;path:string|null;error:string}>('SELECT status,path,error FROM downloads WHERE id=?','audio:2');assert.equal(failed?.status,'failed');assert.equal(failed?.path,null);assert.doesNotMatch(failed!.error,/private native/);fail=false;await transferQuranAudio(db,files,()=>true,native.api,()=>undefined);assert.deepEqual(native.requested,['audio:1','audio:2','audio:2']);}finally{close();}
});
test('storage shortage and missing confirmation stop before any transfer',async()=>{
  const {db,close}=database();const native=runtime();native.api.availableBytes=()=>1000;
  try{await assert.rejects(transferQuranAudio(db,files,()=>true,native.api,()=>undefined),/free storage/);assert.equal(native.requested.length,0);assert.equal((await db.getFirstAsync<{count:number}>('SELECT COUNT(*) AS count FROM downloads'))?.count,0);await assert.rejects(transferQuranAudio(db,[{...files[0],bytes:undefined}],()=>true,native.api,()=>undefined),/Check audio sizes/);}finally{close();}
});
test('revoked consent or cancellation after native completion never publishes the file as offline ready',async()=>{
  for(const cancel of [false,true]){const {db,close}=database();const native=runtime();const controller=new AbortController();let allowed=true;const create=native.api.create;native.api.create=(file,signal,progress)=>{const transfer=create(file,signal,progress);const download=transfer.download;transfer.download=async()=>{const output=await download();if(cancel)controller.abort();else allowed=false;return output;};return transfer;};try{await assert.rejects(transferQuranAudio(db,[files[0]],()=>allowed,native.api,()=>undefined,{signal:controller.signal}),cancel?/cancelled/:/disabled/);assert.equal(native.local.size,0);assert.equal((await db.getFirstAsync<{status:string}>('SELECT status FROM downloads WHERE id=?','audio:1'))?.status,'failed');assert.equal(native.released,1);}finally{close();}}
});
test('task construction failures become retryable failed rows; concurrent downloads cannot race',async()=>{
  const {db,close}=database();const native=runtime();native.api.create=()=>{throw new Error('Native object failed');};
  try{await assert.rejects(transferQuranAudio(db,[files[0]],()=>true,native.api,()=>undefined),/could not be downloaded/);assert.equal((await db.getFirstAsync<{status:string}>('SELECT status FROM downloads WHERE id=?','audio:1'))?.status,'failed');const normal=runtime();let finish!:()=>void;let started!:()=>void;const start=new Promise<void>(resolve=>{started=resolve;});const done=new Promise<void>(resolve=>{finish=resolve;});const create=normal.api.create;normal.api.create=(file,signal,progress)=>{const transfer=create(file,signal,progress);const download=transfer.download;transfer.download=async()=>{started();await done;return download();};return transfer;};const pending=transferQuranAudio(db,[files[0]],()=>true,normal.api,()=>undefined);await start;await assert.rejects(transferQuranAudio(db,[files[0]],()=>true,normal.api,()=>undefined),/already running/);finish();await pending;}finally{close();}
});
test('deleted or truncated cached recordings cannot be selected for offline playback',async()=>{
  const {db,close}=database();const native=runtime();
  try{await transferQuranAudio(db,files,()=>true,native.api,()=>undefined);native.local.delete('file:///quran/audio:1.mp3');native.local.set('file:///quran/audio:2.mp3',200);for(const file of files){assert.equal(await verifiedAudioPath(db,file.id,native.api),undefined);const row=await db.getFirstAsync<{status:string;path:string|null}>('SELECT status,path FROM downloads WHERE id=?',file.id);assert.equal(row?.status,'failed');assert.equal(row?.path,null);}}finally{close();}
});
test('estimation rejects empty plans, HTML responses, revoked consent and native fetch diagnostics',async()=>{
  await assert.rejects(estimateAudioDownloads([],()=>true),/No recordings/);
  await assert.rejects(estimateAudioDownloads(files,()=>true,async()=>new Response(null,{headers:{'content-length':'1200','content-type':'text/html'}})),/reliable size/);
  let allowed=true;await assert.rejects(estimateAudioDownloads(files,()=>allowed,async()=>{allowed=false;return new Response(null,{headers:{'content-length':'1200'}});}),/cancelled/);
  await assert.rejects(estimateAudioDownloads(files,()=>true,async()=>{throw new Error('private native network secret');}),error=>error instanceof Error&&!error.message.includes('secret')&&error.message.includes('connection'));
});
test('provider recovers after attribution failure and rejects empty metadata rather than reporting ready',async()=>{
  let catalogs=0;const snapshot={resource_group:'recitations',resource_id:7,resource_content_id:7,schema_version:1,sync_sequence:1,records:[{record_type:'audio_file',verse_key:'1:1',url:'https://audio.example.test/1.mp3'}]};
  const provider=new QuranFoundationProvider('https://content.example.test','production',async url=>{if(decodeURIComponent(String(url)).includes('/resources/recitations?')){catalogs++;return catalogs===1?new Response('{}',{status:503}):Response.json({recitations:[{id:7,reciter_name:'Publisher reciter'}]});}return Response.json(snapshot);},()=>true);
  await assert.rejects(provider.snapshot('/api/v4/resources/snapshots/recitations/7'));
  assert.equal((await provider.snapshot('/api/v4/resources/snapshots/recitations/7')).attribution?.name,'Publisher reciter');assert.equal(catalogs,2);
  snapshot.records=[];await assert.rejects(provider.snapshot('/api/v4/resources/snapshots/recitations/7'),/no ayah audio metadata/);
  const broken=new QuranFoundationProvider('https://content.example.test','production',async()=>new Response('<html>gateway</html>',{status:502}),()=>true);await assert.rejects(broken.resources('recitations'),/unreadable response/);
});
test('English tafsir attribution comes from source language and author, not localized display names',async()=>{
  let language='arabic';const provider=new QuranFoundationProvider('https://content.example.test','production',async url=>decodeURIComponent(String(url)).includes('/resources/tafsirs?')?Response.json({tafsirs:[{id:169,name:'Publisher title',author_name:'Publisher author',language_name:language,translated_name:{name:'English display title',language_name:'english'}}]}):Response.json({resource_group:'tafsirs',resource_id:169,resource_content_id:169,schema_version:1,sync_sequence:1,records:[{text:'Exact source passage',start_verse_id:1,end_verse_id:7}]}),()=>true);
  await assert.rejects(provider.snapshot('/api/v4/resources/snapshots/tafsirs/169'),/not identified as English/);
  language='english';const english=new QuranFoundationProvider('https://content.example.test','production',async url=>decodeURIComponent(String(url)).includes('/resources/tafsirs?')?Response.json({tafsirs:[{id:169,name:'Publisher title',author_name:'Publisher author',language_name:language}]}):Response.json({resource_group:'tafsirs',resource_id:169,resource_content_id:169,schema_version:1,sync_sequence:1,records:[{text:'Exact source passage',start_verse_id:1,end_verse_id:7}]}),()=>true);
  const result=await english.snapshot('/api/v4/resources/snapshots/tafsirs/169');assert.equal(result.attribution?.language,'english');assert.equal(result.attribution?.author,'Publisher author');assert.equal(result.attribution?.translator,undefined);
});
test('revocation while waiting for SQLite completion transaction rolls back offline publication',async()=>{
  const {db,close}=database();const native=runtime();let allowed=true;const wrapped:Database={...db,withTransactionAsync:async work=>{allowed=false;return db.withTransactionAsync(work);}};
  try{await assert.rejects(transferQuranAudio(wrapped,[files[0]],()=>allowed,native.api,()=>undefined),/disabled/);assert.equal(native.local.size,0);assert.equal((await db.getFirstAsync<{status:string}>('SELECT status FROM downloads WHERE id=?','audio:1'))?.status,'failed');}finally{close();}
});
test('separate sync service instances cannot race one environment and revocation prevents checkpoint commit',async()=>{
  const snapshot:ResourceSnapshot={resource_group:'translations',resource_id:19,resource_content_id:19,schema_version:1,sync_sequence:1,records:[{id:1,verse_key:'1:1',text:'Source test record'}]};let commits=0;let allowed=true;let finish!:()=>void;let started!:()=>void;const start=new Promise<void>(resolve=>{started=resolve;});const release=new Promise<void>(resolve=>{finish=resolve;});
  const store:SyncStore={state:async()=>null,resource:async()=>null,resources:async()=>[],commit:async()=>{commits++;}};
  const provider={environment:'production',sync:async()=>{started();await release;return {sync:{sync_until_sequence:1,has_more:false,next_page_url:null,next_sync_token:'checkpoint',mutations:[]}};},snapshot:async()=>snapshot};
  const pending=new QuranSyncService(provider,store,()=>allowed).synchronize('translations:19');await start;
  await assert.rejects(new QuranSyncService(provider,store,()=>true).synchronize('translations:19'),/already running/);
  allowed=false;finish();await assert.rejects(pending,/disabled/);assert.equal(commits,0);
});
