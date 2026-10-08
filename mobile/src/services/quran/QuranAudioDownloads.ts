import type { Database } from '../database/types';
import type { ResourceSnapshot } from '../../types/quran';
import { QuranProviderError } from './QuranProvider';

export interface QuranAudioDownload {id:string;resource:string;resourceId:string;verseKey:string;url:string;bytes?:number}
export function audioCacheKey(resourceId:number,key:string,url:string,updatedAt:unknown):string{return `quran-audio:${resourceId}:${key}:${url}:${typeof updatedAt==='string'?updatedAt:''}`;}
/** Match the official Quran Foundation SDK; raw snapshot URLs remain untouched in storage. */
export function resolveQuranAudioUrl(sourceUrl:string):string{
  if(sourceUrl.startsWith('https://')){assertAudioDownloadUrl(sourceUrl);return sourceUrl;}
  if(sourceUrl.startsWith('//') || sourceUrl.includes('..') || !/^\/?[a-zA-Z0-9_./%-]+$/.test(sourceUrl))throw new QuranProviderError('Unsupported recitation source URL.');
  return `https://verses.quran.com/${sourceUrl.replace(/^\//,'')}`;
}
export function audioDownloadPlan(resources: ResourceSnapshot[], surahNumber: number, recitationId?: number): QuranAudioDownload[] {
  return resources.filter(r=>r.resource_group==='recitations' && (recitationId===undefined || r.resource_id===recitationId)).flatMap(resource=>resource.records.filter(row=>row.record_type==='audio_file' && typeof row.verse_key==='string' && row.verse_key.startsWith(`${surahNumber}:`) && typeof row.url==='string').map(row=>({id:audioCacheKey(resource.resource_id,row.verse_key as string,row.url as string,row.updated_at),resource:'recitations',resourceId:String(resource.resource_id),verseKey:row.verse_key as string,url:resolveQuranAudioUrl(row.url as string)})));
}
export function assertAudioDownloadUrl(url:string):void {
  const parsed = new URL(url);
  if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.hostname==='localhost' || /^[\d.]+$/.test(parsed.hostname) || parsed.hostname.endsWith('.local'))throw new QuranProviderError('Recitation downloads require a public HTTPS source URL.');
}
export async function estimateAudioDownloads(plan: QuranAudioDownload[], networkAllowed:()=>boolean, fetcher:typeof fetch=fetch): Promise<{files:QuranAudioDownload[];totalBytes:number}> {
  let totalBytes=0;
  const files:QuranAudioDownload[]=[];
  for(const file of plan){
    if(!networkAllowed())throw new QuranProviderError('Network access is disabled.');
    assertAudioDownloadUrl(file.url);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try {const response=await fetcher(file.url,{method:'HEAD',signal:controller.signal});const bytes=Number(response.headers.get('content-length'));if(!response.ok || !Number.isSafeInteger(bytes) || bytes<=0)throw new QuranProviderError(`The source did not provide a reliable size for ${file.verseKey}; no audio will be downloaded.`);files.push({...file,bytes});totalBytes+=bytes;}finally{clearTimeout(timer);}
  }
  return {files,totalBytes};
}
export async function downloadQuranAudio(db:Database,files:QuranAudioDownload[],networkAllowed:()=>boolean,onProgress:(completed:number,total:number)=>void):Promise<void>{
  const {Directory,File,Paths,DownloadTask}=await import('expo-file-system');
  const directory=new Directory(Paths.document,'quran-audio');directory.create({idempotent:true,intermediates:true});
  let completed=0;
  for(const file of files){
    if(!networkAllowed())throw new QuranProviderError('Network access was disabled.');
    if(!file.bytes)throw new QuranProviderError('Estimate audio size before downloading.');
    assertAudioDownloadUrl(file.url);
    const existing=await db.getFirstAsync<{status:string;path:string;bytes:number}>('SELECT status,path,bytes FROM downloads WHERE id=?',file.id);
    if(existing?.status==='complete' && existing.path){const saved=new File(existing.path);if(saved.exists && saved.size===existing.bytes){completed++;onProgress(completed,files.length);continue;}}
    const destination=new File(directory,`${Date.now()}-${file.resourceId}-${file.verseKey.replace(':','-')}.mp3`);
    await db.runAsync('INSERT OR REPLACE INTO downloads(id,resource,resource_id,status,bytes,total_bytes,path,error) VALUES (?,?,?,?,?,?,?,?)',file.id,file.resource,file.resourceId,'downloading',0,file.bytes,null,null);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120000);
    const monitor=setInterval(()=>{if(!networkAllowed())controller.abort();},500);
    const task=new DownloadTask(file.url,destination,{signal:controller.signal});
    try{
      const output=await task.downloadAsync();
      if(!output?.exists || output.size<=0 || output.size!==file.bytes)throw new QuranProviderError('Audio size did not match the estimate. Retry the estimate before downloading again.');
      await db.runAsync('UPDATE downloads SET status=?,bytes=?,path=?,error=NULL WHERE id=?','complete',output.size,output.uri,file.id);
      completed++;onProgress(completed,files.length);
    }catch(error){if(destination.exists)destination.delete();const message=error instanceof Error?error.message:'Audio download failed';await db.runAsync('UPDATE downloads SET status=?,error=? WHERE id=?','failed',message,file.id);throw error;}
    finally{clearTimeout(timer);clearInterval(monitor);task.release();}
  }
}
