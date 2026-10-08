import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioControls, type AudioTrack } from '../../services/audio/AudioControls';
import { MemorizationScreen } from '../memorization/MemorizationScreen';
import { selectAyahRange } from '../memorization/logic';
import { QuranRepository } from '../../services/quran/QuranRepository';
import { configuredContentConnection } from '../../services/quran/config';
import { LatestRequest } from '../../services/quran/LatestRequest';
import { parseAyahReference } from '../../services/quran/QuranNavigation';
import { activeWordPosition } from '../../services/quran/QuranTiming';
import { arabicDisplayProps, sourceTextRuns, sourceTextParagraphs } from '../../services/quran/presentation';
import { quranAudioAssets } from '../../content/fixtures/QuranAudioAssets';
import { AUDIO_SOURCE } from '../../services/quran/FixtureQuranProvider';
import type { Ayah, QuranTextLayer, QuranWord, Surah } from '../../types/quran';

type ViewName = 'home' | 'list' | 'reader' | 'detail' | 'words' | 'memorize' | 'player' | 'saved' | 'quiz';
export interface QuranScreenProps { onComplete: (lessonId: string, score?: number) => Promise<void>; fontSize: number; networkEnabled: boolean; childId?: number; audioEnabled?:boolean }
function Button({ label, onPress, secondary = false, disabled = false }: {label: string; onPress:()=>void; secondary?:boolean; disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.buttonText,secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}
function Source({ayah}:{ayah:Ayah}) {return <Text style={styles.source}>Arabic: {ayah.source.name} · {ayah.source.version}{ayah.translation ? `\nTranslation by ${ayah.translation.source.translator ?? ayah.translation.source.name}` : ''}</Text>;}
function SourceLayerCredit({layer}:{layer:QuranTextLayer}) {return <Text style={styles.source}>{layer.source.name} · version {layer.source.version}{'\n'}{layer.source.reference}</Text>;}
function Transliteration({layer,fontSize}:{layer:QuranTextLayer;fontSize:number}) {return <Text selectable style={[styles.body,{fontSize:Math.max(16,fontSize),lineHeight:Math.max(26,fontSize*1.65)}]}>{sourceTextRuns(layer.text).map((run,index)=><Text key={index} style={{fontWeight:run.bold?'700':'400',textDecorationLine:run.underline?'underline':'none'}}>{run.text}</Text>)}</Text>;}
function PublishedMeaning({ayah}:{ayah:Ayah}) {return ayah.publishedMeaning?<><Text style={styles.subtitle}>Published meaning and notes</Text><Text selectable style={styles.body}>{ayah.publishedMeaning.text}</Text>{ayah.publisherNotes&&<><Text style={styles.reference}>Publisher notes</Text><Text selectable style={styles.body}>{ayah.publisherNotes.text}</Text></>}<SourceLayerCredit layer={ayah.publishedMeaning}/></>:null;}
function Tafsir({layer,fontSize}:{layer:QuranTextLayer;fontSize:number}) {return <><Text style={styles.subtitle}>Tafsir · read together</Text><Text style={styles.muted}>This is the publisher’s explanation. Read one paragraph at a time with a parent or teacher and ask about words you do not know.</Text>{sourceTextParagraphs(layer.text).map((paragraph,index)=><Text key={index} selectable accessibilityRole={paragraph.heading?'header':undefined} style={[styles.body,{fontSize:Math.max(18,fontSize*0.7),lineHeight:Math.max(30,fontSize*1.15)}]}>{paragraph.runs.map((run,position)=><Text key={position} style={{fontWeight:run.bold||paragraph.heading?'700':'400',fontStyle:run.italic?'italic':'normal',textDecorationLine:run.underline?'underline':'none'}}>{run.text}</Text>)}</Text>)}<SourceLayerCredit layer={layer}/></>;}

export function QuranScreen({onComplete,fontSize,networkEnabled,childId,audioEnabled=true}:QuranScreenProps) {
  const [environment,setEnvironment]=useState(process.env.EXPO_PUBLIC_QF_ENV === 'prelive' ? 'prelive' : 'production');
  const repository = useMemo(()=>new QuranRepository(undefined,environment),[environment]);
  const chapterRequest = useMemo(()=>new LatestRequest(),[]);
  const [view,setView]=useState<ViewName>('home');
  const [chapters,setChapters]=useState<Surah[]>([]);
  const [surah,setSurah]=useState<Surah>();
  const [ayahs,setAyahs]=useState<Ayah[]>([]);
  const [selected,setSelected]=useState<Ayah>();
  const [memorizeEndKey,setMemorizeEndKey]=useState<string>();
  const [query,setQuery]=useState('');
  const [bookmarks,setBookmarks]=useState<string[]>([]);
  const [wordIndex,setWordIndex]=useState<number>();
  const [playbackWordPosition,setPlaybackWordPosition]=useState<number>();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [quizIndex,setQuizIndex]=useState(0);
  const [quizScore,setQuizScore]=useState(0);
  const [quizAnswer,setQuizAnswer]=useState<string>();
  const [quizSaved,setQuizSaved]=useState(false);
  const quizSaveLock=useRef(false);
  const readingLocation=useRef<{surah?:number;ayah?:string}>({});
  useEffect(()=>{readingLocation.current={surah:surah?.number,ayah:selected?.key};},[surah?.number,selected?.key]);
  // Parent downloads and connection changes are reflected when this screen regains focus.
  useFocusEffect(useCallback(()=>{
    let alive=true;
    void(async()=>{
      const connection=await configuredContentConnection().catch(()=>null);
      if(!alive)return;
      if(connection&&connection.environment!==environment){setEnvironment(connection.environment);return;}
      const [data,saved]=await Promise.all([repository.chapters(),childId?repository.bookmarks(childId):Promise.resolve([])]);
      if(!alive)return;setChapters(data);setBookmarks(saved);
      const location=readingLocation.current;
      if(location.surah){const request=chapterRequest.begin();const fresh=await repository.verses(location.surah);if(alive&&chapterRequest.isCurrent(request)){setAyahs(fresh);setSelected(old=>old?fresh.find(a=>a.key===old.key):undefined);setSurah(data.find(c=>c.number===location.surah));setBusy(false);}}
    })().catch(()=>{if(alive)setMessage('We could not open your saved reading. Try again or ask a parent for help.');});
    return()=>{alive=false;chapterRequest.cancel();};
  },[repository,chapterRequest,childId,environment]));
  useEffect(()=>()=>chapterRequest.cancel(),[chapterRequest]);
  async function openSurah(chapter:Surah,ayahKey?:string) {
    const request=chapterRequest.begin();
    setSurah(chapter);setMessage('');setBusy(true);setAyahs([]);setSelected(undefined);setWordIndex(undefined);setPlaybackWordPosition(undefined);setMemorizeEndKey(undefined);setView('reader');
    try {
      const data=await repository.verses(chapter.number);
      if(!chapterRequest.isCurrent(request))return;
      setAyahs(data);
      if(ayahKey){const found=data.find(a=>a.key===ayahKey);setSelected(found);if(found)setView('detail');}
    }
    catch{if(chapterRequest.isCurrent(request))setMessage('This reading could not open. Try again or choose one of your offline surahs.');}
    finally{if(chapterRequest.isCurrent(request))setBusy(false);}
  }
  async function bookmark(ayah:Ayah) {
    if(!childId){setMessage('Choose a child profile to save bookmarks.');return;}
    try {const saved=await repository.toggleBookmark(childId,ayah.key);setBookmarks(old=>saved?[...old,ayah.key]:old.filter(k=>k!==ayah.key));setMessage(saved?'Ayah bookmarked.':'Bookmark removed.');}catch{setMessage('Your bookmark could not be saved. Try again or ask a parent for help.');}
  }
  async function complete(id:string,score?:number) {setBusy(true);try{await onComplete(id,score);setMessage('MashaAllah! Your practice is saved.');return true;}catch{setMessage('Your practice could not be saved. Try again or ask a parent for help.');return false;}finally{setBusy(false);}}
  function startQuiz(){setQuizIndex(0);setQuizScore(0);setQuizAnswer(undefined);setQuizSaved(false);quizSaveLock.current=false;setMessage('');setView('quiz');}
  async function saveQuiz(){
    if(quizSaveLock.current||quizSaved)return;
    quizSaveLock.current=true;
    const saved=await complete('quran:reader-quiz',Math.round(quizScore/quiz.length*100));
    if(saved)setQuizSaved(true);
    else quizSaveLock.current=false;
  }
  function detail(ayah:Ayah,mode:ViewName) {setSelected(ayah);setMemorizeEndKey(ayah.key);setWordIndex(undefined);setPlaybackWordPosition(undefined);setMessage('');setView(mode);}
  const tracks:AudioTrack[]=ayahs.map(a=>{
    const bundled=quranAudioAssets[a.key];
    const useBundled=!a.audio?.localUri&&bundled!==undefined&&(!networkEnabled||a.audio?.source.name===AUDIO_SOURCE.name);
    return {id:a.key,title:`Ayah ${a.key}`,uri:a.audio?.localUri??a.audio?.url,asset:useBundled?bundled:undefined,sourceLabel:useBundled?`Alafasy · ${AUDIO_SOURCE.name}`:a.audio?`${a.audio.reciter} · ${a.audio.source.name}`:'Ask a parent to add this recording'};
  });
  const selectedTrack=selected&&audioEnabled?tracks.filter(t=>t.id===selected.key):[];
  const memorizeAyahs=selected?selectAyahRange(ayahs,selected.key,memorizeEndKey):[];
  const memorizeChoices=selected?selectAyahRange(ayahs,selected.key,ayahs.at(-1)?.key):[];
  const memorizeRangeKey=memorizeAyahs.map(a=>a.key).join('-');
  const memorizeTracks=audioEnabled?memorizeAyahs.map(a=>tracks.find(track=>track.id===a.key)!).filter(Boolean):[];
  const ayahReference=parseAyahReference(query);
  const referenceSurah=ayahReference?chapters.find(s=>s.number===ayahReference.surahNumber):undefined;
  const filtered=chapters.filter(s=>ayahReference?s.number===ayahReference.surahNumber:`${s.number} ${s.name} ${s.englishName} ${s.arabicName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const words:QuranWord[]|undefined=selected?.words?.length?selected.words:selected?.canonicalText.split(' ').filter(Boolean).map((word,index)=>({id:`${selected.key}:${index}`,position:index+1,canonicalText:word,source:selected.source}));
  const quiz=[{question:'How many surahs are listed in the Quran reader?',choices:['114','30','7'],answer:'114'},{question:'Which button saves an ayah for later?',choices:['Bookmark','Previous','Pause'],answer:'Bookmark'},{question:'Who controls optional content downloads?',choices:['A parent','Other children','A public chat'],answer:'A parent'}];
  const currentQuestion=quiz[quizIndex];
  const title=view==='home'?'Quran':view==='list'?'All 114 surahs':view==='saved'?'My bookmarks':view==='words'?'Word by word':view==='memorize'?'Memorize':view==='player'?'Quran player':view==='quiz'?'Reader quiz':surah?.name??'Quran';
  function back(){chapterRequest.cancel();setBusy(false);setMessage('');setView(['detail','words','memorize','player','quiz'].includes(view)?'reader':'home');}
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View><Text style={styles.kicker}>READ · LISTEN · REMEMBER</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text></View>{view!=='home'&&<Button label="Back" secondary onPress={back}/>}</View>
    {busy&&<ActivityIndicator accessibilityLabel="Loading Quran content" color="#17645B"/>}
    {!!message&&<Text accessibilityRole="alert" style={styles.notice}>{message}</Text>}
    {view==='home'&&<><View style={styles.hero}><Text style={styles.heroTitle}>A little every day</Text><Text style={styles.heroText}>Read slowly, listen carefully, and practise with someone you trust.</Text><View style={styles.row}><Button label="Browse surahs" onPress={()=>setView('list')}/><Button label="My bookmarks" secondary onPress={()=>setView('saved')}/></View></View><Text style={styles.subtitle}>Ready to read offline</Text>{chapters.filter(s=>s.availableOffline).map(chapter=><Pressable key={chapter.number} accessibilityRole="button" accessibilityLabel={`${chapter.number}, ${chapter.name}, ${chapter.ayahCount} ayahs`} style={styles.chapter} onPress={()=>void openSurah(chapter)}><Text style={styles.number}>{chapter.number}</Text><View style={styles.grow}><Text style={styles.chapterName}>{chapter.name}</Text><Text style={styles.muted}>{chapter.englishName} · {chapter.ayahCount} ayahs</Text></View><Text style={[styles.chapterArabic,{fontSize:fontSize}]}>{chapter.arabicName}</Text></Pressable>)}<Text style={styles.source}>Five sourced surahs are included. Parent Mode can download more published content through Quran Foundation.</Text></>}
    {view==='list'&&<>
      <TextInput accessibilityLabel="Search surah names, numbers, or an ayah such as 107:2" placeholder="Surah name or ayah · 107:2" value={query} onChangeText={setQuery} style={styles.search}/>
      {ayahReference&&referenceSurah&&<Button label={`Open ayah ${ayahReference.key}`} onPress={()=>void openSurah(referenceSurah,ayahReference.key)}/>}
      {filtered.map(chapter=><Pressable key={chapter.number} accessibilityRole="button" style={styles.chapter} onPress={()=>void openSurah(chapter)}><Text style={styles.number}>{chapter.number}</Text><View style={styles.grow}><Text style={styles.chapterName}>{chapter.name}</Text><Text style={styles.muted}>{chapter.revelationType} · {chapter.ayahCount} ayahs{chapter.availableOffline?' · Offline':' · Needs download'}</Text></View><Text style={styles.chapterArabic}>{chapter.arabicName}</Text></Pressable>)}
      {!filtered.length&&<Text style={styles.muted}>No surahs match this search.</Text>}
    </>}
    {view==='saved'&&<>{bookmarks.map(key=><Button key={key} label={`Open ayah ${key}`} secondary onPress={()=>{const chapter=chapters.find(s=>s.number===Number(key.split(':')[0]));if(chapter)void openSurah(chapter,key);}}/>)}{!bookmarks.length&&<Text style={styles.muted}>Use Bookmark beside an ayah to keep it here.</Text>}</>}
    {view==='reader'&&<>
      <Text style={styles.muted}>{surah?.englishName} · {surah?.revelationType} · {surah?.ayahCount} ayahs</Text>
      {!busy&&!ayahs.length&&<View style={styles.card}><Text style={styles.subtitle}>This surah is not downloaded yet</Text><Text style={styles.body}>Ask a parent to sync Quran text in Content Downloads. The five included surahs are available offline now.</Text><Button label="Choose an offline surah" onPress={()=>setView('home')}/></View>}
      {!!ayahs.length&&<>
        <View style={styles.row}><Button label="Listen to surah" onPress={()=>setView('player')}/><Button label="Reader quiz" secondary onPress={startQuiz}/></View>
        {ayahs.map(ayah=><View key={ayah.key} style={styles.card}>
          <Text style={styles.reference}>{ayah.key}</Text>
          <Text selectable accessibilityLabel={`Arabic ayah ${ayah.key}`} style={[styles.arabic,arabicDisplayProps(fontSize)]}>{ayah.canonicalText}</Text>
          {ayah.transliteration&&<><Text style={styles.reference}>Transliteration</Text><Transliteration layer={ayah.transliteration} fontSize={fontSize}/><SourceLayerCredit layer={ayah.transliteration}/></>}
          <Text style={styles.translation}>{ayah.translation?.text??'An English translation is not downloaded.'}</Text><Source ayah={ayah}/>
          <View style={styles.row}><Button label="Play / detail" onPress={()=>detail(ayah,'detail')}/><Button label="Word by word" secondary onPress={()=>detail(ayah,'words')}/><Button label="Memorize" secondary onPress={()=>detail(ayah,'memorize')}/><Button label={bookmarks.includes(ayah.key)?'Bookmarked':'Bookmark'} secondary onPress={()=>void bookmark(ayah)}/></View>
        </View>)}
        <Button disabled={busy} label="Complete reading lesson" onPress={()=>void complete(`quran:surah:${surah?.number}`)}/>
      </>}
    </>}
    {view==='detail'&&selected&&<View style={styles.card}>
      <Text style={styles.reference}>{selected.key}</Text><Text selectable style={[styles.arabic,arabicDisplayProps(fontSize)]}>{selected.canonicalText}</Text>
      {audioEnabled?<AudioControls key={selected.key} tracks={selectedTrack} networkAllowed={networkEnabled}/>:<Text style={styles.muted}>Audio is disabled in Parent Mode.</Text>}
      <Text style={styles.subtitle}>Transliteration</Text>
      {selected.transliteration?<><Transliteration layer={selected.transliteration} fontSize={fontSize}/><SourceLayerCredit layer={selected.transliteration}/><Text style={styles.muted}>Use the Arabic and sourced recitation when practising pronunciation.</Text></>:<Text style={styles.body}>Whole-ayah transliteration is unavailable for this ayah.</Text>}
      <Text style={styles.subtitle}>English translation</Text><Text style={styles.translation}>{selected.translation?.text??'No English translation downloaded.'}</Text><Source ayah={selected}/>
      <PublishedMeaning ayah={selected}/>
      {selected.tafsir&&<Tafsir layer={selected.tafsir} fontSize={fontSize}/>}
      {!selected.tafsir&&<Text style={styles.muted}>For a fuller explanation, read with a parent or teacher. A parent can add a published tafsir when one is available.</Text>}
      {!selected.publishedMeaning&&!selected.tafsir&&<Text style={styles.muted}>{selected.translation?'Read the attributed translation with a parent or teacher.':'Ask a parent to add a published translation, or read the Arabic together with a teacher.'}</Text>}
      <View style={styles.row}><Button label="Word by word" onPress={()=>setView('words')}/><Button label="Memorize" secondary onPress={()=>{setMemorizeEndKey(selected.key);setView('memorize');}}/><Button label={bookmarks.includes(selected.key)?'Remove bookmark':'Bookmark'} secondary onPress={()=>void bookmark(selected)}/></View>
      <View style={styles.row}><Button label="Previous ayah" secondary disabled={selected.ayahNumber<=1} onPress={()=>setSelected(ayahs[selected.ayahNumber-2])}/><Button label="Next ayah" secondary disabled={selected.ayahNumber>=ayahs.length} onPress={()=>setSelected(ayahs[selected.ayahNumber])}/></View>
    </View>}
    {view==='words'&&selected&&<View style={styles.card}>
      <Text style={styles.reference}>{selected.key}</Text>
      <Text style={styles.body}>Tap an Arabic word to focus on it. Sourced word meanings appear after they are downloaded.</Text>
      {selected.words?.length&&selected.audio?.wordTimings?.length&&audioEnabled?<AudioControls key={`timed-${selected.key}`} tracks={selectedTrack} networkAllowed={networkEnabled}
        onPositionChange={(seconds,playing)=>setPlaybackWordPosition(playing?activeWordPosition(selected.audio?.wordTimings,seconds):undefined)}/>
        :<Text style={styles.muted}>Word timing is unavailable for this recording. You can still tap words to study them.</Text>}
      <View style={styles.words}>{words?.map((word,index)=><Pressable key={word.id} accessibilityRole="button" accessibilityLabel={`Word ${index+1}`}
        accessibilityState={{selected:wordIndex===index||playbackWordPosition===word.position}} onPress={()=>setWordIndex(index)}
        style={[styles.word,wordIndex===index&&styles.wordSelected,playbackWordPosition===word.position&&{backgroundColor:'#D0E9AB',borderColor:'#175F55',borderWidth:2}]}>
        <Text style={[styles.arabic,arabicDisplayProps(fontSize)]}>{word.canonicalText}</Text>
      </Pressable>)}</View>
      {wordIndex!==undefined&&words?.[wordIndex]&&<View><Text style={styles.subtitle}>Word {wordIndex+1}</Text><Text style={styles.body}>Transliteration: {words[wordIndex].transliteration?.text??'Not downloaded'}</Text><Text style={styles.body}>Meaning: {words[wordIndex].translation?.text??'Not downloaded'}</Text>{words[wordIndex].translation&&<Text style={styles.source}>{words[wordIndex].translation?.source.name}</Text>}{audioEnabled&&words[wordIndex].audioUrl&&<AudioControls tracks={[{id:words[wordIndex].id,title:'Word pronunciation',uri:words[wordIndex].audioUrl,sourceLabel:words[wordIndex].source.name}]} networkAllowed={networkEnabled}/>}</View>}
      <Source ayah={selected}/>
    </View>}
    {view==='memorize'&&selected&&<>
      <View style={styles.card}>
        <Text style={styles.subtitle}>Choose your ayah range</Text>
        <Text style={styles.body}>Start at {selected.key}. Choose the last ayah to practice, up to ten together.</Text>
        <View style={styles.row}>{memorizeChoices.map(ayah=><Button key={ayah.key} secondary label={`${memorizeAyahs.at(-1)?.key===ayah.key?'✓ ':''}Through ${ayah.key}`} onPress={()=>setMemorizeEndKey(ayah.key)}/>)}</View>
        {memorizeAyahs.map(ayah=><Source key={ayah.key} ayah={ayah}/>)}
      </View>
      <MemorizationScreen key={memorizeRangeKey} lessonId={`quran:memorize:${memorizeRangeKey}`} title={memorizeAyahs.length>1?`Ayahs ${selected.key}–${memorizeAyahs.at(-1)?.key}`:`Ayah ${selected.key}`} arabic={selected.canonicalText}
        passages={memorizeAyahs.map(ayah=>({id:ayah.key,arabic:ayah.canonicalText,translation:ayah.translation?.text,words:ayah.words?.map(word=>word.canonicalText)}))}
        tracks={memorizeTracks} fontSize={fontSize} audioEnabled={audioEnabled} networkAllowed={networkEnabled}
        onLevelChange={async(level)=>{if(childId)for(const ayah of memorizeAyahs)await repository.saveMemorization(childId,ayah.key,level);}}
        onComplete={async(rating)=>{if(childId)for(const ayah of memorizeAyahs)await repository.saveMemorization(childId,ayah.key,'complete',rating);await onComplete(`quran:memorize:${memorizeRangeKey}`);setMessage('Your memorization practice is saved.');}}
        onExit={()=>setView('reader')}/>
    </>}
    {view==='player'&&<View style={styles.card}><Text style={styles.body}>Use Play, Pause, Repeat, Previous, and Next. Recitation requires downloaded audio or parent-enabled streaming.</Text>{audioEnabled?<AudioControls tracks={tracks} networkAllowed={networkEnabled} continuous/>:<Text style={styles.muted}>Audio is disabled in Parent Mode.</Text>}</View>}
    {view==='quiz'&&<View style={styles.card}>{currentQuestion?<><Text style={styles.reference}>Question {quizIndex+1} of {quiz.length}</Text><Text style={styles.subtitle}>{currentQuestion.question}</Text>{currentQuestion.choices.map(choice=><Button key={choice} label={choice} secondary disabled={quizAnswer!==undefined} onPress={()=>{setQuizAnswer(choice);if(choice===currentQuestion.answer)setQuizScore(s=>s+1);}}/>)}{quizAnswer!==undefined&&<><Text style={styles.body}>{quizAnswer===currentQuestion.answer?'MashaAllah! Great work.':`Keep practising. The answer is ${currentQuestion.answer}.`}</Text><Button label="Next" onPress={()=>{setQuizIndex(i=>i+1);setQuizAnswer(undefined);}}/></>}</>:<><Text style={styles.subtitle}>Great practice! {quizScore} of {quiz.length}</Text><Button disabled={busy||quizSaved} label={quizSaved?'Practice saved':busy?'Saving…':'Save quiz practice'} onPress={()=>void saveQuiz()}/></>}</View>}
  </ScrollView>;
}
const styles=StyleSheet.create({page:{padding:20,gap:14,paddingBottom:44},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},kicker:{fontSize:11,fontWeight:'800',letterSpacing:1.5,color:'#437168'},title:{fontSize:30,fontWeight:'800',color:'#173E38'},hero:{padding:22,borderRadius:24,backgroundColor:'#175F55',gap:12},heroTitle:{fontSize:24,color:'#FFF9E8',fontWeight:'800'},heroText:{fontSize:17,lineHeight:26,color:'#E5F0DE'},subtitle:{fontSize:20,fontWeight:'700',color:'#173E38',marginTop:6},chapter:{flexDirection:'row',padding:16,alignItems:'center',gap:12,borderRadius:18,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E0E8E0'},number:{backgroundColor:'#E8F2E6',padding:10,borderRadius:12,color:'#175F55',fontWeight:'800',minWidth:42,textAlign:'center'},grow:{flex:1},chapterName:{fontSize:18,fontWeight:'700',color:'#173E38'},chapterArabic:{fontSize:25,color:'#173E38',textAlign:'right',writingDirection:'rtl'},muted:{fontSize:14,lineHeight:22,color:'#536B64'},card:{padding:18,borderRadius:20,borderWidth:1,borderColor:'#D9E6DA',backgroundColor:'#FFFFFF',gap:12},reference:{fontSize:14,fontWeight:'800',color:'#17645B'},arabic:{color:'#173E38',paddingVertical:10},translation:{fontSize:18,lineHeight:29,color:'#264B44',textAlign:'left',writingDirection:'ltr'},body:{fontSize:16,lineHeight:26,color:'#344C47',writingDirection:'ltr',textAlign:'left'},source:{fontSize:12,lineHeight:20,color:'#536B64'},row:{flexDirection:'row',flexWrap:'wrap',gap:10},button:{minHeight:48,paddingHorizontal:16,paddingVertical:14,backgroundColor:'#17645B',borderRadius:14,justifyContent:'center',marginVertical:2},buttonText:{color:'white',fontWeight:'700',fontSize:15},secondary:{backgroundColor:'#EBF3E9',borderWidth:1,borderColor:'#C9DECA'},secondaryText:{color:'#175F55'},disabled:{opacity:0.5},search:{backgroundColor:'white',borderWidth:1,borderColor:'#B8CEC0',padding:16,borderRadius:14,fontSize:17},notice:{backgroundColor:'#FFF0CF',padding:14,borderRadius:14,color:'#584923',fontSize:15,lineHeight:24},words:{flexDirection:'row-reverse',flexWrap:'wrap',gap:10},word:{paddingHorizontal:12,borderWidth:1,borderColor:'#D4E2D4',borderRadius:14},wordSelected:{backgroundColor:'#E6F3D9',borderColor:'#17645B'}});

export default QuranScreen;
