import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage,Server,ServerResponse} from 'node:http';
import {allowedQuranPath,createProxy,createContentHandler} from '../server/proxy.mjs';
import {readFileSync} from 'node:fs';

async function invoke(server:Server,url:string,method='GET',headers:Record<string,string>={}):Promise<{status:number;body:string}> {
  const handler=server.listeners('request')[0];
  return new Promise(resolve=>{let status=0;const response={setHeader:()=>undefined,writeHead:(code:number)=>{status=code;},end:(body='')=>resolve({status,body})} as unknown as ServerResponse;const request={url,method,headers,socket:{remoteAddress:'127.0.0.1'}} as unknown as IncomingMessage;handler(request,response);});
}
test('proxy rejects arbitrary upstream targets and unsafe methods, reports unavailable credentials',async()=>{
  assert.equal(allowedQuranPath('https://evil.test/api/v4/chapters'),false);assert.equal(allowedQuranPath('/api/v4/resources/snapshots/translations/19'),true);assert.equal(allowedQuranPath('/api/v4/resources/sync?cursor=opaque'),true);assert.equal(allowedQuranPath('/api/v4/../../private'),false);
  const server=createProxy({env:{NODE_ENV:'test',QF_ENV:'production'}});
  const result=await invoke(server,`/api/quran?environment=production&path=${encodeURIComponent('/api/v4/chapters')}`);assert.equal(result.status,503);
  const health=await invoke(server,'/health');assert.equal(JSON.parse(health.body).quranConfigured,false);assert.equal((await invoke(server,'/health','POST')).status,405);
  assert.equal((await invoke(server,'/health','GET',{origin:'https://untrusted.test'})).status,403);
});
test('hosted handler routes public publisher files unchanged and blocks arbitrary resource URLs',async()=>{
  const bytes=readFileSync(new URL('../src/content/fixtures/quran-transliteration-verbatim.txt',import.meta.url));
  const urls:string[]=[];
  const handler=createContentHandler({env:{QF_ENV:'production'},fetcher:async input=>{urls.push(String(input));return new Response(bytes);}});
  const response=await handler(new Request('https://site.example/content/api/resources/tanzil-transliteration'));
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  assert.deepEqual(urls,['https://tanzil.net/trans/en.transliteration']);
  assert.equal((await handler(new Request('https://site.example/content/api/resources/unknown?url=https://private.example'))).status,404);
  const health=await(await handler(new Request('https://site.example/content/health'))).json();assert.equal(health.environment,'production');assert.equal(health.quranConfigured,false);assert.deepEqual(health.publisherDownloads,['tanzil-arabic','tanzil-transliteration']);
});
test('proxy rejects publisher HTML and masks authentication diagnostics',async()=>{
  const handler=createContentHandler({env:{QF_CLIENT_ID:'server-id',QF_CLIENT_SECRET:'server-secret'},fetcher:async()=>new Response('<html>login</html>')});
  assert.equal((await handler(new Request('https://site.example/content/api/resources/tanzil-arabic'))).status,502);
  const failure=createContentHandler({env:{QF_CLIENT_ID:'server-id',QF_CLIENT_SECRET:'server-secret'},fetcher:async input=>String(input).includes('/oauth2/token')?Response.json({access_token:'secret-token',expires_in:3600}):Response.json({message:'server-secret secret-token'},{status:403})});
  const response=await failure(new Request(`https://site.example/content/api/quran?environment=production&path=${encodeURIComponent('/api/v4/resources/sync?bootstrap=true&resources=tafsirs:151')}`));
  const body=await response.text();assert.equal(response.status,403);assert.equal(body.includes('server-secret'),false);assert.equal(body.includes('secret-token'),false);assert.match(body,/not authorized/);
});
test('server OAuth secrets never appear in returned content responses',async()=>{
  const calls:{url:string;options:RequestInit}[]=[];
  const fetcher:typeof fetch=async(input,options)=>{const url=String(input);calls.push({url,options:options??{}});if(url.includes('/oauth2/token'))return new Response(JSON.stringify({access_token:'upstream-secret-token',expires_in:3600}),{status:200});return new Response(JSON.stringify({chapters:[]}),{status:200});};
  const server=createProxy({env:{NODE_ENV:'test',QF_ENV:'production',QF_CLIENT_ID:'server-id',QF_CLIENT_SECRET:'server-secret'},fetcher});
  const response=await invoke(server,`/api/quran?environment=production&path=${encodeURIComponent('/api/v4/chapters')}`);assert.equal(response.status,200);assert.equal(response.body.includes('server-secret'),false);assert.equal(response.body.includes('upstream-secret-token'),false);assert.equal(calls[0].url,'https://oauth2.quran.foundation/oauth2/token');assert.equal(calls[1].url,'https://apis.quran.foundation/content/api/v4/chapters');
  await invoke(server,`/api/quran?environment=production&path=${encodeURIComponent('/api/v4/chapters')}`);assert.equal(calls.filter(c=>c.url.includes('/oauth2/token')).length,1);
});
