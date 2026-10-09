import { create } from 'zustand';
import { getDb } from '../services/database/database';
import { FamilyRepository, type ChildProfile, type Progress } from '../database/repositories/FamilyRepository';
import { awardForProgress } from '../services/rewards/progressAwards';
export type ModuleName='quran'|'arabic'|'hadith'|'islam'|'duas'|'salah'|'wudu';
export interface Settings { networkEnabled:boolean; developmentContent:boolean; fontSize:number; dailyGoal:number; modules:Record<ModuleName,boolean>; highContrast:boolean; reducedMotion:boolean; audioEnabled:boolean }
export const defaultSettings:Settings={networkEnabled:false,developmentContent:false,fontSize:32,dailyGoal:10,modules:{salah:true,wudu:true,quran:true,arabic:true,hadith:true,islam:true,duas:true},highContrast:false,reducedMotion:true,audioEnabled:true};
interface AppState {
  ready:boolean;error:string;children:ChildProfile[];selectedChildId:number|null;progress:Progress[];parentUnlocked:boolean;settings:Settings;
  initialize:()=>Promise<void>;refresh:()=>Promise<void>;selectChild:(id:number)=>Promise<void>;saveProgress:(id:string,score?:number,childId?:number)=>Promise<void>;updateSettings:(value:Partial<Settings>)=>Promise<void>;lock:()=>void;unlock:()=>void;
}
export const useAppStore=create<AppState>((set,get)=>({
  ready:false,error:'',children:[],selectedChildId:null,progress:[],parentUnlocked:false,settings:defaultSettings,
  initialize:async()=>{try{const repo=new FamilyRepository(await getDb());const children=await repo.children();const saved=await repo.setting<Partial<Settings>>('learning',{});const active=await repo.setting<number|null>('active-child',null);set({children,selectedChildId:children.some(c=>c.id===active)?active:children[0]?.id??null,settings:{...defaultSettings,...saved,modules:{...defaultSettings.modules,...saved.modules}},ready:true,error:''});await get().refresh();}catch(e){set({error:e instanceof Error?e.message:'Unable to open local storage.'});}},
  refresh:async()=>{const childId=get().selectedChildId;const repo=new FamilyRepository(await getDb());const [children,progress]=await Promise.all([repo.children(),childId?repo.progress(childId):Promise.resolve([])]);set({children,...(get().selectedChildId===childId?{progress}:{})});},
  selectChild:async id=>{if(!get().children.some(c=>c.id===id))throw new Error('Unknown child');await new FamilyRepository(await getDb()).setSetting('active-child',id);set({selectedChildId:id,progress:[]});await get().refresh();},
  saveProgress:async(id,score,childId)=>{const child=childId??get().selectedChildId;if(!child||!get().children.some(c=>c.id===child))throw new Error('Choose a child first.');const db=await getDb();await new FamilyRepository(db).saveProgress(child,id,score);if(score!==undefined)await db.runAsync('INSERT INTO quiz_attempts (child_id,lesson_id,score,answers_json,created_at) VALUES (?,?,?,?,?)',child,id,score,JSON.stringify({summaryOnly:true}),new Date().toISOString());await awardForProgress(db,child,id,score).catch(()=>undefined);await get().refresh();},
  updateSettings:async value=>{if(!get().parentUnlocked)throw new Error('Parent PIN required.');const next={...get().settings,...value};await new FamilyRepository(await getDb()).setSetting('learning',next);set({settings:next});},
  lock:()=>set({parentUnlocked:false}),unlock:()=>set({parentUnlocked:true}),
}));
