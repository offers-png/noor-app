import { getDb } from '../database/database';
import { QuranFoundationProvider } from './QuranFoundationProvider';
import { SQLiteQuranSyncStore } from './QuranRepository';
import { needsQuranSync, QuranSyncService } from './QuranSyncService';

export function createConfiguredQuranProvider(networkAllowed:()=>boolean):QuranFoundationProvider|null{
  const proxy=process.env.EXPO_PUBLIC_CONTENT_PROXY_URL;
  if(!proxy)return null;
  return new QuranFoundationProvider(proxy,process.env.EXPO_PUBLIC_QF_ENV==='prelive'?'prelive':'production',fetch,networkAllowed);
}
/** Call when parent-enabled connectivity returns; licensed fixture data need no API. */
export async function refreshQuranIfDue(networkEnabled:boolean,networkAllowed:()=>boolean=()=>networkEnabled):Promise<{updated:number;error?:string}>{
  if(!networkEnabled)return {updated:0};
  const provider=createConfiguredQuranProvider(networkAllowed);
  if(!provider)return {updated:0};
  const db=await getDb();const store=new SQLiteQuranSyncStore(db);
  const filters=await db.getAllAsync<{resource_id:string;last_sync:string}>('SELECT resource_id,last_sync FROM quran_sync WHERE resource=?',`filter:${provider.environment}`);
  let updated=0;
  try{for(const state of filters)if(needsQuranSync(state.last_sync,networkAllowed())){await new QuranSyncService(provider,store,networkAllowed).synchronize(state.resource_id);updated++;}return {updated};}
  catch(error){return {updated,error:error instanceof Error?error.message:'Content sync failed; the previous offline copy remains available.'};}
}
