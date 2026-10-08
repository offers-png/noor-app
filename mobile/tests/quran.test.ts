import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import audioManifest from '../src/content/fixtures/quran-audio-manifest.json';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/database/migrations/001';
import type {Database,SqlValue} from '../src/services/database/types';
import {FixtureQuranProvider,SEEDED_AYAHS} from '../src/services/quran/FixtureQuranProvider';
import {QuranFoundationProvider,assertRelativeQfPath} from '../src/services/quran/QuranFoundationProvider';
import {QuranProviderError} from '../src/services/quran/QuranProvider';
import {QuranRepository,SQLiteQuranSyncStore,seedQuran} from '../src/services/quran/QuranRepository';
import {QuranSyncService,canonicalResourceFilter,needsQuranSync,validateSnapshot,type SyncStore} from '../src/services/quran/QuranSyncService';
import {arabicDisplayProps,displayedCanonicalText} from '../src/services/quran/presentation';
import {assertAudioDownloadUrl,audioCacheKey,audioDownloadPlan,estimateAudioDownloads,resolveQuranAudioUrl} from '../src/services/quran/QuranAudioDownloads';
import {parseAyahReference,verseIdForReference} from '../src/services/quran/QuranNavigation';
import {activeWordPosition,sourcedWordTimings} from '../src/services/quran/QuranTiming';
import {readQuranResourcePreferences,saveQuranResourcePreferences,type QuranResourcePreferences} from '../src/services/quran/QuranResourcePreferences';
import type {QuranSyncState,ResourceSnapshot,SyncMutation,SyncPage} from '../src/types/quran';

function database(){const native=new DatabaseSync(':memory:');const db:Database={execAsync:async sql=>{native.exec(sql);},runAsync:async(sql,...params:SqlValue[])=>{const result=native.prepare(sql).run(...params);return {changes:Number(result.changes),lastInsertRowId:Number(result.lastInsertRowid)};},getFirstAsync:async<T>(sql:string,...params:SqlValue[])=>native.prepare(sql).get(...params) as T??null,getAllAsync:async<T>(sql:string,...params:SqlValue[])=>native.prepare(sql).all(...params) as T[],withTransactionAsync:async work=>{native.exec('BEGIN');try{await work();native.exec('COMMIT');}catch(error){native.exec('ROLLBACK');throw error;}}};return {db,close:()=>native.close()};}
test('canonical fixture provider, SQLite and display preserve every sourced Quran string',async()=>{
  const source=readFileSync(new URL('../src/content/fixtures/quran-seed-verbatim.txt',import.meta.url),'utf8');
  const exactRows=source.split(/\r?\n/).filter(row=>/^\d+\|\d+\|/.test(row)).map(row=>{const [chapter,ayah,...parts]=row.split('|');return {key:`${chapter}:${ayah}`,text:parts.join('|')};});
  assert.equal(exactRows.length,29);
  const provider=new FixtureQuranProvider();const {db,close}=database();
  try{await db.execAsync(schema);await seedQuran(db);const repository=new QuranRepository(async()=>db);for(const row of exactRows){const result=await provider.verse(row.key);assert.equal(result?.canonicalText,row.text);const stored=await db.getFirstAsync<{canonical_text:string}>('SELECT canonical_text FROM ayahs WHERE verse_key=?',row.key);assert.equal(stored?.canonical_text,row.text);assert.equal(displayedCanonicalText(result!.canonicalText),row.text);assert.equal((await repository.verses(Number(row.key.split(':')[0]))).find(v=>v.key===row.key)?.canonicalText,row.text);}assert.equal((await provider.chapters()).length,114);assert.equal((await provider.chapters()).reduce((sum,c)=>sum+c.ayahCount,0),6236);assert.ok(SEEDED_AYAHS.every(v=>v.translation?.source.translator==='Talal Itani'));assert.equal(arabicDisplayProps(24).writingDirection,'rtl');assert.equal(arabicDisplayProps(24).fontSize,30);}finally{close();}
});
test('bookmarks are isolated between child profiles and survive repository recreation',async()=>{const {db,close}=database();try{await db.execAsync(schema);await db.runAsync('INSERT INTO children(id,nickname,avatar,created_at) VALUES (?,?,?,?)',1,'Yusuf','⭐','2026-10-07');await db.runAsync('INSERT INTO children(id,nickname,avatar,created_at) VALUES (?,?,?,?)',2,'Maryam','🌙','2026-10-07');const repo=new QuranRepository(async()=>db);await repo.toggleBookmark(1,'1:1');await repo.toggleBookmark(2,'112:1');assert.deepEqual(await new QuranRepository(async()=>db).bookmarks(1),['1:1']);assert.deepEqual(await repo.bookmarks(2),['112:1']);await repo.toggleBookmark(1,'1:1');assert.deepEqual(await repo.bookmarks(1),[]);}finally{close();}});
test('Quran Foundation provider never contacts network without parent opt-in',async()=>{let calls=0;const provider=new QuranFoundationProvider('https://proxy.test','production',async()=>{calls++;throw new Error('Unexpected call');});await assert.rejects(provider.chapters(),/parent/);assert.equal(calls,0);assert.throws(()=>assertRelativeQfPath('https://evil.test/api/v4/chapters'));assert.throws(()=>assertRelativeQfPath('/api/v4/chapters?url=../private'));});
test('Quran Foundation maps canonical Arabic exactly and reports missing API credentials',async()=>{const text=SEEDED_AYAHS[0].canonicalText;const fetcher=(async()=>new Response(JSON.stringify({verse:{verse_key:'1:1',text_uthmani:text}}),{status:200})) as typeof fetch;const provider=new QuranFoundationProvider('https://proxy.test','production',fetcher,()=>true);assert.equal((await provider.verse('1:1'))?.canonicalText,text);const missing=new QuranFoundationProvider('https://proxy.test','production',(async()=>new Response(JSON.stringify({message:'Credentials not configured'}),{status:503})) as typeof fetch,()=>true);await assert.rejects(missing.verse('1:1'),/Credentials not configured/);});
function mutation(type:SyncMutation['type'],sequence:number,extras:Partial<SyncMutation>={}):SyncMutation{return {type,sequence,resource_group:'translations',resource_id:19,record_type:null,record_key:null,snapshot_url:null,data:null,...extras};}
function page(mutations:SyncMutation[],more=false,next:string|null=null,token:string|null='new-token'):SyncPage{return {sync:{mutations,sync_until_sequence:20,has_more:more,next_page_url:next,next_sync_token:token}};}
function memoryStore(initial?:ResourceSnapshot){let state:QuranSyncState|null=null;const resources=new Map<string,ResourceSnapshot>();if(initial)resources.set(`${initial.resource_group}:${initial.resource_id}`,initial);let commits=0;const store:SyncStore={state:async()=>state,resource:async(_env,g,id)=>resources.get(`${g}:${id}`)??null,resources:async()=>[...resources.values()],commit:async(_env,changes,next)=>{for(const [k,value] of changes)if(value)resources.set(k,value);else resources.delete(k);state=next;commits++;}};return {store,resources,state:()=>state,commits:()=>commits};}
const snapshot:ResourceSnapshot={resource_group:'translations',resource_id:19,resource_content_id:19,schema_version:1,sync_sequence:25,records:[{id:1,verse_key:'1:1',text:'source text'}]};
test('sync follows returned pagination unchanged, applies snapshots then rows and stores final token once',async()=>{const mem=memoryStore();const paths:string[]=[];const next='/api/v4/resources/sync?cursor=OPAQUE%2Ftoken';const provider={environment:'production',sync:async(path:string)=>{paths.push(path);return paths.length===1?page([mutation('RESOURCE_CREATE',1,{snapshot_url:'/api/v4/resources/snapshots/translations/19'})],true,next,null):page([mutation('ROW_UPDATE',2,{record_type:'translation',record_key:'1',data:{id:1,verse_key:'1:1',text:'corrected source text'}})]);},snapshot:async()=>snapshot};await new QuranSyncService(provider,mem.store,()=>true).synchronize('translations:19');assert.equal(paths[1],next);assert.equal(mem.commits(),1);assert.equal(mem.state()?.syncToken,'new-token');assert.equal(mem.resources.get('translations:19')?.records[0].text,'corrected source text');assert.equal(mem.resources.get('translations:19')?.sync_sequence,25);});
test('failed snapshot never advances checkpoint or replaces previous content',async()=>{const mem=memoryStore(snapshot);const provider={environment:'production',sync:async()=>page([mutation('RESOURCE_INVALIDATE',1,{snapshot_url:'/api/v4/resources/snapshots/translations/19'})]),snapshot:async()=>{throw new Error('Connection lost');}};await assert.rejects(new QuranSyncService(provider,mem.store,()=>true).synchronize('translations:19'),/Connection lost/);assert.equal(mem.commits(),0);assert.equal(mem.resources.get('translations:19'),snapshot);});
test('deleted resources and snapshot_not_found are removed while row delete uses stable record key',async()=>{const mem=memoryStore(snapshot);const provider={environment:'production',sync:async()=>page([mutation('RESOURCE_CREATE',1,{snapshot_url:'/api/v4/resources/snapshots/translations/19'})]),snapshot:async()=>{throw new QuranProviderError('Not public',404,'snapshot_not_found');}};await new QuranSyncService(provider,mem.store,()=>true).synchronize('translations:19');assert.equal(mem.resources.has('translations:19'),false);const mem2=memoryStore(snapshot);const p2={environment:'production',sync:async()=>page([mutation('RESOURCE_CREATE',1,{snapshot_url:'/api/v4/resources/snapshots/translations/19'}),mutation('ROW_DELETE',2,{record_type:'translation',record_key:'1'})]),snapshot:async()=>snapshot};await new QuranSyncService(p2,mem2.store,()=>true).synchronize('translations:19');assert.equal(mem2.resources.get('translations:19')?.records.length,0);});
test('sync rejects out-of-filter changes and recovers an invalid token with bootstrap',async()=>{const mem=memoryStore();let calls=0;const provider={environment:'production',sync:async(path:string)=>{calls++;if(calls===1)throw new QuranProviderError('Bootstrap required',410,'resync_required');assert.ok(path.includes('bootstrap=true'));return page([]);},snapshot:async()=>snapshot};await new QuranSyncService(provider,mem.store,()=>true).synchronize('translations:19');assert.equal(calls,2);const bad={...provider,sync:async()=>page([mutation('RESOURCE_DELETE',1,{resource_id:999})])};await assert.rejects(new QuranSyncService(bad,mem.store,()=>true).synchronize('translations:19'),/scope/);});
test('canonical filters, environment tokens, and seven-day refresh behave correctly',async()=>{assert.equal(canonicalResourceFilter('translations:19,1;translations:19;quran_core:1'),'quran_core:1;translations:1,19');assert.throws(()=>canonicalResourceFilter('quran_core:2'));assert.throws(()=>canonicalResourceFilter('quran_core:*'));assert.equal(needsQuranSync('2026-10-01',false,Date.parse('2026-10-08')),false);assert.equal(needsQuranSync('2026-10-01',true,Date.parse('2026-10-08')),true);const {db,close}=database();try{await db.execAsync(schema);const store=new SQLiteQuranSyncStore(db);await store.commit('production',new Map([['translations:19',snapshot]]),{environment:'production',filter:'translations:19',syncToken:'production-token',lastSync:'2026-10-07',status:'complete'});assert.equal((await store.state('production','translations:19'))?.syncToken,'production-token');assert.equal(await store.state('prelive','translations:19'),null);assert.equal(await store.state('production','translations:20'),null);}finally{close();}});
test('audio download requires parent permission and reliable size, cache key changes when source changes',async()=>{const plan=[{id:'a',resource:'recitations',resourceId:'7',verseKey:'1:1',url:'https://audio.quran.test/001001.mp3'}];let calls=0;const fetcher=(async()=>{calls++;return new Response(null,{status:200,headers:{'content-length':'1200'}});}) as typeof fetch;await assert.rejects(estimateAudioDownloads(plan,()=>false,fetcher),/disabled/);assert.equal(calls,0);assert.equal((await estimateAudioDownloads(plan,()=>true,fetcher)).totalBytes,1200);await assert.rejects(estimateAudioDownloads(plan,()=>true,(async()=>new Response(null,{status:200})) as typeof fetch),/reliable size/);assert.throws(()=>assertAudioDownloadUrl('http://127.0.0.1/audio'));assert.notEqual(audioCacheKey(7,'1:1','https://source/a','v1'),audioCacheKey(7,'1:1','https://source/a','v2'));});
test('all bundled recitation files match publisher manifest checksums and ayah references',()=>{assert.equal(audioManifest.clips.length,29);for(const clip of audioManifest.clips){const data=readFileSync(new URL(`../assets/quran/${clip.file}`,import.meta.url));assert.equal(data.length,clip.bytes);assert.equal(createHash('sha256').update(data).digest('hex').toUpperCase(),clip.sha256);assert.ok(SEEDED_AYAHS.some(v=>v.key===clip.key&&v.audio?.url===clip.url));assert.equal(clip.edition,'ar.alafasy');}});
test('partial prelive canonical snapshot is rejected rather than silently replacing complete Quran',()=>{assert.throws(()=>validateSnapshot({...snapshot,resource_group:'quran_core',resource_id:1,records:[]}),/incomplete/);});
test('sync snapshot preserves the translator attribution returned by the source listing',async()=>{const fetcher:typeof fetch=async(input)=>{const path=new URL(String(input)).searchParams.get('path')??'';return path.includes('/snapshots/')?new Response(JSON.stringify(snapshot),{status:200}):new Response(JSON.stringify({translations:[{id:19,name:'Source translation title',author_name:'Source translator'}]}),{status:200});};const provider=new QuranFoundationProvider('https://proxy.test','production',fetcher,()=>true);const result=await provider.snapshot('/api/v4/resources/snapshots/translations/19');assert.equal(result.attribution?.translator,'Source translator');assert.equal(result.attribution?.name,'Source translation title');assert.equal(result.records[0].text,snapshot.records[0].text);});
test('ayah-reference search accepts Arabic numerals and rejects references beyond sourced chapter counts',()=>{
  assert.deepEqual(parseAyahReference(' ۱۰۷ : ۲ '),{key:'107:2',surahNumber:107,ayahNumber:2});
  assert.deepEqual(parseAyahReference('١١٤:٦'),{key:'114:6',surahNumber:114,ayahNumber:6});
  assert.deepEqual(parseAyahReference('001:007'),{key:'1:7',surahNumber:1,ayahNumber:7});
  for(const invalid of ['0:1','115:1','1:8','114:7','107:0','107:2 extra','Al-Fatihah'])assert.equal(parseAyahReference(invalid),null);
  assert.equal(verseIdForReference('1:1'),1);assert.equal(verseIdForReference('108:1'),6205);assert.equal(verseIdForReference('114:6'),6236);
});
test('timed recitation follows exact source boundaries and never guesses absent or ambiguous word timings',()=>{
  const timing=sourcedWordTimings([[1,120,810],[2,820,1510],[0,0,50],[3,1000,900],['4',1600,1700],[4,1600,1700,0]]);
  assert.deepEqual(timing,[{position:1,startMs:120,endMs:810},{position:2,startMs:820,endMs:1510}]);
  assert.equal(activeWordPosition(timing,0.12),1);assert.equal(activeWordPosition(timing,0.81),undefined);assert.equal(activeWordPosition(timing,0.82),2);assert.equal(activeWordPosition(timing,1.51),undefined);
  assert.equal(activeWordPosition(undefined,0.3),undefined);assert.equal(activeWordPosition(timing,Number.NaN),undefined);assert.equal(sourcedWordTimings([]),undefined);
  assert.equal(activeWordPosition([{position:1,startMs:0,endMs:500},{position:2,startMs:100,endMs:400}],0.2),undefined);
  assert.ok(SEEDED_AYAHS.every(ayah=>ayah.audio?.wordTimings===undefined));
});
test('repository preserves ayah-file timing and applies nonempty tafsir ranges without changing canonical text',async()=>{
  const {db,close}=database();
  try{
    await db.execAsync(schema);await seedQuran(db);
    const tafsir:ResourceSnapshot={...snapshot,resource_group:'tafsirs',resource_id:818,records:[{id:1,verse_key:'1:1',start_verse_id:1,end_verse_id:1,text:''},{id:7,verse_key:'1:7',start_verse_id:1,end_verse_id:7,group_verse_key_from:'1:1',group_verse_key_to:'1:7',text:'Exact publisher range explanation.'}]};
    const recitation:ResourceSnapshot={...snapshot,resource_group:'recitations',resource_id:7,records:[{record_type:'audio_file',id:11,verse_key:'1:1',url:'https://audio.source.test/001001.mp3',segments:[[1,120,810],[2,820,1510]]},{record_type:'audio_file',id:12,verse_key:'1:2',url:'https://audio.source.test/001002.mp3',segments:[]},{record_type:'audio_segment',id:13,audio_file_id:21,verse_key:'1:2',timestamp_from:7000,timestamp_to:12000,segments:[[1,7300,7900]]}]};
    await new SQLiteQuranSyncStore(db).commit('production',new Map([['tafsirs:818',tafsir],['recitations:7',recitation]]),{environment:'production',filter:'tafsirs:818;recitations:7',syncToken:'checkpoint',lastSync:'2026-10-07',status:'complete'});
    const ayahs=await new QuranRepository(async()=>db).verses(1);
    for(const ayah of ayahs){assert.equal(ayah.canonicalText,SEEDED_AYAHS.find(source=>source.key===ayah.key)?.canonicalText);assert.equal(ayah.tafsir?.text,'Exact publisher range explanation.');assert.equal(ayah.tafsir?.source.reference,'1:1–1:7');}
    assert.deepEqual(ayahs[0].audio?.wordTimings,[{position:1,startMs:120,endMs:810},{position:2,startMs:820,endMs:1510}]);
    assert.equal(ayahs[1].audio?.wordTimings,undefined,'Chapter-file offsets must never highlight a different ayah audio file');
    assert.equal((await new QuranRepository(async()=>db).verses(107))[0].tafsir,undefined);
  }finally{close();}
});
test('audio estimate plan contains only the parent-selected recitation and chapter',()=>{
  const first:ResourceSnapshot={...snapshot,resource_group:'recitations',resource_id:7,records:[{record_type:'audio_file',id:1,verse_key:'1:1',url:'https://source.test/7-1.mp3'},{record_type:'audio_file',id:2,verse_key:'112:1',url:'https://source.test/7-112.mp3'}]};
  const second:ResourceSnapshot={...first,resource_id:10,records:[{record_type:'audio_file',id:3,verse_key:'1:1',url:'https://source.test/10-1.mp3'}]};
  const files=audioDownloadPlan([first,second],1,10);
  assert.equal(files.length,1);assert.equal(files[0].resourceId,'10');assert.equal(files[0].url,'https://source.test/10-1.mp3');
  assert.deepEqual(audioDownloadPlan([first,second],1,99),[]);
});
test('relative recitation paths use the official playback origin while snapshots and cache identity retain source URLs',async()=>{
  assert.equal(resolveQuranAudioUrl('Alafasy/mp3/001001.mp3'),'https://verses.quran.com/Alafasy/mp3/001001.mp3');
  assert.equal(resolveQuranAudioUrl('https://verses.quran.foundation/Alafasy/mp3/001001.mp3'),'https://verses.quran.foundation/Alafasy/mp3/001001.mp3');
  for(const invalid of ['//private.test/audio.mp3','http://localhost/audio.mp3','../audio.mp3','file:///private.mp3'])assert.throws(()=>resolveQuranAudioUrl(invalid));
  const {db,close}=database();
  try{
    await db.execAsync(schema);
    const recitation:ResourceSnapshot={...snapshot,resource_group:'recitations',resource_id:7,records:[{record_type:'audio_file',id:1,verse_key:'1:1',url:'Alafasy/mp3/001001.mp3',updated_at:'source-v1',segments:[[1,120,810]]}]};
    const store=new SQLiteQuranSyncStore(db);
    await store.commit('production',new Map([['recitations:7',recitation]]),{environment:'production',filter:'recitations:7',syncToken:'checkpoint',lastSync:'2026-10-07',status:'complete'});
    const file=audioDownloadPlan([recitation],1,7)[0];
    const ayah=(await new QuranRepository(async()=>db).verses(1))[0];
    assert.equal(ayah.audio?.url,file.url);assert.equal(ayah.audio?.downloadId,file.id);assert.equal((await store.resource('production','recitations',7))?.records[0].url,'Alafasy/mp3/001001.mp3');
  }finally{close();}
});
test('parent resource choices persist across repositories, stay environment scoped and keep fixture fallbacks after deletion',async()=>{
  const {db,close}=database();
  try{
    await db.execAsync(schema);
    const key='1:1';const canonical=SEEDED_AYAHS[0].canonicalText;
    const core:ResourceSnapshot={...snapshot,resource_group:'quran_core',resource_id:1,records:[{record_type:'verse',id:1,chapter_id:1,verse_number:1,verse_key:key,text_uthmani:canonical},{record_type:'word',id:1,verse_id:1,verse_key:key,position:1,char_type_name:'word',text_indopak:canonical.split(' ')[0]}]};
    const changes=new Map<string,ResourceSnapshot|null>([['quran_core:1',core]]);
    const selected:QuranResourcePreferences={translations:20,recitations:20,tafsirs:20,word_by_word_translations:20,word_by_word_transliterations:20};
    for(const group of Object.keys(selected) as (keyof QuranResourcePreferences)[])for(const id of [10,20]){
      const records=group==='recitations'?[{record_type:'audio_file',id,verse_key:key,url:`https://source.test/${id}.mp3`}]:group.startsWith('word_by_word')?[{id,word_id:1,text:`Source ${id} word layer`}]:group==='tafsirs'?[{id,verse_key:key,start_verse_id:1,end_verse_id:1,text:`Source ${id} explanation`}]:[{id,verse_key:key,text:`Source ${id} translation`}];
      changes.set(`${group}:${id}`,{...snapshot,resource_group:group,resource_id:id,records});
    }
    const store=new SQLiteQuranSyncStore(db);const state:QuranSyncState={environment:'production',filter:'translations:10,20',syncToken:'checkpoint',lastSync:'2026-10-07',status:'complete'};
    await store.commit('production',changes,state);
    await saveQuranResourcePreferences(db,'production',selected,()=>true);
    assert.deepEqual(await readQuranResourcePreferences(db,'production'),selected);
    assert.deepEqual(await readQuranResourcePreferences(db,'prelive'),{});
    const ayah=(await new QuranRepository(async()=>db).verses(1))[0];
    assert.equal(ayah.canonicalText,canonical);assert.equal(ayah.translation?.text,'Source 20 translation');assert.equal(ayah.audio?.url,'https://source.test/20.mp3');assert.equal(ayah.tafsir?.text,'Source 20 explanation');assert.equal(ayah.words?.[0].translation?.text,'Source 20 word layer');assert.equal(ayah.words?.[0].transliteration?.text,'Source 20 word layer');
    await assert.rejects(saveQuranResourcePreferences(db,'production',{translations:10},()=>false),/Parent-enabled/);
    let permissionChecks=0;await assert.rejects(saveQuranResourcePreferences(db,'production',{translations:10},()=>++permissionChecks===1),/previous content selection/);
    await assert.rejects(saveQuranResourcePreferences(db,'production',{translations:999},()=>true),/not downloaded/);
    assert.equal((await readQuranResourcePreferences(db,'production')).translations,20);
    await store.commit('production',new Map(Object.keys(selected).map(group=>[`${group}:20`,null])),state);
    const fallback=(await new QuranRepository(async()=>db).verses(1))[0];
    assert.equal(fallback.canonicalText,canonical);assert.equal(fallback.translation?.text,SEEDED_AYAHS[0].translation?.text);assert.equal(fallback.audio?.url,SEEDED_AYAHS[0].audio?.url);assert.equal(fallback.tafsir,undefined);assert.equal(fallback.words?.[0].translation,undefined);
  }finally{close();}
});
