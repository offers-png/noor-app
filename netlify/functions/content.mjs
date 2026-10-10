import { createContentHandler } from '../../mobile/server/proxy.mjs';

// This object stays on the server. No OAuth credentials or tokens enter the mobile bundle.
const env=Object.fromEntries(['QF_CLIENT_ID','QF_CLIENT_SECRET','QF_ENV','SUNNAH_API_KEY','ALLOWED_ORIGINS','YOUTUBE_API_KEY','YOUTUBE_ALLOWED_CHANNEL_IDS'].map(name=>[name,Netlify.env.get(name)]));
const handle=createContentHandler({env});
export default (request,context)=>handle(request,{ip:context.ip});
export const config={
  path:'/content/*',
  rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:120},
};
