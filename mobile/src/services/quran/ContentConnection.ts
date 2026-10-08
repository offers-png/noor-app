import type { Database } from '../database/types';

export interface ContentConnectionSettings { url:string; environment:'production'|'prelive' }
export interface ContentHealth { environment:'production'|'prelive'; quranConfigured:boolean; hadithConfigured:boolean; publisherDownloads:string[] }
const key='content-connection:v1';

export function validateContentConnection(input:ContentConnectionSettings,allowDevelopmentHttp=false):ContentConnectionSettings {
  let url:URL;
  try{url=new URL(input.url.trim());}catch{throw new Error('Enter the HTTPS address of your content server.');}
  if(url.username||url.password||url.search||url.hash)throw new Error('Use a server address without passwords, query parameters or fragments. API secrets belong on the server.');
  if(url.protocol!=='https:'&&!(allowDevelopmentHttp&&url.protocol==='http:'&&['localhost','127.0.0.1','10.0.2.2','[::1]'].includes(url.hostname)))throw new Error('Content connections require HTTPS. Local emulator HTTP is allowed only in a development build.');
  if(!['production','prelive'].includes(input.environment))throw new Error('Choose the production or prelive content environment.');
  return {url:url.toString().replace(/\/+$/,''),environment:input.environment};
}

export async function loadContentConnection(db:Database,fallback?:ContentConnectionSettings,allowDevelopmentHttp=false):Promise<ContentConnectionSettings|null> {
  const row=await db.getFirstAsync<{value_json:string}>('SELECT value_json FROM app_settings WHERE key=?',key);
  if(row){try{return validateContentConnection(JSON.parse(row.value_json),allowDevelopmentHttp);}catch{throw new Error('The saved content connection needs to be checked in Parent Mode. Your offline content is still available.');}}
  return fallback?validateContentConnection(fallback,allowDevelopmentHttp):null;
}

export async function saveContentConnection(db:Database,input:ContentConnectionSettings,parentAllowed:()=>boolean,allowDevelopmentHttp=false):Promise<void> {
  if(!parentAllowed())throw new Error('Enter your parent PIN before changing the connection.');
  const settings=validateContentConnection(input,allowDevelopmentHttp);
  await db.withTransactionAsync(async tx=>{if(!parentAllowed())throw new Error('The parent session expired. Enter your PIN again.');await tx.runAsync('INSERT OR REPLACE INTO app_settings(key,value_json) VALUES(?,?)',key,JSON.stringify(settings));if(!parentAllowed())throw new Error('The parent session expired. Enter your PIN again.');});
}

/** A reachable health endpoint reports configuration; it does not verify live OAuth or resource access. */
export async function checkContentConnection(input:ContentConnectionSettings,networkAllowed:()=>boolean,fetcher:typeof fetch=fetch,allowDevelopmentHttp=false):Promise<ContentHealth> {
  const settings=validateContentConnection(input,allowDevelopmentHttp);
  if(!networkAllowed())throw new Error('Enable optional network access before checking the connection.');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
  const revoked=setInterval(()=>{if(!networkAllowed())controller.abort();},150);
  try{
    const response=await fetcher(`${settings.url}/health`,{signal:controller.signal});
    if(!networkAllowed())throw new Error('Network access was disabled.');
    if(!response.ok)throw new Error(`The content server could not be reached (${response.status}). Check its address and deployment.`);
    const value=await response.json() as Partial<ContentHealth>&{status?:string};
    if(value.status!=='ok'||(value.environment!=='prelive'&&value.environment!=='production')||typeof value.quranConfigured!=='boolean'||typeof value.hadithConfigured!=='boolean')throw new Error('This address did not return a supported content server response.');
    if(value.environment!==settings.environment)throw new Error(`The server uses ${value.environment}. Select the matching environment before syncing.`);
    return {environment:value.environment,quranConfigured:value.quranConfigured,hadithConfigured:value.hadithConfigured,publisherDownloads:Array.isArray(value.publisherDownloads)?value.publisherDownloads.filter((v):v is string=>typeof v==='string'):[]};
  }catch(error){
    if(!networkAllowed())throw new Error('Network access was disabled.');
    if(error instanceof Error&&error.name==='AbortError')throw new Error('The connection check timed out. Your offline content is still available.');
    if(error instanceof TypeError||error instanceof SyntaxError)throw new Error('The server could not be checked. Check the address and internet connection, then retry.');
    throw error;
  }finally{clearTimeout(timeout);clearInterval(revoked);}
}
