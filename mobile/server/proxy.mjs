import http from 'node:http';
import { pathToFileURL } from 'node:url';

const groups = 'articles|chapter_recitations|mushafs|quran_core|recitations|tafsirs|translations|word_by_word_translations|word_by_word_transliterations';
export function allowedQuranPath(path) {
  if (typeof path !== 'string' || path.length > 8192 || /[\\#\r\n]/.test(path) || path.includes('..')) return false;
  const base = path.split('?')[0];
  return /^\/api\/v4\/chapters$/.test(base) || /^\/api\/v4\/verses\/(?:by_chapter\/[1-9]\d{0,2}|by_key\/[1-9]\d{0,2}:[1-9]\d{0,2})$/.test(base) || /^\/api\/v4\/resources\/(?:sync|translations|tafsirs|recitations)$/.test(base) || new RegExp(`^/api/v4/resources/snapshots/(${groups})/[1-9]\\d*$`).test(base);
}

export function createProxy({env=process.env,fetcher=fetch,now=Date.now}={}) {
  const environment = env.QF_ENV || 'prelive';
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
  return http.createServer(async (req,res) => {
    const json = (status,payload) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));};
    const origin = req.headers.origin;
    if (origin) {
      const allowed = (env.ALLOWED_ORIGINS || 'http://localhost:8081').split(',').map(s=>s.trim());
      if (!allowed.includes(origin)) {json(403,{message:'Origin is not permitted.'});return;}
      res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
    }
    if (req.method === 'OPTIONS') {res.writeHead(204);res.end();return;}
    if (req.method !== 'GET') {json(405,{message:'Only GET is supported.'});return;}
    const ip=req.socket.remoteAddress || 'unknown';
    if (rates.size > 10000) for (const [address,info] of rates) if (now()-info.at>60000) rates.delete(address);
    const info=rates.get(ip); if (!info || now()-info.at>60000) rates.set(ip,{at:now(),count:1}); else {info.count++;if(info.count>120){json(429,{message:'Please wait before trying again.'});return;}}
    try {
      const request = new URL(req.url || '/', 'http://localhost');
      if (request.pathname === '/health') {json(200,{status:'ok',environment,quranConfigured:Boolean(env.QF_CLIENT_ID&&env.QF_CLIENT_SECRET),hadithConfigured:Boolean(env.SUNNAH_API_KEY)});return;}
      if (request.pathname === '/api/quran') {
        const path=request.searchParams.get('path');
        if (!allowedQuranPath(path)) {json(400,{message:'Unsupported Quran API path.'});return;}
        if (request.searchParams.get('environment') !== environment) {json(400,{message:`Proxy uses ${environment}; select the matching environment.`});return;}
        let response=await fetcher(`https://${domain}/content${path}`,{headers:{'x-auth-token':await token(),'x-client-id':env.QF_CLIENT_ID},signal:AbortSignal.timeout(30000)});
        if (response.status===401) {accessToken=null;response=await fetcher(`https://${domain}/content${path}`,{headers:{'x-auth-token':await token(),'x-client-id':env.QF_CLIENT_ID},signal:AbortSignal.timeout(30000)});}
        const payload=await response.json();json(response.status,payload);return;
      }
      const collectionRoute=request.pathname==='/api/hadith/collections';
      const hadithRoute=/^\/api\/hadith\/([a-z][a-z0-9_-]{0,40})\/([1-9]\d*[a-z]?)$/.exec(request.pathname);
      if (collectionRoute || hadithRoute) {
        if (!env.SUNNAH_API_KEY) {json(503,{message:'Sunnah.com credentials are not configured on the server.'});return;}
        const path=collectionRoute ? '/v1/collections' : `/v1/collections/${hadithRoute[1]}/hadiths/${hadithRoute[2]}`;
        const response=await fetcher(`https://api.sunnah.com${path}`,{headers:{'X-API-Key':env.SUNNAH_API_KEY},signal:AbortSignal.timeout(30000)});
        json(response.status,await response.json());return;
      }
      json(404,{message:'Route not found.'});
    } catch(error) {json(Number(error.status)||502,{message:error.status ? error.message : 'Content service is unavailable. Please retry.'});}
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port=Number(process.env.PORT || 8787); const host=process.env.HOST || '127.0.0.1';
  createProxy().listen(port,host,()=>console.log(`Content proxy listening on ${host}:${port}`));
}
