import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { getDb } from '../../services/database/database';
import { SQLiteQuranSyncStore } from '../../services/quran/QuranRepository';
import { canonicalResourceFilter, QuranSyncService, validateSnapshot } from '../../services/quran/QuranSyncService';
import { configuredContentConnection, createConfiguredQuranProvider } from '../../services/quran/config';
import { audioDownloadPlan, downloadQuranAudio, estimateAudioDownloads, type QuranAudioDownload } from '../../services/quran/QuranAudioDownloads';
import { saveQuranResourcePreferences, type QuranResourcePreferences } from '../../services/quran/QuranResourcePreferences';
import { ContentConnection } from '../parent/ContentConnection';
import { useAppStore } from '../../state/appStore';
import { commitTanzilText, installedTanzilText, prepareTanzilText, removeTanzilText, TANZIL_EDITIONS, type InstalledTanzilText, type StagedTanzilText, type TanzilTextKind } from '../../services/quran/QuranLicensedText';
import { tafsirCoverage } from '../../services/quran/QuranTafsir';
import { ALL_SURAHS } from '../../services/quran/FixtureQuranProvider';
import { fetchPublisherAudio, PUBLISHER_AUDIO_EDITION, PUBLISHER_AUDIO_RECITER, PUBLISHER_AUDIO_SOURCE, publisherAudioIsFresh, publisherAudioPlan, publisherAudioStatus, readPublisherAudio, removePublisherAudio, savePublisherAudio } from '../../services/quran/QuranPublisherAudio';
import type { QuranFoundationProvider } from '../../services/quran/QuranFoundationProvider';

type StoredResource = {resource:string;resource_id:string;last_sync:string;download_status:string};
type AudioEstimate = {files:QuranAudioDownload[];totalBytes:number;surah:number;recitation:number;environment:string;checkedAt:number};
type PublisherEstimate = {files:QuranAudioDownload[];totalBytes:number;remainingBytes:number;surah:number;checkedAt:number};
export function QuranDownloads({networkEnabled,onBack}:{networkEnabled:boolean;onBack?:()=>void}) {
  const allowed=useRef(networkEnabled);const mounted=useRef(true);const running=useRef(false);const operation=useRef<AbortController|undefined>(undefined);
  useEffect(()=>{allowed.current=networkEnabled;if(!networkEnabled)operation.current?.abort();},[networkEnabled]);
  const [core,setCore]=useState(true);const [translation,setTranslation]=useState(false);const [transliteration,setTransliteration]=useState(false);const [wordMeaning,setWordMeaning]=useState(false);const [audio,setAudio]=useState(false);const [tafsir,setTafsir]=useState(false);
  const [translationId,setTranslationId]=useState('19');const [transliterationId,setTransliterationId]=useState('60');const [wordMeaningId,setWordMeaningId]=useState('85');const [audioId,setAudioId]=useState('7');const [tafsirId,setTafsirId]=useState('');
  const [audioSurah,setAudioSurah]=useState('1');const [estimate,setEstimate]=useState<AudioEstimate>();
  const [reciters,setReciters]=useState<{id:number;name:string}[]>([]);
  const [recitationSurah,setRecitationSurah]=useState(1);const [surahQuery,setSurahQuery]=useState('');const [publisherEstimate,setPublisherEstimate]=useState<PublisherEstimate>();const [publisherSaved,setPublisherSaved]=useState<Map<number,number>>(new Map());const [showQfAudio,setShowQfAudio]=useState(false);
  const [tafsirs,setTafsirs]=useState<{id:number;name:string;author:string}[]>([]);
  const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [resources,setResources]=useState<StoredResource[]>([]);
  const [savedAudio,setSavedAudio]=useState<{status:string;count:number}[]>([]);
  const [textKind,setTextKind]=useState<TanzilTextKind>('arabic');const [unchanged,setUnchanged]=useState(false);const [noncommercial,setNoncommercial]=useState(false);const [stagedText,setStagedText]=useState<StagedTanzilText>();const [installedText,setInstalledText]=useState<Partial<Record<TanzilTextKind,InstalledTanzilText>>>({});
  async function reload(){const db=await getDb();const rows=await db.getAllAsync<StoredResource>('SELECT resource,resource_id,last_sync,download_status FROM quran_sync ORDER BY resource');const recordings=await db.getAllAsync<{status:string;count:number}>('SELECT status,COUNT(*) AS count FROM downloads WHERE resource=? GROUP BY status','recitations');const arabic=await installedTanzilText(db,'arabic');const transliterationText=await installedTanzilText(db,'transliteration');const saved=await publisherAudioStatus(db);if(mounted.current){setResources(rows);setSavedAudio(recordings);setPublisherSaved(saved);setInstalledText({...(arabic?{arabic}:{}),...(transliterationText?{transliteration:transliterationText}:{})});}}
  useEffect(()=>{mounted.current=true;reload().catch(()=>{if(mounted.current)setStatus('Saved download status could not be loaded. Try reopening this page.');});return()=>{mounted.current=false;allowed.current=false;operation.current?.abort();};},[]);
  async function run(label:string,work:(isAllowed:()=>boolean,signal:AbortSignal)=>Promise<void>,needsNetwork=true) {
    if(running.current)return;
    if(!useAppStore.getState().parentUnlocked){setStatus('Enter your parent PIN before downloading content.');return;}
    if(needsNetwork&&!allowed.current){setStatus('Enable optional network access in Parent Mode to download content. Included surahs remain available offline.');return;}
    running.current=true;const controller=new AbortController();operation.current=controller;setBusy(true);setStatus(label);
    const isAllowed=()=>mounted.current&&useAppStore.getState().parentUnlocked&&(!needsNetwork||(allowed.current&&useAppStore.getState().settings.networkEnabled))&&!controller.signal.aborted;
    try{await work(isAllowed,controller.signal);}catch(error){if(mounted.current)setStatus(controller.signal.aborted?'Operation cancelled. Previously saved content remains available.':error instanceof Error?error.message:'The download could not finish. Try again.');}
    finally{try{await reload();}catch{/* Status refresh cannot change the transfer result. */}running.current=false;if(operation.current===controller)operation.current=undefined;if(mounted.current)setBusy(false);}
  }
  async function provider(isAllowed:()=>boolean):Promise<QuranFoundationProvider>{const result=await createConfiguredQuranProvider(isAllowed);if(!result)throw new Error('Connect the Quran content service in Parent Mode before downloading more content. The five included surahs already work offline.');return result;}
  async function syncContent(filter:string,preference:QuranResourcePreferences,isAllowed:()=>boolean) {
    setEstimate(undefined);const connection=await provider(isAllowed);const db=await getDb();const store=new SQLiteQuranSyncStore(db);
    const selected=canonicalResourceFilter(filter);const result=await new QuranSyncService(connection,store,isAllowed).synchronize(selected);
    const content=await store.resources(connection.environment);
    for(const part of selected.split(';')){const [group,ids]=part.split(':');for(const id of ids.split(',')){const resource=content.find(row=>row.resource_group===group&&row.resource_id===Number(id));if(!resource?.records.length)throw new Error(`The selected ${group} resource is not published for this connection. Choose an available resource; included content remains offline.`);validateSnapshot(resource);}}
    const recitation=content.find(row=>row.resource_group==='recitations'&&row.resource_id===preference.recitations);
    const recordings=recitation?.records.filter(row=>row.record_type==='audio_file'&&typeof row.verse_key==='string'&&typeof row.url==='string'&&row.url)||[];
    if(preference.recitations!==undefined&&!recordings.length)throw new Error('The selected reciter has no published ayah recordings for this connection. Choose another reciter or try syncing later.');
    const chapters=new Set(recordings.map(row=>String(row.verse_key).split(':')[0]));
    const tafsir=content.find(row=>row.resource_group==='tafsirs'&&row.resource_id===preference.tafsirs);
    const coverage=tafsir?tafsirCoverage(tafsir):undefined;
    if(coverage&&!coverage.verseCount)throw new Error('The selected tafsir does not cover a valid ayah. Choose another published source.');
    await saveQuranResourcePreferences(db,connection.environment,preference,isAllowed);
    if(mounted.current)setStatus(`Content synced ${result.lastSync}. ${recordings.length?`Recitation metadata: ${recordings.length} ayahs in ${chapters.size} surahs. Audio files download separately after size confirmation.`:'Selected text is available offline.'}${tafsir&&coverage?` Tafsir: ${tafsir.attribution?.name} · ${tafsir.attribution?.author??'author not supplied'} · ${tafsir.attribution?.language} · ${coverage.verseCount} of ${coverage.totalVerseCount} ayahs covered.`:''}`);
  }
  function sync(){void run('Checking published content…',async isAllowed=>{
    const filter=[core?'quran_core:1':null,translation?`translations:${translationId}`:null,transliteration?`word_by_word_transliterations:${transliterationId}`:null,wordMeaning?`word_by_word_translations:${wordMeaningId}`:null,tafsir?`tafsirs:${tafsirId}`:null,audio?`recitations:${audioId}`:null].filter(Boolean).join(';');
    if(!filter)throw new Error('Choose at least one resource.');
    await syncContent(filter,{...(translation?{translations:Number(translationId)}:{}),...(transliteration?{word_by_word_transliterations:Number(transliterationId)}:{}),...(wordMeaning?{word_by_word_translations:Number(wordMeaningId)}:{}),...(tafsir?{tafsirs:Number(tafsirId)}:{}),...(audio?{recitations:Number(audioId)}:{})},isAllowed);
  });}
  function listReciters(){void run('Loading available reciters…',async isAllowed=>{const connection=await provider(isAllowed);const result=await connection.resources('recitations') as {recitations?:{id:number;reciter_name?:string;name?:string;style?:string|null}[]};if(!Array.isArray(result.recitations))throw new Error('The service did not provide a reciter list. Try again.');const choices=result.recitations.filter(row=>Number.isSafeInteger(row.id)&&row.id>0&&(row.reciter_name||row.name)).map(row=>({id:row.id,name:`${row.reciter_name??row.name}${row.style?` · ${row.style}`:''}`}));if(!choices.length)throw new Error('No reciters are available through this connection.');if(isAllowed()){setReciters(choices);setStatus('Choose a reciter, then sync its audio metadata.');}});}
  function listEnglishTafsirs(){void run('Loading English tafsir sources…',async isAllowed=>{const connection=await provider(isAllowed);const result=await connection.resources('tafsirs') as {tafsirs?:{id:number;name:string;author_name?:string;language_name?:string}[]};if(!Array.isArray(result.tafsirs))throw new Error('The service did not provide a tafsir source list. Try again.');const choices=result.tafsirs.filter(row=>Number.isSafeInteger(row.id)&&row.id>0&&typeof row.name==='string'&&['english','en'].includes(row.language_name?.toLowerCase()??'')).map(row=>({id:row.id,name:row.name,author:row.author_name??''}));if(!choices.length)throw new Error('No English tafsir sources are available through this connection. Included published meanings remain offline.');if(isAllowed()){setTafsirs(choices);setStatus('Choose a sourced English tafsir. Offline publication is checked during sync.');}});}
  function estimateAudio(){void run('Checking recording sizes…',async(isAllowed,signal)=>{
    setEstimate(undefined);const surah=Number(audioSurah);if(!Number.isInteger(surah)||surah<1||surah>114)throw new Error('Choose a surah number from 1 to 114.');const recitation=Number(audioId);if(!Number.isSafeInteger(recitation)||recitation<1)throw new Error('Choose a valid recitation ID or select a reciter.');
    const connection=await provider(isAllowed);const db=await getDb();const content=await new SQLiteQuranSyncStore(db).resources(connection.environment);const plan=audioDownloadPlan(content,surah,recitation);
    const result=await estimateAudioDownloads(plan,isAllowed,fetch,signal);
    if(isAllowed()){setEstimate({...result,surah,recitation,environment:connection.environment,checkedAt:Date.now()});setStatus(`Ready for confirmation: ${result.files.length} ayah recordings, ${(result.totalBytes/1048576).toFixed(2)} MB. No audio download has started.`);}
  });}
  function download(){const confirmed=estimate;if(!confirmed)return;void run('Starting confirmed download…',async(isAllowed,signal)=>{
    if(Platform.OS==='web')throw new Error('Persistent audio downloads are available in the Android/iOS app. This preview supports online listening with parent permission.');
    if(Date.now()-confirmed.checkedAt>15*60*1000)throw new Error('This size estimate has expired. Check sizes again before confirming.');
    const connection=await provider(isAllowed);if(connection.environment!==confirmed.environment||Number(audioId)!==confirmed.recitation||Number(audioSurah)!==confirmed.surah)throw new Error('The content selection changed. Check sizes again.');
    const db=await getDb();const plan=audioDownloadPlan(await new SQLiteQuranSyncStore(db).resources(connection.environment),confirmed.surah,confirmed.recitation);
    if(plan.length!==confirmed.files.length||plan.some((file,index)=>file.id!==confirmed.files[index].id))throw new Error('Recitation metadata changed. Check sizes again before downloading.');
    await downloadQuranAudio(db,confirmed.files,isAllowed,(done,total)=>{if(mounted.current)setStatus(`Saved ${done} of ${total} recordings.`);},{signal,onBytes:(bytes,total)=>{if(mounted.current)setStatus(`Downloading ${(bytes/1048576).toFixed(2)} of ${(total/1048576).toFixed(2)} MB…`);}});
    await saveQuranResourcePreferences(db,connection.environment,{recitations:confirmed.recitation},isAllowed);
    if(mounted.current){setStatus('Audio download complete. These recordings can play offline.');setEstimate(undefined);}
  });}
  async function publisherList(surah:number,isAllowed:()=>boolean,signal:AbortSignal){
    const db=await getDb();const saved=await readPublisherAudio(db,surah);
    if(saved&&publisherAudioIsFresh(saved))return saved;
    const connection=await configuredContentConnection();if(!connection)throw new Error('Save your content server address above, then try again. The five included surahs already play offline.');
    const fresh=await fetchPublisherAudio(connection.url,surah,isAllowed,fetch,signal);await savePublisherAudio(db,fresh,isAllowed);return fresh;
  }
  function estimatePublisherAudio(){const surah=recitationSurah;setPublisherEstimate(undefined);void run('Getting the recitation list and checking sizes…',async(isAllowed,signal)=>{
    const db=await getDb();const plan=publisherAudioPlan(await publisherList(surah,isAllowed,signal));
    const done=new Map((await db.getAllAsync<{id:string;bytes:number}>('SELECT id,bytes FROM downloads WHERE resource_id=? AND status=?',PUBLISHER_AUDIO_EDITION,'complete')).map(row=>[row.id,row.bytes]));
    const known=plan.filter(file=>Number.isSafeInteger(done.get(file.id))&&done.get(file.id)!>0).map(file=>({...file,bytes:done.get(file.id)}));
    const pending=plan.filter(file=>!known.some(item=>item.id===file.id));
    const checked=pending.length?await estimateAudioDownloads(pending,isAllowed,fetch,signal):{files:[],totalBytes:0};
    const files=plan.map(file=>known.find(item=>item.id===file.id)??checked.files.find(item=>item.id===file.id)!);
    const totalBytes=files.reduce((sum,file)=>sum+file.bytes!,0);
    if(isAllowed()){setPublisherEstimate({files,totalBytes,remainingBytes:checked.totalBytes,surah,checkedAt:Date.now()});setStatus(pending.length?`Ready to confirm: ${pending.length} recordings, ${(checked.totalBytes/1048576).toFixed(1)} MB. Nothing has downloaded yet.`:'Every recording for this surah is already saved on this device.');}
  });}
  function downloadPublisherAudio(){const confirmed=publisherEstimate;if(!confirmed)return;void run('Starting confirmed download…',async(isAllowed,signal)=>{
    if(Platform.OS==='web')throw new Error('Saving recordings for offline use needs the Android or iOS app.');
    if(Date.now()-confirmed.checkedAt>15*60*1000)throw new Error('This size check has expired. Check the size again before downloading.');
    if(confirmed.surah!==recitationSurah)throw new Error('The selected surah changed. Check the size again.');
    const db=await getDb();const current=await readPublisherAudio(db,confirmed.surah);const plan=current?publisherAudioPlan(current):[];
    if(plan.length!==confirmed.files.length||plan.some((file,index)=>file.id!==confirmed.files[index].id))throw new Error('The recitation list changed. Check the size again before downloading.');
    await downloadQuranAudio(db,confirmed.files,isAllowed,(done,total)=>{if(mounted.current)setStatus(`Saved ${done} of ${total} recordings.`);},{signal,onBytes:(bytes,total)=>{if(mounted.current)setStatus(`Downloading ${(bytes/1048576).toFixed(1)} of ${(total/1048576).toFixed(1)} MB…`);}});
    if(mounted.current){setPublisherEstimate(undefined);setStatus('Download complete. This surah’s recitation now plays without internet.');}
  });}
  function removeSurahAudio(){const surah=recitationSurah;void run('Removing saved recordings…',async isAllowed=>{
    if(!isAllowed())throw new Error('Enter your parent PIN before removing content.');
    const {File}=await import('expo-file-system');const removed=await removePublisherAudio(await getDb(),surah,uri=>{const file=new File(uri);if(file.exists)file.delete();});
    if(mounted.current){setPublisherEstimate(undefined);setStatus(`Removed ${removed} saved recordings. Included surahs keep their built-in audio.`);}
  },false);}
  function fetchLicensedText(){void run('Downloading and verifying publisher text…',async(isAllowed,signal)=>{setStagedText(undefined);const connection=await configuredContentConnection();if(!connection)throw new Error('Save a content server connection before downloading publisher text.');const staged=await prepareTanzilText(textKind,{proxyUrl:connection.url,networkAllowed:isAllowed,consent:{unchangedUseConfirmed:unchanged,noncommercialUseConfirmed:noncommercial},signal});if(isAllowed()){setStagedText(staged);setStatus(`Verified ${staged.chapterCount} surahs, ${staged.verseCount} ayahs. Confirm installation to make this edition available offline.`);}});}
  function installLicensedText(){const staged=stagedText;if(!staged)return;void run('Installing verified source text…',async isAllowed=>{const result=await commitTanzilText(await getDb(),staged,{unchangedUseConfirmed:unchanged,noncommercialUseConfirmed:noncommercial},isAllowed);if(mounted.current){setStagedText(undefined);setStatus(`${result.source.name}: all 114 surahs installed offline, version ${result.source.version}.`);}});}
  function removeLicensedText(kind:TanzilTextKind){void run('Removing additional publisher edition…',async isAllowed=>{const db=await getDb();if(!isAllowed())throw new Error('Enter your parent PIN before removing content.');await removeTanzilText(db,kind);if(mounted.current)setStatus('Additional publisher edition removed. The five included surahs remain available.');},false);}
  const surahMatches=(surahQuery.trim()?ALL_SURAHS.filter(chapter=>`${chapter.number} ${chapter.name} ${chapter.englishName} ${chapter.arabicName}`.toLocaleLowerCase().includes(surahQuery.trim().toLocaleLowerCase())):ALL_SURAHS.filter(chapter=>chapter.number===recitationSurah||chapter.number>=110)).slice(0,12);
  const selectedChapter=ALL_SURAHS.find(chapter=>chapter.number===recitationSurah)??ALL_SURAHS[0];const selectedSaved=publisherSaved.get(selectedChapter.number)??0;
  const options=[{label:'Quran Arabic text · all 114 surahs',value:core,set:setCore},{label:'English translation',value:translation,set:setTranslation},{label:'Word transliteration',value:transliteration,set:setTransliteration},{label:'Word meanings',value:wordMeaning,set:setWordMeaning},{label:'Tafsir',value:tafsir,set:setTafsir},{label:'Recitation metadata',value:audio,set:setAudio}];
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Content Downloads</Text>
    {onBack&&<Action label="Back to Parent Mode" disabled={false} onPress={onBack}/>}
    <ContentConnection networkEnabled={networkEnabled} disabled={busy} onChanged={()=>{operation.current?.abort();setEstimate(undefined);setStagedText(undefined);setReciters([]);setTafsirs([]);setTafsirId('');void reload();}}/>
    <Text style={styles.body}>Five included surahs work offline with Arabic, English translation, transliteration, published meanings and recitation. Use this page to add all 114 surahs.</Text>
    <Text style={styles.info}>{networkEnabled?'Optional network access is enabled.':'Enable optional network access in Parent Mode before downloading.'}</Text>
    <View style={styles.card}>
      <Text style={styles.subtitle}>Publisher text · all 114 surahs</Text>
      <Text style={styles.body}>Download a complete verified Tanzil edition through your content connection. This publisher import works independently of Quran Foundation credentials. The included five surahs remain available.</Text>
      {(['arabic','transliteration'] as const).map(kind=><Action key={kind} label={`${textKind===kind?'✓ ':''}${kind==='arabic'?'Arabic Quran text':'Whole-ayah English transliteration'}`} disabled={busy} onPress={()=>{setTextKind(kind);setStagedText(undefined);}}/>)}
      <Text style={styles.small}>{TANZIL_EDITIONS[textKind].source.name} · version {TANZIL_EDITIONS[textKind].source.version}{'\n'}{TANZIL_EDITIONS[textKind].licenseUrl}{'\n'}{(TANZIL_EDITIONS[textKind].bytes/1048576).toFixed(2)} MB · 6,236 ayahs</Text>
      <View style={styles.option}><Text style={[styles.body,{flex:1}]}>I accept unchanged source text, publisher attribution and retained copyright notices.</Text><Switch accessibilityLabel="Accept unchanged publisher text and attribution" value={unchanged} disabled={busy} onValueChange={value=>{setUnchanged(value);setStagedText(undefined);}}/></View>
      {textKind==='transliteration'&&<><Text style={styles.body}>This transliteration permits noncommercial use only. Commercial use needs publisher or translator permission. Transliteration assists reading; use Arabic and sourced recitation for pronunciation.</Text><View style={styles.option}><Text style={[styles.body,{flex:1}]}>I confirm noncommercial use of this transliteration.</Text><Switch accessibilityLabel="Confirm noncommercial transliteration use" value={noncommercial} disabled={busy} onValueChange={value=>{setNoncommercial(value);setStagedText(undefined);}}/></View></>}
      <Action label={`Download and verify ${(TANZIL_EDITIONS[textKind].bytes/1048576).toFixed(2)} MB source text`} disabled={busy||!networkEnabled||!unchanged||(textKind==='transliteration'&&!noncommercial)} onPress={fetchLicensedText}/>
      {stagedText&&<><Text style={styles.info}>Verified source: {stagedText.source.name} · {stagedText.chapterCount} surahs · {stagedText.verseCount} ayahs</Text><Action label="Install verified edition offline" disabled={busy||!networkEnabled||!unchanged||(stagedText.kind==='transliteration'&&!noncommercial)} onPress={installLicensedText}/></>}
      {Object.values(installedText).map(installed=><View key={installed.kind}><Text style={styles.small}>Installed: {installed.source.name} · {installed.verseCount} ayahs · version {installed.source.version}</Text><Action label={`Remove additional ${installed.kind} edition`} disabled={busy} onPress={()=>removeLicensedText(installed.kind)}/></View>)}
    </View>
    <View style={styles.card}>
      <Text style={styles.subtitle}>Recitation audio · all 114 surahs</Text>
      <Text style={styles.body}>{PUBLISHER_AUDIO_RECITER}, from {PUBLISHER_AUDIO_SOURCE.name}. The publisher permits downloading its recitations for personal and educational use; the reciter keeps copyright. This does not need a Quran Foundation account.</Text>
      <TextInput accessibilityLabel="Find a surah by name or number" value={surahQuery} onChangeText={setSurahQuery} placeholder="Find a surah · name or number" editable={!busy} style={styles.input}/>
      <View style={styles.chips}>{surahMatches.map(chapter=>{const saved=publisherSaved.get(chapter.number)??0;return <Pressable key={chapter.number} accessibilityRole="button" accessibilityState={{selected:recitationSurah===chapter.number,disabled:busy}} disabled={busy} onPress={()=>{setRecitationSurah(chapter.number);setPublisherEstimate(undefined);}} style={[styles.chip,recitationSurah===chapter.number&&styles.chipSelected]}><Text style={styles.chipText}>{chapter.number} · {chapter.name}{saved>=chapter.ayahCount?' ✓':''}</Text></Pressable>;})}</View>
      <Text style={styles.info}>Selected: {selectedChapter.number} · {selectedChapter.name} ({selectedChapter.englishName}) · {selectedChapter.ayahCount} ayahs{'\n'}{selectedSaved>=selectedChapter.ayahCount?'All recordings saved for offline listening.':selectedSaved?`${selectedSaved} of ${selectedChapter.ayahCount} recordings saved.`:[1,107,112,113,114].includes(selectedChapter.number)?'Built-in recordings already play offline. Downloading is optional.':'Not downloaded yet.'}</Text>
      <Text style={styles.small}>Step 1 checks the exact file sizes. Nothing downloads until you confirm in step 2. Interrupted downloads keep finished recordings and can be resumed.</Text>
      <Action label="1. Check download size" disabled={busy||!networkEnabled} onPress={estimatePublisherAudio}/>
      {publisherEstimate&&publisherEstimate.surah===recitationSurah&&publisherEstimate.remainingBytes>0&&<Action label={`2. Confirm: download ${(publisherEstimate.remainingBytes/1048576).toFixed(1)} MB`} disabled={busy||!networkEnabled} onPress={downloadPublisherAudio}/>}
      {selectedSaved>0&&<Action label="Remove this surah’s downloaded audio" disabled={busy} onPress={removeSurahAudio}/>}
      {savedAudio.filter(row=>row.status!=='complete').map(row=><Text key={row.status} style={styles.small}>{row.count} recordings {row.status==='downloading'?'were interrupted. Check the size again to resume.':'failed. Check the size again to retry.'}</Text>)}
    </View>
    <Text style={styles.subtitle}>Quran Foundation resources (optional)</Text>
    <Text style={styles.body}>Translations, word-by-word data, English tafsir and more reciters come from Quran Foundation. These need approved Quran Foundation credentials on your content server. Everything above works without them.</Text>
    {options.map(option=><View key={option.label} style={styles.option}><Text style={[styles.body,{flex:1}]}>{option.label}</Text><Switch accessibilityLabel={option.label} value={option.value} onValueChange={option.set} disabled={busy}/></View>)}
    {translation&&<Field label="Translation resource ID" value={translationId} onChange={setTranslationId} disabled={busy}/>}
    {transliteration&&<Field label="Word transliteration resource ID" value={transliterationId} onChange={setTransliterationId} disabled={busy}/>}
    {wordMeaning&&<Field label="Word meaning resource ID" value={wordMeaningId} onChange={setWordMeaningId} disabled={busy}/>}
    {tafsir&&<View style={styles.card}><Action label="List available English tafsir" disabled={busy||!networkEnabled} onPress={listEnglishTafsirs}/>{tafsirs.map(source=><Action key={source.id} label={`${Number(tafsirId)===source.id?'✓ ':''}${source.name}${source.author?` · ${source.author}`:''}`} disabled={busy} onPress={()=>setTafsirId(String(source.id))}/>)}<Field label="Selected English tafsir resource ID" value={tafsirId} onChange={setTafsirId} disabled={busy}/><Text style={styles.small}>Author and language come from source metadata. The app verifies that the selected resource contains published English text during sync.</Text></View>}
    <Text style={styles.small}>The initial resource numbers are documentation examples. Only resources published for your connection can be synced. Word transliteration is separate from whole-ayah transliteration. Quran Foundation full-text sync requires authorized production access; the verified publisher import above works independently.</Text>
    <Action label="Sync selected text and metadata" disabled={busy||!networkEnabled} onPress={sync}/>
    <View style={styles.card}>
      <Action label={showQfAudio?'Hide other reciters':'Other reciters (Quran Foundation)'} disabled={busy} onPress={()=>setShowQfAudio(value=>!value)}/>
      {showQfAudio&&<>
      <Action label="List available reciters" disabled={busy||!networkEnabled} onPress={listReciters}/>
      {reciters.map(reciter=><Action key={reciter.id} label={`${Number(audioId)===reciter.id?'✓ ':''}${reciter.name}`} disabled={busy} onPress={()=>{setAudioId(String(reciter.id));setEstimate(undefined);}}/>)}
      <Field label="Recitation ID" value={audioId} onChange={value=>{setAudioId(value);setEstimate(undefined);}} disabled={busy}/>
      <Action label="Sync recitation metadata" disabled={busy||!networkEnabled} onPress={()=>{void run('Syncing recitation metadata…',isAllowed=>syncContent(`recitations:${audioId}`,{recitations:Number(audioId)},isAllowed));}}/>
      <Field label="Surah number · 1 to 114" value={audioSurah} onChange={value=>{setAudioSurah(value);setEstimate(undefined);}} disabled={busy}/>
      <Text style={styles.body}>First sync metadata, then check sizes. Confirm the estimated amount before any audio files download. Interrupted downloads keep completed recordings and can be retried.</Text>
      <Action label="Check audio download size" disabled={busy||!networkEnabled} onPress={estimateAudio}/>
      {estimate&&<><Text style={styles.info}>Surah {estimate.surah} · {estimate.files.length} ayahs · {(estimate.totalBytes/1048576).toFixed(2)} MB</Text><Action label="Confirm audio download" disabled={busy||!networkEnabled} onPress={download}/></>}
      </>}
    </View>
    {busy&&<><ActivityIndicator color="#17645B"/><Action label="Cancel current operation" disabled={false} onPress={()=>operation.current?.abort()}/></>}
    {!!status&&<Text accessibilityRole="alert" style={styles.info}>{status}</Text>}
    <Text style={styles.subtitle}>Quran Foundation offline copies</Text>
    {resources.map(row=><Text key={`${row.resource}:${row.resource_id}`} style={styles.small}>{row.resource} · {row.resource_id} · {row.download_status} · {row.last_sync}</Text>)}
    {!resources.length&&<Text style={styles.body}>None yet. The five included surahs and any downloads above are listed separately.</Text>}
    <Text style={styles.small}>Synced Quran Foundation copies refresh at least every seven days when permitted connectivity is available, and promptly after it returns. The included source fixtures remain separate.</Text>
  </ScrollView>;
}
function Action({label,onPress,disabled}:{label:string;onPress:()=>void;disabled:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,disabled&&{opacity:0.45}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;}
function Field({label,value,onChange,disabled=false}:{label:string;value:string;onChange:(text:string)=>void;disabled?:boolean}){return <View style={{gap:6}}><Text style={styles.small}>{label}</Text><TextInput accessibilityLabel={label} keyboardType="number-pad" value={value} onChangeText={onChange} editable={!disabled} style={styles.input}/></View>;}
const styles=StyleSheet.create({page:{padding:20,gap:14,paddingBottom:44},title:{fontSize:28,fontWeight:'800',color:'#173E38'},subtitle:{fontSize:20,fontWeight:'700',color:'#173E38'},body:{fontSize:16,lineHeight:25,color:'#34534A'},small:{fontSize:13,lineHeight:21,color:'#536B64'},option:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:14,borderRadius:14,backgroundColor:'white',gap:12},input:{padding:14,minHeight:48,borderWidth:1,borderColor:'#BACFC0',borderRadius:12,backgroundColor:'white',fontSize:17},button:{padding:16,minHeight:50,borderRadius:14,backgroundColor:'#17645B'},buttonText:{fontSize:16,fontWeight:'700',color:'white',textAlign:'center'},info:{padding:14,borderRadius:14,backgroundColor:'#EEF3DB',fontSize:14,lineHeight:23,color:'#34534A'},card:{padding:18,borderWidth:1,borderColor:'#D8E1D5',backgroundColor:'white',borderRadius:20,gap:12},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:12,paddingVertical:10,minHeight:44,borderRadius:12,borderWidth:1,borderColor:'#BACFC0',justifyContent:'center'},chipSelected:{backgroundColor:'#EBF3E9',borderColor:'#17645B',borderWidth:2},chipText:{fontSize:15,color:'#173E38'}});
