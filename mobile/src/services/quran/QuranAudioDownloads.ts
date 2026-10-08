import type { Database } from '../database/types';
import type { ResourceSnapshot } from '../../types/quran';
import { QuranProviderError } from './QuranProvider';
import { transferQuranAudio, verifiedAudioPath, type AudioDownloadOptions, type AudioDownloadRuntime } from './QuranAudioDownloadEngine';

export interface QuranAudioDownload {id:string;resource:string;resourceId:string;verseKey:string;url:string;bytes?:number}
export function audioCacheKey(resourceId:number,key:string,url:string,updatedAt:unknown):string{return `quran-audio:${resourceId}:${key}:${url}:${typeof updatedAt==='string'?updatedAt:''}`;}
/** Match the official Quran Foundation SDK; raw snapshot URLs remain untouched in storage. */
export function resolveQuranAudioUrl(sourceUrl:string):string{
  if(sourceUrl.startsWith('https://')){assertAudioDownloadUrl(sourceUrl);return sourceUrl;}
  if(sourceUrl.startsWith('//') || sourceUrl.includes('..') || !/^\/?[a-zA-Z0-9_./%-]+$/.test(sourceUrl))throw new QuranProviderError('Unsupported recitation source URL.');
  return `https://verses.quran.com/${sourceUrl.replace(/^\//,'')}`;
}
export function audioDownloadPlan(resources: ResourceSnapshot[], surahNumber: number, recitationId?: number): QuranAudioDownload[] {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) throw new QuranProviderError('Choose a surah number from 1 to 114.');
  const plan = resources.filter(r=>r.resource_group==='recitations' && (recitationId===undefined || r.resource_id===recitationId)).flatMap(resource=>resource.records.filter(row=>row.record_type==='audio_file' && typeof row.verse_key==='string' && row.verse_key.startsWith(`${surahNumber}:`) && typeof row.url==='string').map(row=>({id:audioCacheKey(resource.resource_id,row.verse_key as string,row.url as string,row.updated_at),resource:'recitations',resourceId:String(resource.resource_id),verseKey:row.verse_key as string,url:resolveQuranAudioUrl(row.url as string)})));
  if (new Set(plan.map(file=>`${file.resourceId}:${file.verseKey}`)).size !== plan.length) throw new QuranProviderError('The source returned duplicate recordings. Sync the recitation again before downloading.');
  return plan.sort((a,b)=>Number(a.verseKey.split(':')[1])-Number(b.verseKey.split(':')[1]));
}
export function assertAudioDownloadUrl(url:string):void {
  const parsed = new URL(url);
  if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.hostname==='localhost' || /^[\d.]+$/.test(parsed.hostname) || parsed.hostname.includes(':') || parsed.hostname.endsWith('.local'))throw new QuranProviderError('Recitation downloads require a public HTTPS source URL.');
}
/** Prefer HEAD; fall back to a one-byte range request when a CDN omits Content-Length on HEAD. */
async function sourceBytes(fetcher:typeof fetch,url:string,signal:AbortSignal):Promise<{ok:boolean;bytes:number;type:string}> {
  const head=await fetcher(url,{method:'HEAD',signal});
  const type=head.headers.get('content-type')??'';
  const bytes=Number(head.headers.get('content-length'));
  if(head.ok&&Number.isSafeInteger(bytes)&&bytes>0)return {ok:true,bytes,type};
  const range=await fetcher(url,{headers:{Range:'bytes=0-0'},signal});
  try{await range.body?.cancel();}catch{/* Only the headers are needed. */}
  const total=Number(/\/(\d+)\s*$/.exec(range.headers.get('content-range')??'')?.[1]);
  return {ok:range.status===206,bytes:total,type:range.headers.get('content-type')??type};
}
export async function estimateAudioDownloads(plan: QuranAudioDownload[], networkAllowed:()=>boolean, fetcher:typeof fetch=fetch, signal?:AbortSignal, concurrency=6): Promise<{files:QuranAudioDownload[];totalBytes:number}> {
  if(!plan.length)throw new QuranProviderError('No recordings are available for this selection yet. Get the recitation list first.');
  const files:QuranAudioDownload[]=new Array(plan.length);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(20000,plan.length*2000));
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const monitor=setInterval(()=>{if(!networkAllowed())controller.abort();},250);
  let next=0;let failure:QuranProviderError|undefined;
  async function worker(){
    while(!failure&&next<plan.length){
      const index=next++;const file=plan[index];
      try {
        if(!networkAllowed()||signal?.aborted)throw new QuranProviderError('Network access is disabled or the size check was cancelled.');
        assertAudioDownloadUrl(file.url);
        const result=await sourceBytes(fetcher,file.url,controller.signal);
        if(!networkAllowed()||signal?.aborted)throw new QuranProviderError('The size check was cancelled. Enable network access to try again.');
        if(!result.ok || !Number.isSafeInteger(result.bytes) || result.bytes<=0 || /(?:text\/html|application\/json)/i.test(result.type))throw new QuranProviderError(`The source did not provide a reliable size for ${file.verseKey}; no audio will be downloaded.`);
        files[index]={...file,bytes:result.bytes};
      } catch(error) {
        failure??=error instanceof QuranProviderError?error:new QuranProviderError(!networkAllowed()||signal?.aborted?'The size check was cancelled. Enable network access to try again.':'Audio sizes could not be checked. Check your connection and try again.');
        controller.abort();
      }
    }
  }
  try { await Promise.all(Array.from({length:Math.max(1,Math.min(concurrency,plan.length))},worker)); }
  finally {clearTimeout(timer);clearInterval(monitor);signal?.removeEventListener('abort',abort);}
  if(failure)throw failure;
  const totalBytes=files.reduce((sum,file)=>sum+file.bytes!,0);
  if(!Number.isSafeInteger(totalBytes))throw new QuranProviderError('The audio size estimate is invalid. No download started.');
  return {files,totalBytes};
}
async function nativeAudioRuntime():Promise<AudioDownloadRuntime>{
  const {Directory,File,Paths,DownloadTask}=await import('expo-file-system');
  const directory=new Directory(Paths.document,'quran-audio');directory.create({idempotent:true,intermediates:true});
  return {
    inspect(uri){const file=new File(uri);return {exists:file.exists,size:file.exists?file.size:0};},
    availableBytes:()=>Paths.availableDiskSpace,
    create(file,signal,progress){
      assertAudioDownloadUrl(file.url);
      const destination=new File(directory,`${Date.now()}-${file.resourceId}-${file.verseKey.replace(':','-')}-${Math.random().toString(36).slice(2)}.mp3`);
      const task=new DownloadTask(file.url,destination,{signal,sessionType:'foreground',onProgress:data=>progress(data.bytesWritten)});
      return {download:async()=>{const output=await task.downloadAsync();return output?.exists?{uri:output.uri,size:output.size}:null;},remove:()=>{if(destination.exists)destination.delete();},release:()=>task.release()};
    },
  };
}
export async function verifiedLocalQuranAudio(db:Database,downloadId:string,runtime?:Pick<AudioDownloadRuntime,'inspect'>):Promise<string|undefined>{
  if(!runtime && !await db.getFirstAsync('SELECT path FROM downloads WHERE id=? AND status=? AND path IS NOT NULL',downloadId,'complete'))return undefined;
  return verifiedAudioPath(db,downloadId,runtime??await nativeAudioRuntime());
}
export async function downloadQuranAudio(db:Database,files:QuranAudioDownload[],networkAllowed:()=>boolean,onProgress:(completed:number,total:number)=>void,options:AudioDownloadOptions&{runtime?:AudioDownloadRuntime}={}):Promise<void>{
  for(const file of files)assertAudioDownloadUrl(file.url);
  await transferQuranAudio(db,files,networkAllowed,options.runtime??await nativeAudioRuntime(),onProgress,options);
}
