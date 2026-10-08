import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const groups = 'articles|chapter_recitations|mushafs|quran_core|recitations|tafsirs|translations|word_by_word_translations|word_by_word_transliterations';
export function allowedQuranPath(path) {
  if (typeof path !== 'string' || path.length > 8192 || /[\\#\r\n]/.test(path) || path.includes('..')) return false;
  const base = path.split('?')[0];
  return /^\/api\/v4\/chapters$/.test(base) || /^\/api\/v4\/verses\/(?:by_chapter\/[1-9]\d{0,2}|by_key\/[1-9]\d{0,2}:[1-9]\d{0,2})$/.test(base) || /^\/api\/v4\/resources\/(?:sync|translations|tafsirs|recitations)$/.test(base) || new RegExp(`^/api/v4/resources/snapshots/(${groups})/[1-9]\\d*$`).test(base);
}

const publisherFiles = {
  'tanzil-transliteration': 'https://tanzil.net/trans/en.transliteration',
  'tanzil-arabic': 'https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true',
};

async function publisherFile(response) {
  if (!response.ok || !response.body) throw Object.assign(new Error('The publisher download is unavailable. Try again later; your previous offline copy is unchanged.'), {status:502});
  const reader=response.body.getReader();const chunks=[];let length=0;
  try {
    for (;;) {const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>3*1024*1024)throw Object.assign(new Error('The publisher file exceeded its expected size.'),{status:502});chunks.push(value);}
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=Buffer.concat(chunks);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(!/^1\|1\|/m.test(text)||!/^114\|6\|/m.test(text)||/^\s*</.test(text))throw Object.assign(new Error('The publisher did not return the expected Quran text file.'),{status:502});
  return bytes;
}

// Tanzil quran-data.xml ayah counts; used to verify the publisher's global ayah numbering.
export const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
// Islamic Network / Al Quran Cloud permits streaming and downloading recitations for personal and
// educational use (https://alquran.cloud/terms-and-conditions, section IV). Only this edition is routed.
const PUBLISHER_AUDIO = { edition: 'ar.alafasy', reciter: 'Mishary Rashid Alafasy', name: 'Islamic Network / Al Quran Cloud', licenseUrl: 'https://alquran.cloud/terms-and-conditions' };
const audioUrlPattern = /^https:\/\/cdn\.islamic\.network\/quran\/audio\/128\/ar\.alafasy\/([1-9]\d{0,3})\.mp3$/;

async function boundedJson(response, limit) {
  if (!response.ok || !response.body) throw Object.assign(new Error('The recitation publisher is unavailable. Try again later; saved recordings are unchanged.'), {status:502});
  const reader=response.body.getReader();const chunks=[];let length=0;
  try {
    for (;;) {const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit)throw Object.assign(new Error('The recitation list exceeded its expected size.'),{status:502});chunks.push(value);}
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
  catch {throw Object.assign(new Error('The recitation publisher returned an unreadable list.'),{status:502});}
}

/** Reduce the publisher response to verified per-ayah audio URLs; publisher text is never forwarded. */
export function publisherAudioMetadata(payload, surah) {
  const data=payload?.data;
  const count=AYAH_COUNTS[surah-1];
  const offset=AYAH_COUNTS.slice(0,surah-1).reduce((sum,value)=>sum+value,0);
  const invalid=()=>Object.assign(new Error('The recitation publisher returned an unexpected list. No audio will be downloaded.'),{status:502});
  if(payload?.code!==200||!data||data.number!==surah||data.edition?.identifier!==PUBLISHER_AUDIO.edition||data.edition?.format!=='audio'||!Array.isArray(data.ayahs)||data.ayahs.length!==count)throw invalid();
  const ayahs=data.ayahs.map((ayah,index)=>{
    const match=typeof ayah?.audio==='string'?audioUrlPattern.exec(ayah.audio):null;
    if(ayah?.numberInSurah!==index+1||ayah.number!==offset+index+1||!match||Number(match[1])!==ayah.number)throw invalid();
    return {key:`${surah}:${index+1}`,number:ayah.number,url:ayah.audio};
  });
  return {source:PUBLISHER_AUDIO,surah,ayahs};
}

/**
 * Shared handler used by the existing Node server and the hosted Netlify function.
 * @param {{env?: Record<string,string|undefined>, fetcher?: typeof fetch, now?: ()=>number}} [options]
 */
export function createContentHandler({env=process.env,fetcher=fetch,now=Date.now}={}) {
  const environment = env.QF_ENV || 'production';
  if (!['prelive','production'].includes(environment)) throw new Error('QF_ENV must be prelive or production');
  const domain = environment === 'production' ? 'apis.quran.foundation' : 'apis-prelive.quran.foundation';
  const authDomain = environment === 'production' ? 'oauth2.quran.foundation' : 'prelive-oauth2.quran.foundation';
  let accessToken = null;
  let tokenExpiry = 0;
  let pendingToken = null;
  const rates = new Map();
  async function token() {
    if (!env.QF_CLIENT_ID || !env.QF_CLIENT_SECRET) throw Object.assign(new Error('Quran Foundation credentials are not configured on the server.'),{status:503});
    if (accessToken && now() < tokenExpiry-60000) return accessToken;
    if (pendingToken) return pendingToken;
    pendingToken = (async () => {
      const response = await fetcher(`https://${authDomain}/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${env.QF_CLIENT_ID}:${env.QF_CLIENT_SECRET}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'content'}),signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw Object.assign(new Error('Quran Foundation server authentication failed.'),{status:502});
      const data = await response.json();
      if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') throw Object.assign(new Error('Invalid authentication response.'),{status:502});
      accessToken=data.access_token; tokenExpiry=now()+data.expires_in*1000; return accessToken;
    })();
    try { return await pendingToken; } finally {pendingToken=null;}
  }
  return async (req,{ip='unknown'}={}) => {
    const headers={'Cache-Control':'no-store'};
    const json = (status,payload) => {
      const body=Buffer.from(JSON.stringify(payload));const compressed=body.byteLength>500000&&req.headers.get('accept-encoding')?.includes('gzip');
      return new Response(compressed?gzipSync(body):body,{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...(compressed?{'Content-Encoding':'gzip'}:{})}});
    };
    const origin = req.headers.get('origin');
    if (origin) {
      const allowed = (env.ALLOWED_ORIGINS || 'http://localhost:8081').split(',').map(s=>s.trim());
      if (!allowed.includes(origin)) return json(403,{message:'Origin is not permitted.'});
      headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';headers['Access-Control-Allow-Methods']='GET,OPTIONS';
    }
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'GET') return json(405,{message:'Only GET is supported.'});
    if (rates.size > 10000) for (const [address,info] of rates) if (now()-info.at>60000) rates.delete(address);
    const info=rates.get(ip); if (!info || now()-info.at>60000) rates.set(ip,{at:now(),count:1}); else {info.count++;if(info.count>120)return json(429,{message:'Please wait before trying again.'});}
    try {
      const request = new URL(req.url);
      // Custom hosting path is a fixed prefix, not an arbitrary upstream target.
      const pathname=request.pathname.startsWith('/content/')?request.pathname.slice('/content'.length):request.pathname;
      if (pathname === '/health') return json(200,{status:'ok',environment,quranConfigured:Boolean(env.QF_CLIENT_ID&&env.QF_CLIENT_SECRET),hadithConfigured:Boolean(env.SUNNAH_API_KEY),publisherDownloads:['tanzil-arabic','tanzil-transliteration'],publisherAudio:[PUBLISHER_AUDIO.edition]});
      const audio=/^\/api\/audio\/alafasy\/([1-9]\d{0,2})$/.exec(pathname);
      if(audio){
        const surah=Number(audio[1]);
        if(surah>114)return json(404,{message:'Choose a surah from 1 to 114.'});
        const response=await fetcher(`https://api.alquran.cloud/v1/surah/${surah}/${PUBLISHER_AUDIO.edition}`,{signal:AbortSignal.timeout(30000),redirect:'error'});
        const body=publisherAudioMetadata(await boundedJson(response,4*1024*1024),surah);
        // Public metadata only; caching follows the publisher's fair-use request.
        return new Response(JSON.stringify(body),{headers:{...headers,'Cache-Control':'public, max-age=86400','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'}});
      }
      const publisher=/^\/api\/resources\/([a-z-]+)$/.exec(pathname);
      if(publisher){
        const url=publisherFiles[publisher[1]];
        if(!url)return json(404,{message:'Unknown publisher resource.'});
        const response=await fetcher(url,{signal:AbortSignal.timeout(30000),redirect:'error'});
        const bytes=await publisherFile(response);
        return new Response(bytes,{headers:{...headers,'Content-Type':'text/plain; charset=utf-8','Content-Length':String(bytes.byteLength),'X-Content-Type-Options':'nosniff'}});
      }
      if (pathname === '/api/quran') {
        const path=request.searchParams.get('path');
        if (!allowedQuranPath(path)) return json(400,{message:'Unsupported Quran API path.'});
        if (request.searchParams.get('environment') !== environment) return json(400,{message:`Proxy uses ${environment}; select the matching environment.`});
        let response=await fetcher(`https://${domain}/content${path}`,{headers:{'x-auth-token':await token(),'x-client-id':env.QF_CLIENT_ID},signal:AbortSignal.timeout(30000)});
        if (response.status===401) {accessToken=null;response=await fetcher(`https://${domain}/content${path}`,{headers:{'x-auth-token':await token(),'x-client-id':env.QF_CLIENT_ID},signal:AbortSignal.timeout(30000)});}
        // Return source content only on success; never forward upstream diagnostic bodies or tokens.
        if(!response.ok)return json(response.status,{message:response.status===403?'The selected Quran resource is not authorized for this server.':response.status===429?'The Quran service is busy. Wait and retry.':'The Quran service could not complete this request. Your previous offline content remains available.'});
        return json(response.status,await response.json());
      }
      const collectionRoute=pathname==='/api/hadith/collections';
      const hadithRoute=/^\/api\/hadith\/([a-z][a-z0-9_-]{0,40})\/([1-9]\d*[a-z]?)$/.exec(pathname);
      if (collectionRoute || hadithRoute) {
        if (!env.SUNNAH_API_KEY) return json(503,{message:'Sunnah.com credentials are not configured on the server.'});
        const path=collectionRoute ? '/v1/collections' : `/v1/collections/${hadithRoute[1]}/hadiths/${hadithRoute[2]}`;
        const response=await fetcher(`https://api.sunnah.com${path}`,{headers:{'X-API-Key':env.SUNNAH_API_KEY},signal:AbortSignal.timeout(30000)});
        if(!response.ok)return json(response.status,{message:'The Hadith service could not complete this request.'});
        return json(response.status,await response.json());
      }
      return json(404,{message:'Route not found.'});
    } catch(error) {return json(Number(error.status)||502,{message:error.status ? error.message : 'Content service is unavailable. Please retry. Your previous offline copy remains available.'});}
  };
}

/** @param {{env?: Record<string,string|undefined>, fetcher?: typeof fetch, now?: ()=>number}} [options] */
export function createProxy(options={}) {
  const handler=createContentHandler(options);
  return http.createServer(async(req,res)=>{
    const request=new Request(new URL(req.url || '/','http://localhost'),{method:req.method||'GET',headers:req.headers});
    const response=await handler(request,{ip:req.socket.remoteAddress||'unknown'});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port=Number(process.env.PORT || 8787); const host=process.env.HOST || '127.0.0.1';
  createProxy().listen(port,host,()=>console.log(`Content proxy listening on ${host}:${port}`));
}
