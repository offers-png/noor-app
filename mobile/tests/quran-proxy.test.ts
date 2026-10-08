import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage,Server,ServerResponse} from 'node:http';
import {allowedQuranPath,createProxy} from '../server/proxy.mjs';

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
test('server OAuth secrets never appear in returned content responses',async()=>{
  const calls:{url:string;options:RequestInit}[]=[];
  const fetcher:typeof fetch=async(input,options)=>{const url=String(input);calls.push({url,options:options??{}});if(url.includes('/oauth2/token'))return new Response(JSON.stringify({access_token:'upstream-secret-token',expires_in:3600}),{status:200});return new Response(JSON.stringify({chapters:[]}),{status:200});};
  const server=createProxy({env:{NODE_ENV:'test',QF_ENV:'production',QF_CLIENT_ID:'server-id',QF_CLIENT_SECRET:'server-secret'},fetcher});
  const response=await invoke(server,`/api/quran?environment=production&path=${encodeURIComponent('/api/v4/chapters')}`);assert.equal(response.status,200);assert.equal(response.body.includes('server-secret'),false);assert.equal(response.body.includes('upstream-secret-token'),false);assert.equal(calls[0].url,'https://oauth2.quran.foundation/oauth2/token');assert.equal(calls[1].url,'https://apis.quran.foundation/content/api/v4/chapters');
  await invoke(server,`/api/quran?environment=production&path=${encodeURIComponent('/api/v4/chapters')}`);assert.equal(calls.filter(c=>c.url.includes('/oauth2/token')).length,1);
});
