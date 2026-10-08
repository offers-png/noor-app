import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schema} from '../src/database/migrations/001';
import {checkContentConnection,loadContentConnection,saveContentConnection,validateContentConnection} from '../src/services/quran/ContentConnection';
import {testDb} from './database.test';

test('connection accepts public HTTPS paths but rejects secrets and release cleartext',()=>{
  assert.deepEqual(validateContentConnection({url:' https://content.example/content/ ',environment:'production'}),{url:'https://content.example/content',environment:'production'});
  for(const url of ['http://10.0.2.2:8787','https://secret@content.example','https://content.example?token=secret','https://content.example#secret','file:///a'])assert.throws(()=>validateContentConnection({url,environment:'production'}));
  assert.equal(validateContentConnection({url:'http://10.0.2.2:8787',environment:'prelive'},true).url,'http://10.0.2.2:8787');
});
test('parent connection persists with public fallback and requires a current parent session',async()=>{
  const {db,close}=testDb();try{
    await db.execAsync(schema);assert.equal(await loadContentConnection(db),null);
    const fallback={url:'https://fallback.example/content',environment:'production'} as const;
    assert.deepEqual(await loadContentConnection(db,fallback),fallback);
    await assert.rejects(saveContentConnection(db,fallback,()=>false),/parent PIN/);
    const custom={url:'https://custom.example',environment:'prelive'} as const;
    await saveContentConnection(db,custom,()=>true);assert.deepEqual(await loadContentConnection(db,fallback),custom);
    await db.runAsync('UPDATE app_settings SET value_json=? WHERE key=?','broken','content-connection:v1');
    await assert.rejects(loadContentConnection(db,fallback),/Parent Mode/);
  }finally{close();}
});
test('server check respects consent, detects environment, and never treats configured credentials as live integration proof',async()=>{
  const settings={url:'https://content.example/content',environment:'production'} as const;let calls=0;
  const fetcher:typeof fetch=async input=>{calls++;assert.equal(String(input),'https://content.example/content/health');return Response.json({status:'ok',environment:'production',quranConfigured:false,hadithConfigured:false,publisherDownloads:['tanzil-transliteration']});};
  await assert.rejects(checkContentConnection(settings,()=>false,fetcher),/Enable optional/);assert.equal(calls,0);
  assert.equal((await checkContentConnection(settings,()=>true,fetcher)).quranConfigured,false);
  await assert.rejects(checkContentConnection({...settings,environment:'prelive'},()=>true,fetcher),/matching environment/);
  await assert.rejects(checkContentConnection(settings,()=>true,async()=>new Response('<html>login</html>')),/could not be checked/);
  let consent=true;
  await assert.rejects(checkContentConnection(settings,()=>consent,async()=>{consent=false;return Response.json({status:'ok',environment:'production',quranConfigured:true,hadithConfigured:false});}),/disabled/);
});
