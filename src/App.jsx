import { useState, useRef, useEffect, useCallback } from "react";

import { api } from "./api";
import StudentSelect from "./StudentSelect";
import TeacherStage from "./TeacherStage";
import { createTeacherVoice } from "./teacherVoice.js";
import StoryVideos from "./StoryVideos.jsx";

// ── Mouth Avatar ──────────────────────────────────────────
const MOUTH_SHAPES = {
  "أ":{shape:"open_wide",label:"أ · Alif",color:"#f0c060",desc:"Open wide from throat"},
  "ب":{shape:"lips_together",label:"ب · Ba",color:"#4ade80",desc:"Press lips together"},
  "ت":{shape:"tongue_top",label:"ت · Ta",color:"#60a5fa",desc:"Tongue to upper teeth"},
  "ث":{shape:"tongue_between",label:"ث · Tha",color:"#f472b6",desc:"Tongue between teeth"},
  "ج":{shape:"throat",label:"ج · Jim",color:"#a78bfa",desc:"Back of throat"},
  "ح":{shape:"breath_h",label:"ح · Ha",color:"#fb923c",desc:"Deep breath from throat"},
  "خ":{shape:"throat_rough",label:"خ · Kha",color:"#f87171",desc:"Rough throat sound"},
  "د":{shape:"tongue_top",label:"د · Dal",color:"#34d399",desc:"Tongue to upper teeth"},
  "ر":{shape:"roll_r",label:"ر · Ra",color:"#fbbf24",desc:"Roll tongue lightly"},
  "س":{shape:"teeth_close",label:"س · Sin",color:"#38bdf8",desc:"Teeth close, air flows"},
  "ش":{shape:"lips_round",label:"ش · Shin",color:"#e879f9",desc:"Lips slightly rounded"},
  "ع":{shape:"throat_deep",label:"ع · Ain",color:"#f0c060",desc:"Deep throat squeeze"},
  "غ":{shape:"throat_gargle",label:"غ · Ghain",color:"#4ade80",desc:"Soft throat gargle"},
  "ف":{shape:"lip_teeth",label:"ف · Fa",color:"#60a5fa",desc:"Lower lip to upper teeth"},
  "ق":{shape:"back_throat",label:"ق · Qaf",color:"#f472b6",desc:"Very back of throat"},
  "ك":{shape:"mid_throat",label:"ك · Kaf",color:"#a78bfa",desc:"Middle of throat"},
  "ل":{shape:"tongue_top",label:"ل · Lam",color:"#fb923c",desc:"Tongue to top of mouth"},
  "م":{shape:"lips_together",label:"م · Mim",color:"#f87171",desc:"Lips closed, nasal hum"},
  "ن":{shape:"tongue_top",label:"ن · Nun",color:"#34d399",desc:"Tongue up, nasal sound"},
  "ه":{shape:"open_breath",label:"ه · Ha",color:"#fbbf24",desc:"Breathe out open mouth"},
  "و":{shape:"lips_round",label:"و · Waw",color:"#38bdf8",desc:"Round your lips"},
  "ي":{shape:"smile_wide",label:"ي · Ya",color:"#e879f9",desc:"Wide smile position"},
};

function WritingPad({ prompt, onSubmit, onClose }) {
  const padRef = useRef(null);
  const drawingRef = useRef(false);

  const setup = useCallback(() => {
    const c = padRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.floor(rect.width * scale));
    c.height = Math.max(1, Math.floor(rect.height * scale));
    const ctx = c.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#f8f1dc";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "rgba(13,40,24,0.13)";
    ctx.lineWidth = 1;
    for (let x = 24; x < rect.width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke(); }
    for (let y = 24; y < rect.height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke(); }
    if (prompt?.letter) {
      ctx.font = `${Math.min(rect.height * 0.58, 150)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(26,122,64,0.16)";
      ctx.fillText(prompt.letter, rect.width / 2, rect.height / 2);
    }
  }, [prompt]);

  useEffect(() => { setup(); }, [setup]);

  const point = e => {
    const c = padRef.current, rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const begin = e => {
    e.preventDefault();
    const c = padRef.current, ctx = c.getContext("2d"), p = point(e);
    drawingRef.current = true;
    ctx.strokeStyle = "#0d2818";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = e => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = padRef.current.getContext("2d"), p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = e => { e.preventDefault(); drawingRef.current = false; };
  const submit = () => {
    const b64 = padRef.current.toDataURL("image/jpeg", 0.82).split(",")[1];
    onSubmit(b64);
  };

  return (
    <div style={{margin:"6px 14px 0",width:"calc(100% - 28px)",background:"#16351f",border:"2px solid rgba(240,192,64,0.55)",borderRadius:14,padding:10,boxSizing:"border-box"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8}}>
        <div style={{fontSize:13,color:"#f0c060",fontWeight:"bold"}}>Write: {prompt?.label || "practice"}</div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={setup} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",color:"white",borderRadius:8,padding:"6px 9px",fontSize:12}}>Clear</button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",color:"white",borderRadius:8,padding:"6px 9px",fontSize:12}}>Hide</button>
          <button onClick={submit} style={{background:"#1a7a40",border:"none",color:"white",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:"bold"}}>Done</button>
        </div>
      </div>
      <canvas
        ref={padRef}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        style={{width:"100%",height:190,borderRadius:10,display:"block",touchAction:"none",boxShadow:"inset 0 2px 10px rgba(0,0,0,0.25)",background:"#f8f1dc"}}
      />
    </div>
  );
}

function parseBlackboard(text) {
  const lower = text.toLowerCase();
  if (lower.includes("al-fatiha")||lower.includes("fatiha")) return {title:"Surah Al-Fatiha",type:"ayah",lines:[
    {arabic:"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",transliteration:"Bismillahi r-rahmani r-raheem",translation:"In the name of Allah"},
    {arabic:"الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",transliteration:"Alhamdu lillahi rabb il-aalameen",translation:"All praise to Allah, Lord of all worlds"},
  ]};
  if (lower.includes("al-ikhlas")||lower.includes("ikhlas")) return {title:"Surah Al-Ikhlas",type:"ayah",lines:[
    {arabic:"قُلْ هُوَ اللَّهُ أَحَدٌ",transliteration:"Qul huwa Allahu ahad",translation:"Say: He is Allah, the One"},
    {arabic:"اللَّهُ الصَّمَدُ",transliteration:"Allahu s-samad",translation:"Allah, the Eternal Refuge"},
  ]};
  if (lower.includes("shahada")||lower.includes("kalima")) return {title:"The Shahada",type:"ayah",lines:[
    {arabic:"لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ",transliteration:"La ilaha illa Allah, Muhammadun rasulullah",translation:"There is no god but Allah, Muhammad is His messenger"},
  ]};
  if (lower.includes("bismillah")) return {title:"Bismillah",type:"ayah",lines:[
    {arabic:"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",transliteration:"Bismillahi r-rahmani r-raheem",translation:"In the name of Allah"},
  ]};
  if (lower.includes("alef")||lower.includes("alif")||lower.includes("letter")||lower.includes("alphabet")) return {title:"Arabic Letters",type:"arabic_letter",lines:[
    {arabic:"أ  ب  ت  ث  ج  ح  خ",transliteration:"Alef · Ba · Ta · Tha · Jim · Ha · Kha"},
    {arabic:"د  ذ  ر  ز  س  ش  ص",transliteration:"Dal · Thal · Ra · Zay · Sin · Shin · Sad"},
  ]};
  if (lower.includes("subhanallah")||lower.includes("alhamdulillah")) return {title:"Dhikr",type:"ayah",lines:[
    {arabic:"سُبْحَانَ اللَّهِ",transliteration:"SubhanAllah",translation:"Glory be to Allah"},
    {arabic:"الْحَمْدُ لِلَّهِ",transliteration:"Alhamdulillah",translation:"All praise to Allah"},
    {arabic:"اللَّهُ أَكْبَرُ",transliteration:"Allahu Akbar",translation:"Allah is the Greatest"},
  ]};
  const arabicMatches = text.match(/[\u0600-\u06FF\s]{3,}/g);
  if (arabicMatches?.length > 0) return {title:"On the Board",type:"ayah",lines:[{arabic:arabicMatches[0].trim()}]};
  return null;
}

function detectLetter(text) {
  const map = {"alif":"أ","alef":"أ"," ba ":"ب","baa":"ب"," ta ":"ت","taa":"ت","tha":"ث","jim":"ج","jeem":"ج"," ha ":"ح","haa":"ح","kha":"خ","dal":"د","daal":"د"," ra ":"ر","raa":"ر","sin":"س","seen":"س","shin":"ش","sheen":"ش","ain":"ع","ayn":"ع","ghain":"غ"," fa ":"ف","faa":"ف","qaf":"ق","qaaf":"ق","kaf":"ك","kaaf":"ك","lam":"ل","mim":"م","meem":"م","nun":"ن","noon":"ن","waw":"و","yaa":"ي"," ya ":"ي"};
  const lower = " "+text.toLowerCase()+" ";
  for (const [k,l] of Object.entries(map)) {
    if (lower.includes(k) && MOUTH_SHAPES[l]) return {...MOUTH_SHAPES[l], letter:l};
  }
  return null;
}

function detectWritingPrompt(text, letterData) {
  const lower = text.toLowerCase();
  if (!/(write|trace|draw|finger|show me|copy|practice writing)/.test(lower)) return null;
  const letter = letterData?.letter || (lower.includes("alif") || lower.includes("alef") ? "أ" : lower.includes("ba") || lower.includes("baa") ? "ب" : "");
  const label = letterData?.label || (letter ? `${letter} practice` : "letter practice");
  return { letter, label };
}

// ── Face ───────────────────────────────────────────────────
function Face({ state, size=95 }) {
  const [blink,setBlink]=useState(false);
  useEffect(()=>{
    if(state==="thinking") return;
    const t=setInterval(()=>{setBlink(true);setTimeout(()=>setBlink(false),130);},2800+Math.random()*1500);
    return()=>clearInterval(t);
  },[state]);
  const eyeRy=blink?1.5:12,eyeY=100;
  return(
    <svg viewBox="0 0 200 230" width={size} height={size} style={{filter:"drop-shadow(0 4px 16px rgba(0,0,0,0.4))"}}>
      <ellipse cx="100" cy="140" rx="88" ry="98" fill="#0e4d2a"/>
      <rect x="82" y="172" width="36" height="30" rx="7" fill="#FDEBD0"/>
      <ellipse cx="100" cy="118" rx="65" ry="70" fill="#FDEBD0"/>
      <ellipse cx="100" cy="68" rx="67" ry="36" fill="#0e4d2a"/>
      <ellipse cx="100" cy="74" rx="60" ry="30" fill="#1a7a40"/>
      <path d="M35 125 Q18 162 40 200 Q68 178 82 172" fill="#0e4d2a"/>
      <path d="M165 125 Q182 162 160 200 Q132 178 118 172" fill="#0e4d2a"/>
      <ellipse cx="76" cy={eyeY} rx="14" ry={eyeRy} fill="white"/>
      {!blink&&<circle cx={76+(state==="listening"?-4:0)} cy={eyeY} r={8} fill="#1a0800"/>}
      {!blink&&<circle cx={78} cy={eyeY-3} r={2.5} fill="white"/>}
      <ellipse cx="124" cy={eyeY} rx="14" ry={eyeRy} fill="white"/>
      {!blink&&<circle cx={124+(state==="listening"?-4:0)} cy={eyeY} r={8} fill="#1a0800"/>}
      {!blink&&<circle cx={126} cy={eyeY-3} r={2.5} fill="white"/>}
      {state==="thinking"&&!blink&&[[76,eyeY],[124,eyeY]].map(([cx,cy],i)=>(
        <g key={i}><circle cx={cx-5} cy={cy} r={4} fill="#1a0800"/><circle cx={cx+5} cy={cy} r={4} fill="#1a0800"/></g>
      ))}
      <path d="M62 65 Q76 59 90 63" stroke="#3a1500" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M110 63 Q124 59 138 65" stroke="#3a1500" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M96 118 Q93 128 90 133 Q100 136 110 133 Q107 128 104 118" fill="none" stroke="#c8956a" strokeWidth="1.2"/>
      {state==="speaking"?<><path d="M83 148 Q100 142 117 148" stroke="#b84c52" strokeWidth="2" fill="none"/><ellipse cx="100" cy="154" rx="17" ry="9" fill="#7a1f25"/><ellipse cx="100" cy="157" rx="12" ry="5.5" fill="#c05560"/></>
        :state==="thinking"?<path d="M87 152 Q100 150 113 152" stroke="#b84c52" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        :<path d="M83 148 Q100 160 117 148" stroke="#b84c52" strokeWidth="3" fill="none" strokeLinecap="round"/>}
      <ellipse cx="65" cy="128" rx="12" ry="8" fill="#f4a0a0" opacity="0.35"/>
      <ellipse cx="135" cy="128" rx="12" ry="8" fill="#f4a0a0" opacity="0.35"/>
      {state==="thinking"&&[0,1,2].map(i=>(
        <circle key={i} cx={152+i*14} cy={60-i*12} r={5+i*2} fill="#1a7a40" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.1;0.9" dur="0.9s" begin={`${i*0.3}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      {state==="listening"&&[28,172].map((cx,i)=>(
        <circle key={i} cx={cx} cy="118" r="8" fill="none" stroke="#1a7a40" strokeWidth="2.5">
          <animate attributeName="r" values="5;16;5" dur="1.1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.1s" repeatCount="indefinite"/>
        </circle>
      ))}
      {state==="watching"&&[76,124].map((cx,i)=>(
        <circle key={i} cx={cx} cy={eyeY} r={15} fill="none" stroke="#f0c040" strokeWidth="1.5" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.05;0.5" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════
//  STUDENT SELECT
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  PARENT BRIEFING
// ══════════════════════════════════════════════════════════
function ParentBriefing({ students, onStart, onBack }) {
  const classStudents=Array.isArray(students)?students.filter(Boolean):[students].filter(Boolean);
  const primary=classStudents[0]||{};
  const classLabel=classStudents.length>1?`${classStudents.length} students`:primary.name;
  const [notes,setNotes]=useState("");
  const [topics,setTopics]=useState([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const topicOptions=[
    {key:"arabic",label:"📖 Arabic Letters"},
    {key:"quran",label:"🕌 Quran Recitation"},
    {key:"surah",label:"📿 Surah Memorization"},
    {key:"stories",label:"⭐ Islamic Stories"},
    {key:"duas",label:"🤲 Duas & Prayers"},
    {key:"tajweed",label:"🎵 Tajweed"},
    {key:"pillars",label:"🏛 Pillars of Islam"},
    {key:"iman",label:"💎 Pillars of Iman"},
  ];
  const toggle=t=>setTopics(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);

  const submit=async()=>{
    if(saving) return;
    setSaving(true);setError("");
    // Build topic string to pass to teacher
    const topicLabels=topics.map(t=>topicOptions.find(o=>o.key===t)?.label.slice(2)).filter(Boolean);
    const combined=[...topicLabels, notes.trim()].filter(Boolean).join(". ");
    try{
      if(combined) await Promise.all(classStudents.map(s=>api("POST","/noor/parent-notes",{student_id:s.id,notes:combined,focus_topics:topics})));
      onStart(combined||null);
    }catch(e){setError(e.message);}
    setSaving(false);
  };

  return(
    <div style={{background:"linear-gradient(160deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",padding:24,gap:20,overflowY:"auto"}}>
      <button className="noor-back" onClick={onBack} disabled={saving}>← Choose students</button>
      <div style={{textAlign:"center",marginTop:10}}><div style={{fontSize:32}}>📋</div><div style={{fontSize:22,fontWeight:"bold",color:"#f0c060"}}>Today's Lesson</div><div style={{fontSize:14,color:"#a8d8b0",marginTop:4}}>For {classLabel}</div></div>
      <div style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:16}}>
        <div>
          <div style={{fontSize:14,color:"#f0c060",marginBottom:10,fontWeight:"bold"}}>Choose today's topic:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {topicOptions.map(t=>(
              <button key={t.key} aria-pressed={topics.includes(t.key)} onClick={()=>toggle(t.key)} style={{
                background:topics.includes(t.key)?"#1a7a40":"rgba(255,255,255,0.08)",
                border:`2px solid ${topics.includes(t.key)?"#1a7a40":"rgba(255,255,255,0.15)"}`,
                borderRadius:14,padding:"12px 10px",color:"white",fontSize:14,cursor:"pointer",
                fontWeight:topics.includes(t.key)?"bold":"normal",
                boxShadow:topics.includes(t.key)?"0 0 12px rgba(26,122,64,0.4)":"none",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:13,color:"#8dc49a",marginBottom:8}}>Extra notes for Sheikh Noor: <span style={{color:"#6aaa80"}}>(optional)</span></div>
          <textarea aria-label="Notes for the teacher" value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder={classStudents.length>1?`e.g. "Uzair needs help with Ba. Aisha is ready for Tha. Rotate questions."`:`e.g. "${primary.name} struggles with the letter Ain. Please go slowly."`}
            rows={3} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:14,padding:"12px",color:"white",fontSize:14,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
        </div>
        {error&&<div className="noor-error" role="alert">{error}</div>}
        <button onClick={submit} disabled={saving} style={{background:"linear-gradient(135deg,#1a7a40,#0e4d2a)",border:"none",borderRadius:20,color:"white",padding:"18px",fontSize:18,fontWeight:"bold",cursor:"pointer",boxShadow:"0 6px 24px rgba(0,0,0,0.4)"}}>
          {saving?"Starting...":classStudents.length>1?"Start Group Class":`Start ${primary.name}'s Class`}
        </button>
        <button disabled={saving} onClick={()=>onStart(null)} style={{background:"transparent",border:"none",color:"#6aaa80",fontSize:13,cursor:"pointer",textAlign:"center"}}>Skip — Let teacher decide</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  CLASSROOM
// ══════════════════════════════════════════════════════════
function Classroom({ students, parentNotes, onBack }) {
  const classRoster=Array.isArray(students)?students.filter(Boolean):[students].filter(Boolean);
  const student=classRoster[0]||{};
  const isGroupClass=classRoster.length>1;
  const rosterText=classRoster.map((s,i)=>`${i+1}. ${s.name}${s.age?`, age ${s.age}`:""} (${s.level||"beginner"})`).join("; ");
  const [activeStudentId,setActiveStudentId]=useState(student.id);
  const [faceState,setFaceState]=useState("idle");
  const [bubble,setBubble]=useState("Starting class...");
  const [caption,setCaption]=useState("");
  const [isListening,setIsListening]=useState(false);
  const [isSpeaking,setIsSpeaking]=useState(false);
  const [isThinking,setIsThinking]=useState(false);
  const [mode,setMode]=useState("TEACHING");
  const [alertMsg,setAlertMsg]=useState("");
  const [waitingForHand,setWaitingForHand]=useState(false);
  const [handDetected,setHandDetected]=useState(false);
  const [blackboard,setBlackboard]=useState(null);
  const [mouthLetter,setMouthLetter]=useState(null);
  const [writingPrompt,setWritingPrompt]=useState(null);
  const [lessonId,setLessonId]=useState(null);
  const [sessionId,setSessionId]=useState(null);
  const [cheatingCount,setCheatingCount]=useState(0);
  const [micGranted,setMicGranted]=useState(false);
  const [micError,setMicError]=useState("");
  const [cameraReady,setCameraReady]=useState(false);
  const [cameraError,setCameraError]=useState("");
  const [handStatus,setHandStatus]=useState("Waiting for camera");
  const [visionStatus,setVisionStatus]=useState("Camera observations have not started");
  const [availableVoices,setAvailableVoices]=useState([]);
  const [voiceChoice,setVoiceChoice]=useState(()=>localStorage.getItem("noor-voice")||"");
  const [narrationVoice,setNarrationVoice]=useState(()=>localStorage.getItem("noor-natural-voice")||"teacher");
  const [voiceStatus,setVoiceStatus]=useState({status:"idle",source:"natural",message:""});
  const [classPaused,setClassPaused]=useState(false);
  const [initializing,setInitializing]=useState(true);
  const initializingRef=useRef(true);
  const narrationVoiceRef=useRef(narrationVoice);
  const teacherVoiceRef=useRef(null);
  const voiceBusyRef=useRef(false);
  const activeClassRef=useRef(true);
  const pausedRef=useRef(false);
  const classEpochRef=useRef(0);
  const chatEpochRef=useRef(0);
  const listenEpochRef=useRef(0);
  const cameraEpochRef=useRef(0);
  const micEpochRef=useRef(0);
  const lastNarrationRef=useRef("");
  const voiceChoiceRef=useRef(voiceChoice);
  const monitorEpochRef=useRef(0);
  const pendingHandRef=useRef(false);
  useEffect(()=>{
    voiceChoiceRef.current=voiceChoice;
    localStorage.setItem("noor-voice",voiceChoice);
  },[voiceChoice]);
  useEffect(()=>{narrationVoiceRef.current=narrationVoice;localStorage.setItem("noor-natural-voice",narrationVoice);},[narrationVoice]);
  useEffect(()=>{
    const update=()=>setAvailableVoices(window.speechSynthesis?.getVoices()||[]);
    update();window.speechSynthesis?.addEventListener("voiceschanged",update);
    return()=>window.speechSynthesis?.removeEventListener("voiceschanged",update);
  },[]);
  const activeStudent=classRoster.find(s=>s.id===activeStudentId)||student;

  const videoRef=useRef(null);
  const canvasRef=useRef(null);
  const camStreamRef=useRef(null);
  const micStreamRef=useRef(null);
  const recRef=useRef(null);
  const interruptRecRef=useRef(null);
  const mediaRecRef=useRef(null);
  const historyRef=useRef([]);
  const visionRef=useRef(null);
  const handRef=useRef(null);
  const modeRef=useRef("TEACHING");
  const lessonIdRef=useRef(null);
  const sessionIdRef=useRef(null);
  const cheatingRef=useRef(0);
  const waitingRef=useRef(false);
  const speakingRef=useRef(false);
  const thinkingRef=useRef(false);
  const listeningRef=useRef(false);
  const finalBufferRef=useRef("");
  const sendTimerRef=useRef(null);
  const silenceTimerRef=useRef(null);
  const lastHandRaiseRef=useRef(0);
  const lastAttentionRef=useRef(0);
  const lastTranscriptRef=useRef("");
  const backendSttRef=useRef(true);
  const lastInterruptAtRef=useRef(0);
  const activeStudentIdRef=useRef(student.id);
  const studentMemoryRef=useRef(null);
  const continuationMemoryRef=useRef("");
  const lessonStateRef=useRef({
    topic: parentNotes || "teacher-selected Islamic lesson",
    phase: "opening",
    turn: 0,
    step: 1,
    energy: "settling",
    attention: "unknown",
    participation: "new session",
    recentMistake: "",
    lastTeacherMove: "opening the class",
    lastTeacherPoint: "",
    lastStudentInput: "",
  });
  if(!studentMemoryRef.current){
    studentMemoryRef.current=Object.fromEntries(classRoster.map(s=>[s.id,{name:s.name,participation:"new",lastInput:"",recentMistake:"",step:1}]));
  }

  useEffect(()=>{activeStudentIdRef.current=activeStudentId;},[activeStudentId]);
  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{lessonIdRef.current=lessonId;},[lessonId]);
  useEffect(()=>{sessionIdRef.current=sessionId;},[sessionId]);
  useEffect(()=>{cheatingRef.current=cheatingCount;},[cheatingCount]);
  useEffect(()=>{waitingRef.current=waitingForHand;},[waitingForHand]);
  useEffect(()=>{speakingRef.current=isSpeaking;},[isSpeaking]);
  useEffect(()=>{thinkingRef.current=isThinking;},[isThinking]);
  useEffect(()=>{listeningRef.current=isListening;},[isListening]);

  const busy=useCallback(()=>voiceBusyRef.current||thinkingRef.current||pausedRef.current||initializingRef.current,[]);

  const stopListening=useCallback(()=>{
    listenEpochRef.current++;
    clearTimeout(sendTimerRef.current);
    finalBufferRef.current="";
    try{recRef.current?.abort();}catch(e){}
    try{if(mediaRecRef.current?.state==="recording") mediaRecRef.current.stop();}catch(e){}
    listeningRef.current=false;setIsListening(false);
  },[]);
  const cancelVoice=useCallback(()=>{
    teacherVoiceRef.current?.cancel();
    try{interruptRecRef.current?.abort();}catch(e){}
    interruptRecRef.current=null;
    voiceBusyRef.current=false;speakingRef.current=false;setIsSpeaking(false);
  },[]);

  const inferStudentFromText=useCallback((text="")=>{
    const lower=text.toLowerCase();
    const named=classRoster.find(s=>{
      const name=(s.name||"").toLowerCase();
      return name&&lower.includes(name);
    });
    return named||classRoster.find(s=>s.id===activeStudentIdRef.current)||student;
  },[classRoster,student]);

  const classifyStudentText=useCallback((text="")=>{
    const lower=text.toLowerCase();
    if(lower.includes("[silence:")) return "student silence";
    if(/\b(back|go back|end class|stop class|stop lesson|exit|quit)\b/.test(lower)) return "navigation command";
    if(/excuse me|teacher|question|can i ask|i have a question|wait|hold on/.test(lower)) return "student interruption or question";
    if(/what('s| is) the lesson|what are we learning|what lesson today|where are we/.test(lower)) return "student asks current lesson";
    if(/letter|arabic|quran|surah|ayah|dua|tajweed|islam|muslim|prophet|salah|wudu/.test(lower)) return "on-topic lesson question";
    if(/don't understand|dont understand|confused|what does|what is|why|how/.test(lower)) return "student needs explanation";
    if(/repeat|again|say it again|one more/.test(lower)) return "student needs a repeat";
    if(modeRef.current==="RECITATION") return "recitation or pronunciation attempt";
    return "student answer or comment";
  },[]);

  const classroomMessage=useCallback((rawText,{visionAlert=false,homeworkScan=false}={})=>{
    const state=lessonStateRef.current;
    const intent=visionAlert ? "camera/attention event" : homeworkScan ? "homework scan" : classifyStudentText(rawText);
    return [
      `[REAL CLASSROOM BRIEF]`,
      `Class roster: ${rosterText || `${student.name}${student.age ? `, age ${student.age}` : ""}`}.`,
      `Active speaker: ${activeStudent?.name || student.name}. If unsure who spoke, ask the child to say their name before answering.`,
      `Per-student memory: ${JSON.stringify(studentMemoryRef.current||{})}.`,
      `Mode: ${modeRef.current}. Topic: ${state.topic}. Lesson step: ${state.step}. Phase: ${state.phase}. Turn: ${state.turn}.`,
      `Student state: energy=${state.energy}; attention=${state.attention}; participation=${state.participation}.`,
      `Recent mistake/confusion: ${state.recentMistake || "none noted"}.`,
      `Last teacher move: ${state.lastTeacherMove}.`,
      `Last teacher point: ${state.lastTeacherPoint || "none yet"}.`,
      `Last student input: ${state.lastStudentInput || "none yet"}.`,
      `[EVENT TYPE: ${intent}]`,
      `[TEACHER ACTION: Act like the live teacher in charge. First respond to this exact event. Then do one teacher move only: explain, model, correct, praise, redirect, ask, or advance. In a group, address the active speaker by name when known and rotate callouts across the roster. Do not call every child by the same name. If you are unsure who spoke, ask who is speaking. If this is an interruption, pause and answer it. If the child asks an on-topic lesson question, answer it directly before continuing. If the child asks the current lesson, name the topic and continue from the last_teacher_point. If it is silence, re-engage the class with one simple prompt and call on one student by name. If it is distraction, redirect. Continue from the last_teacher_point. Do not restart. Do not repeat the same item unless the child asked to repeat.]`,
      rawText || "",
    ].join("\n");
  },[activeStudent,classifyStudentText,rosterText,student]);

  const updateTeacherMemory=useCallback((intent, rawText, reply, speaker=activeStudent)=>{
    const current=lessonStateRef.current;
    const lower=`${rawText} ${reply}`.toLowerCase();
    const needsHelp=/confused|don't understand|dont understand|wrong|mistake|again|repeat|try/.test(lower);
    const answered=/ahsant|mashallah|correct|good|excellent|yes/.test(lower);
    const shouldAdvance=/next|move forward|now we go|after this/.test(lower)||answered;
    lessonStateRef.current={
      ...current,
      turn: current.turn+1,
      step: shouldAdvance ? current.step+1 : current.step,
      phase: intent==="student silence" ? "re-engaging" : intent.includes("question") ? "answering question" : modeRef.current==="RECITATION" ? "recitation coaching" : shouldAdvance ? "advancing" : "guided practice",
      energy: intent==="student silence" ? "quiet" : "engaged",
      attention: intent==="camera/attention event" ? "needs redirect" : "present",
      participation: intent.includes("question") ? "asking questions" : needsHelp ? "needs support" : answered ? "responding well" : "participating",
      recentMistake: needsHelp ? rawText.slice(0,120) : current.recentMistake,
      lastTeacherMove: intent==="student silence" ? "re-engaged after silence" : shouldAdvance ? "advanced one step" : needsHelp ? "corrected or explained" : "continued guided teaching",
      lastTeacherPoint: reply.slice(0,220),
      lastStudentInput: rawText.slice(0,160),
    };
    if(speaker?.id){
      const prior=studentMemoryRef.current?.[speaker.id]||{name:speaker.name,step:1};
      studentMemoryRef.current={...(studentMemoryRef.current||{}),[speaker.id]:{
        ...prior,
        name:speaker.name,
        step: shouldAdvance ? (prior.step||1)+1 : (prior.step||1),
        participation: intent.includes("question") ? "asking questions" : needsHelp ? "needs support" : answered ? "responding well" : "participating",
        recentMistake: needsHelp ? rawText.slice(0,120) : (prior.recentMistake||""),
        lastInput: rawText.slice(0,160),
      }};
    }
  },[activeStudent]);

  const buildContinuationSummary=useCallback(()=>{
    const state=lessonStateRef.current;
    return [
      `Topic: ${state.topic}.`,
      `Stopped at phase ${state.phase}, step ${state.step}.`,
      `Last teacher point: ${state.lastTeacherPoint || "not recorded"}.`,
      `Last student input: ${state.lastStudentInput || "not recorded"}.`,
      `Recent mistake/confusion: ${state.recentMistake || "none noted"}.`,
      `Next class: continue from the last teacher point; do not restart from the beginning.`,
      `Per-student memory: ${JSON.stringify(studentMemoryRef.current||{})}.`,
    ].join("\n").slice(0,1800);
  },[]);

  const stopClassroom=useCallback(()=>{
    activeClassRef.current=false;classEpochRef.current++;chatEpochRef.current++;
    monitorEpochRef.current++;
    clearInterval(visionRef.current);
    clearInterval(handRef.current);
    clearTimeout(sendTimerRef.current);
    clearTimeout(silenceTimerRef.current);
    cancelVoice();stopListening();
    try{recRef.current?.abort();}catch(e){}
    try{interruptRecRef.current?.abort();}catch(e){}
    try{if(mediaRecRef.current?.state==="recording") mediaRecRef.current.stop();}catch(e){}
    listeningRef.current=false;
    speakingRef.current=false;
    thinkingRef.current=false;
    camStreamRef.current?.getTracks().forEach(t=>t.stop());
    micStreamRef.current?.getTracks().forEach(t=>t.stop());
    onBack();
  },[onBack,cancelVoice,stopListening]);

  const resetSilenceTimer=useCallback(()=>{
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current=setTimeout(()=>{
      if(!activeClassRef.current||busy()||!micStreamRef.current?.active) return;
      askAI({text:"[SILENCE: The child has not answered for 45 seconds. Re-engage them gently, remind them of the current lesson point, and ask one simple question. Do not restart the lesson.]"});
    },45000);
  },[micGranted,busy]);

  // ── Camera ──────────────────────────────────────────────
  const startCamera=useCallback(async(facing="user")=>{
    const epoch=classEpochRef.current;
    const cameraEpoch=++cameraEpochRef.current;
    setCameraReady(false);setCameraError("");
    try{
      if(camStreamRef.current) camStreamRef.current.getTracks().forEach(t=>t.stop());
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:480},height:{ideal:360}},audio:false});
      if(!activeClassRef.current||epoch!==classEpochRef.current||cameraEpoch!==cameraEpochRef.current){s.getTracks().forEach(t=>t.stop());return;}
      camStreamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play();setCameraReady(true);setHandStatus("Checking for raised hands…");}
    }catch(e){if(activeClassRef.current&&epoch===classEpochRef.current&&cameraEpoch===cameraEpochRef.current){setCameraError("Camera unavailable. Allow camera access in your browser, then retry.");setHandStatus("Camera unavailable");}}
  },[]);

  const captureFrame=useCallback(()=>{
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c||v.videoWidth===0) return null;
    c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    return c.toDataURL("image/jpeg",0.45).split(",")[1];
  },[]);

  const saveT=useCallback((speaker,message)=>{
    if(!lessonIdRef.current) return;
    const studentId=speaker==="student" ? (activeStudentIdRef.current||student.id) : student.id;
    api("POST","/noor/transcript/add",{lesson_id:lessonIdRef.current,student_id:studentId,session_id:sessionIdRef.current,speaker,message,mode:modeRef.current}).catch(()=>{});
  },[student]);

  const blobToBase64=useCallback(blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onloadend=()=>resolve(String(reader.result).split(",")[1]||"");
    reader.onerror=reject;
    reader.readAsDataURL(blob);
  }),[]);

  // ── TTS ─────────────────────────────────────────────────
  const speak=useCallback((text,onDone,options={})=>{
    if(!activeClassRef.current||pausedRef.current) return;
    clearTimeout(silenceTimerRef.current);
    stopListening();cancelVoice();
    if(!options.preview) lastNarrationRef.current=text;
    // Narrate English explanations; displayed Arabic is not synthetic Quran recitation.
    const noArabic=text
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g," ")
      .replace(/[*_#~`]/g,"")
      .replace(/\s+/g," ")
      .trim();
    if(!noArabic){onDone?.();return;}
    if(!options.preview&&!options.replay) saveT("teacher",text);
    if(!options.preview){
      const board=parseBlackboard(text);
      if(board) setBlackboard(board);
      const letter=detectLetter(text);
      if(letter) setMouthLetter(letter); else if(!board) setMouthLetter(null);
      const writing=detectWritingPrompt(text,letter);
      if(writing) setWritingPrompt(writing);
    }

    const stopInterruptWatch=()=>{try{interruptRecRef.current?.abort();}catch(e){} interruptRecRef.current=null;};
    const startInterruptWatch=()=>{
      stopInterruptWatch();
      if(!micStreamRef.current?.active) return;
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR) return;
      const rec=new SR();
      interruptRecRef.current=rec;
      rec.lang="en-US";
      rec.continuous=true;
      rec.interimResults=true;
      rec.onresult=e=>{
        if(!activeClassRef.current||pausedRef.current||interruptRecRef.current!==rec||!speakingRef.current) return;
        let heard="";
        for(let i=e.resultIndex;i<e.results.length;i++) heard+=" "+e.results[i][0].transcript;
        const lower=heard.toLowerCase();
        if(/excuse me|i have a question|can i ask|wait|hold on/.test(lower)){
          const now=Date.now();
          if(now-lastInterruptAtRef.current<5000) return;
          lastInterruptAtRef.current=now;
          stopInterruptWatch();
          cancelVoice();
          setCaption(heard.trim());
          setBubble("Yes, ya waladi, I am listening.");
          setIsSpeaking(false);speakingRef.current=false;setFaceState("watching");
          setWaitingForHand(false);
          startListening();
        }
      };
      rec.onerror=()=>{};
      rec.onend=()=>{if(interruptRecRef.current===rec) interruptRecRef.current=null;};
      try{rec.start();}catch(e){}
    };
    if(!teacherVoiceRef.current){
      teacherVoiceRef.current=createTeacherVoice({onState:state=>{
        if(!activeClassRef.current) return;
        voiceBusyRef.current=["loading","playing","blocked"].includes(state.status);
        const playing=state.status==="playing";
        speakingRef.current=playing;setIsSpeaking(playing);setVoiceStatus(state);
        setFaceState(playing?"speaking":state.status==="loading"?"thinking":"watching");
        if(playing) startInterruptWatch();else stopInterruptWatch();
      }});
    }
    teacherVoiceRef.current.speak(noArabic,{voice:narrationVoiceRef.current,deviceVoiceURI:voiceChoiceRef.current,onDone:()=>{
      if(!activeClassRef.current||pausedRef.current) return;
      onDone?.();if(micStreamRef.current?.active) resetSilenceTimer();
    }});
  },[saveT,resetSilenceTimer,stopListening,cancelVoice]);

  // ── AI ───────────────────────────────────────────────────
  const askAI=useCallback(async({text,imageB64,visionAlert,homeworkScan})=>{
    if(!activeClassRef.current||pausedRef.current) return;
    const rawText=text||"";
    const intent=classifyStudentText(rawText);
    if(intent==="navigation command"){stopClassroom();return;}
    const speaker=inferStudentFromText(rawText);
    if(speaker?.id) setActiveStudentId(speaker.id);
    clearTimeout(silenceTimerRef.current);
    const canInterruptSpeaking=voiceBusyRef.current&&/interruption|question|explanation|repeat/.test(intent);
    if(thinkingRef.current||(!canInterruptSpeaking&&busy()&&!visionAlert)) return;
    if(canInterruptSpeaking){
      cancelVoice();
      setIsSpeaking(false);speakingRef.current=false;
    }
    setIsThinking(true);thinkingRef.current=true;setFaceState("thinking");
    let msg=rawText;
    if(visionAlert) msg=`[VISION: ${visionAlert}]`;
    if(homeworkScan) msg="[HOMEWORK SCAN] Read and grade this homework carefully.";
    msg=classroomMessage(msg,{visionAlert,homeworkScan});
    const chatEpoch=++chatEpochRef.current;
    try{
      const data=await api("POST","/noor/chat",{
        student_id:student.id,lesson_id:lessonIdRef.current,
        message:msg,image_b64:imageB64||null,
        mode:modeRef.current,history:historyRef.current.slice(-14),
      });
      if(!activeClassRef.current||pausedRef.current||chatEpoch!==chatEpochRef.current) return;
      const reply=data.reply;
      historyRef.current=[...historyRef.current,{role:"user",content:msg},{role:"assistant",content:reply}].slice(-18);
      updateTeacherMemory(intent,rawText,reply,speaker);
      setIsThinking(false);thinkingRef.current=false;setBubble(reply);
      speak(reply,()=>{
        setWaitingForHand(true);
        startHandWatch();
      });
    }catch(e){
      if(!activeClassRef.current||pausedRef.current||chatEpoch!==chatEpochRef.current) return;
      setIsThinking(false);thinkingRef.current=false;setFaceState("watching");
      if(!visionAlert) speak("Ya waladi, let me try again.",()=>{setWaitingForHand(true);startHandWatch();});
    }
  },[student,speak,busy,classifyStudentText,classroomMessage,stopClassroom,updateTeacherMemory,inferStudentFromText,cancelVoice]);

  // ── SPEECH RECOGNITION — continuous=true, supports Arabic & English ────────────────
  const startListening=useCallback(()=>{
    if(!activeClassRef.current||busy()||!micStreamRef.current?.active||listeningRef.current) return;
    const listenEpoch=++listenEpochRef.current;
    const isCurrent=()=>activeClassRef.current&&!pausedRef.current&&listenEpoch===listenEpochRef.current;
    if(backendSttRef.current&&window.MediaRecorder&&micStreamRef.current){
      if(speakingRef.current||thinkingRef.current) return;
      const chunks=[];
      const mime=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
      let chunkRecorder;
      try{chunkRecorder=new MediaRecorder(micStreamRef.current,{mimeType:mime});}catch(e){chunkRecorder=null;}
      if(chunkRecorder){
        mediaRecRef.current=chunkRecorder;
        listeningRef.current=true;setIsListening(true);setFaceState("listening");setMicError("");
        chunkRecorder.ondataavailable=e=>{if(e.data?.size) chunks.push(e.data);};
        chunkRecorder.onstop=async()=>{
          if(!isCurrent()) return;
          listeningRef.current=false;setIsListening(false);
          if(!speakingRef.current&&!thinkingRef.current) setFaceState("watching");
          if(chunks.length&&chunks.reduce((n,b)=>n+b.size,0)>1200){
            try{
              const audio_b64=await blobToBase64(new Blob(chunks,{type:mime}));
              if(!isCurrent()) return;
              const data=await api("POST","/noor/speech-to-text",{audio_b64});
              if(!isCurrent()||busy()) return;
              const said=(data.transcript||"").trim();
              const tooSimilar=said&&said.toLowerCase()===lastTranscriptRef.current.toLowerCase();
              if(said.length>2&&!tooSimilar){
                lastTranscriptRef.current=said;
                clearTimeout(silenceTimerRef.current);
                setCaption(said);
                const speaker=inferStudentFromText(said);
                if(speaker?.id){activeStudentIdRef.current=speaker.id;setActiveStudentId(speaker.id);}
                saveT("student",said);
                setHandDetected(false);setWaitingForHand(false);
                const img=captureFrame();
                askAI({text:said,imageB64:img});
                return;
              }
            }catch(e){
              if(!isCurrent()) return;
              console.log("Audio transcription error:",e.message);
              if(String(e.message).includes("OPENAI_API_KEY")){
                backendSttRef.current=false;
                setMicError("Backend transcription is not configured. Using browser speech recognition for now.");
              } else {
                setMicError("I had trouble hearing that. Please try again.");
              }
            }
          }
          if(!busy()&&micStreamRef.current?.active) setTimeout(startListening,250);
        };
        try{
          chunkRecorder.start();
          setTimeout(()=>{try{if(chunkRecorder.state==="recording") chunkRecorder.stop();}catch(e){}},3200);
          return;
        }catch(e){
          listeningRef.current=false;setIsListening(false);
        }
      }
    }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setMicError("Speech recognition is not available in this browser. Please use Chrome or Edge.");return;}

    if(recRef.current){
      try{recRef.current.onend=null;recRef.current.onerror=null;recRef.current.onresult=null;recRef.current.abort();}catch(e){}
    }

    const rec=new SR();
    // Support both Arabic and English speech recognition
    rec.lang=modeRef.current==="RECITATION" ? "ar-SA" : "en-US";
    rec.continuous=true;
    rec.interimResults=true;
    rec.maxAlternatives=1;
    recRef.current=rec;
    finalBufferRef.current="";

    rec.onstart=()=>{if(!isCurrent()) return;listeningRef.current=true;setIsListening(true);setFaceState("listening");setMicError("");};

    rec.onresult=e=>{
      if(!isCurrent()||busy()) return;
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal){
          finalBufferRef.current+=" "+e.results[i][0].transcript;
          clearTimeout(sendTimerRef.current);
          sendTimerRef.current=setTimeout(()=>{
            if(!isCurrent()||busy()) return;
            const said=finalBufferRef.current.trim();
            finalBufferRef.current="";
            if(said.length>1){
              setCaption(said);
              const speaker=inferStudentFromText(said);
              if(speaker?.id){activeStudentIdRef.current=speaker.id;setActiveStudentId(speaker.id);}
              saveT("student",said);
              setHandDetected(false);setWaitingForHand(false);
              const img=captureFrame();
              askAI({text:said,imageB64:img});
            }
          },700);
        } else {
          if(!speakingRef.current) setCaption(e.results[i][0].transcript);
        }
      }
    };

    rec.onend=()=>{
      if(!isCurrent()) return;
      listeningRef.current=false;setIsListening(false);setCaption("");
      if(!speakingRef.current&&!thinkingRef.current) setFaceState("watching");
      // Always restart unless teacher speaking or thinking
      if(!busy()&&micStreamRef.current?.active){
        setTimeout(startListening,300);
      }
    };

    rec.onerror=e=>{
      if(!isCurrent()) return;
      listeningRef.current=false;setIsListening(false);
      if(e.error==="not-allowed"){setMicError("Microphone blocked. Click 🔒 in address bar → Allow Microphone → Reload.");return;}
      if(e.error!=="no-speech"&&e.error!=="aborted") {
        console.log("Speech Recognition Error:",e.error);
        if(e.error==="network"||e.error==="service-not-allowed") setMicError("Speech recognition had trouble connecting. I will keep trying.");
      }
      if(!busy()&&micStreamRef.current?.active) setTimeout(startListening,500);
    };

    try{rec.start();}catch(e){listeningRef.current=false;setTimeout(startListening,1000);}
  },[micGranted,captureFrame,askAI,saveT,blobToBase64,inferStudentFromText,busy]);

  // Restart listening after teacher finishes speaking
  useEffect(()=>{
    if(!busy()&&micGranted&&!listeningRef.current){
      const timer=setTimeout(startListening,400);return()=>clearTimeout(timer);
    }
  },[isSpeaking,isThinking,micGranted,voiceStatus.status,classPaused]);

  // ── REQUEST MIC PERMISSION ───────────────────────────────
  const requestMic=useCallback(async()=>{
    const epoch=classEpochRef.current;
    const micEpoch=++micEpochRef.current;
    try{
      const s=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!activeClassRef.current||epoch!==classEpochRef.current||micEpoch!==micEpochRef.current){s.getTracks().forEach(t=>t.stop());return;}
      micStreamRef.current?.getTracks().forEach(t=>t.stop());
      micStreamRef.current=s;
      setMicGranted(true);
      setMicError("");
    }catch(e){
      if(activeClassRef.current&&epoch===classEpochRef.current&&micEpoch===micEpochRef.current) setMicError("Microphone denied. Please allow mic access in browser settings.");
    }
  },[]);

  // Start listening once mic granted
  useEffect(()=>{
    if(micGranted&&!listeningRef.current&&!speakingRef.current) startListening();
  },[micGranted]);

  // ── HAND RAISE — via backend with improved error handling ─────────────────────────────
  const acknowledgeHand=()=>{
    if(initializingRef.current||pausedRef.current||!activeClassRef.current) return;
    if(thinkingRef.current){pendingHandRef.current=true;setHandStatus("Your hand is raised. Noor will listen after finishing this response.");return;}
    lastHandRaiseRef.current=Date.now();
    setHandDetected(true);setWaitingForHand(false);
    speak("Yes, I am listening. Go ahead.",()=>{startListening();startHandWatch();});
  };
  useEffect(()=>{
    if(!isThinking && pendingHandRef.current){pendingHandRef.current=false;acknowledgeHand();}
  },[isThinking]);
  const startHandWatch=useCallback(()=>{
    clearInterval(handRef.current);
    let busy=false;
    let failCount=0;
    const epoch=monitorEpochRef.current;
    handRef.current=setInterval(async()=>{
      if(busy||initializingRef.current||pausedRef.current||!activeClassRef.current) return;
      busy=true;
      const img=captureFrame();
      if(!img){busy=false;return;}
      try{
        const data=await api("POST","/noor/hand-raise",{
          student_id:student.id,
          lesson_id:lessonIdRef.current,
          session_id:sessionIdRef.current,
          image_b64:img
        });
        if(epoch!==monitorEpochRef.current) return;
        failCount=0;setHandStatus(data.raised?"Raised hand detected":"Camera checked · No raised hand detected");
        if(data.raised && thinkingRef.current){pendingHandRef.current=true;setHandStatus("Raised hand detected · Noor will listen after this response");}
        if(data.raised && !thinkingRef.current){
          const now=Date.now();
          if(now-lastHandRaiseRef.current<9000){busy=false;return;}
          lastHandRaiseRef.current=now;
          clearInterval(handRef.current);
          setHandDetected(true);setWaitingForHand(false);
          try{recRef.current?.abort();}catch(e){}
          listeningRef.current=false;setIsListening(false);
          const callOn=isGroupClass?`Ahsant. Whoever raised the hand, say your name first, then ask.`:`Ahsant! Yes, ya waladi! Go ahead.`;
          setBubble(callOn+" 🎤");
          speak(callOn,()=>{setTimeout(startListening,200);startHandWatch();});
        }
      }catch(e){
        if(epoch!==monitorEpochRef.current) return;
        failCount++;setHandStatus("Hand detection unavailable. Use the raise-hand button below.");
        console.log("Hand detection error:",e.message,"(attempt",failCount+")");
        // If backend is down, show user feedback
        if(failCount>3) {
          console.warn("Backend hand-raise endpoint not responding. Ensure backend is running.");
        }
      }
      busy=false;
    },1800);
  },[captureFrame,speak,startListening,student,isGroupClass]);

  // ── VISION / EMOTION LOOP — via backend with improved error handling ─────────────────
  const startVision=useCallback(()=>{
    clearInterval(visionRef.current);
    let busy=false;
    let failCount=0;
    const epoch=monitorEpochRef.current;
    visionRef.current=setInterval(async()=>{
      if(initializingRef.current||thinkingRef.current||voiceBusyRef.current||pausedRef.current||!activeClassRef.current||busy) return;
      busy=true;
      const img=captureFrame();
      if(!img){busy=false;return;}
      try{
        const data=await api("POST","/noor/vision",{
          student_id:student.id,
          lesson_id:lessonIdRef.current,
          session_id:sessionIdRef.current,
          image_b64:img,
          mode:modeRef.current,
        });
        if(epoch!==monitorEpochRef.current) return;
        failCount=0;setVisionStatus(data.event_type ? `Camera cue: ${data.event_type}. This is an estimate, not a confirmed emotion.` : "Camera checked · No new observation");
        if(data.event_type==="cheating"){
          setCheatingCount(p=>p+1);
          setAlertMsg("Camera cue detected. Do you need help?");
          setTimeout(()=>setAlertMsg(""),3000);
        } else if(data.event_type==="distracted"){
          setAlertMsg("Would you like a break or another explanation?");
          setTimeout(()=>setAlertMsg(""),3000);
        }
        if(data.teacher_response){
          const now=Date.now();
          if(voiceBusyRef.current||thinkingRef.current||initializingRef.current){busy=false;return;}
          if(now-lastAttentionRef.current<12000){busy=false;return;}
          lastAttentionRef.current=now;
          setBubble(data.teacher_response);
          speak(data.teacher_response,()=>{setWaitingForHand(true);startHandWatch();});
        }
      }catch(e){
        if(epoch!==monitorEpochRef.current) return;
        failCount++;setVisionStatus("Camera observations unavailable. Tell Noor how you are feeling below.");
        if(failCount>5) {
          console.warn("Vision endpoint not responding. Backend may be down.");
        }
      }
      busy=false;
    },8000);
  },[captureFrame,askAI,speak,startHandWatch,student]);

  // ── INIT ────────────────────────────────────────────────
  useEffect(()=>{
    activeClassRef.current=true;
    initializingRef.current=true;setInitializing(true);
    const epoch=++classEpochRef.current;
    const isCurrent=()=>activeClassRef.current&&epoch===classEpochRef.current;
    let lid=null,sid=null;
    const init=async()=>{
      // Permission prompts must not block the lesson opening.
      void startCamera("user");
      void requestMic();
      startHandWatch();startVision();
      try{
        const ls=await api("POST","/noor/lesson/start",{student_id:student.id});
        if(!isCurrent()) return;
        lid=ls.lesson_id;setLessonId(lid);
        const sess=await api("POST","/noor/session/start",{lesson_id:lid,student_id:student.id});
        if(!isCurrent()) return;
        sid=sess.id;setSessionId(sid);
      }catch(e){}
      if(!isCurrent()) return;
      try{
        const profiles=await Promise.all(classRoster.map(s=>api("GET",`/noor/student/${s.id}`).catch(()=>null)));
        if(!isCurrent()) return;
        const memories=profiles.map((p,i)=>{
          const child=classRoster[i];
          const recent=(p?.recent_lessons||[]).find(l=>l.summary||l.notes);
          if(!recent) return `${child.name}: no prior lesson memory yet.`;
          const when=recent.started_at?new Date(recent.started_at).toLocaleDateString():"last class";
          return `${child.name} (${when}): ${recent.summary||recent.notes}`;
        });
        continuationMemoryRef.current=memories.join("\n").slice(0,1800);
      }catch(e){
        continuationMemoryRef.current="";
      }
      if(!isCurrent()||pausedRef.current) return;

      // Build opening message — pass parent topic explicitly
      // Enhance scholar/sheikh behavior: authoritative, knowledgeable, patient teacher
      const classLine=isGroupClass?`class roster=${rosterText}; this is a group class, rotate questions by name and never call every student by one name`:`student=${student.name}, level=${student.level}`;
      const memoryLine=continuationMemoryRef.current?`[CONTINUATION MEMORY FROM LAST CLASS]\n${continuationMemoryRef.current}\nContinue from this memory unless the parent gave a new topic. Do not restart from the beginning.`:"";
      const topicLine=parentNotes
        ?`${memoryLine}\n[PARENT TOPIC: ${parentNotes}] [REAL CLASSROOM OPENING: ${classLine}] Begin like a present teacher: greet warmly, name today's learning goal in one sentence, give a vivid 1-sentence hook, teach only the first tiny step, then ask one named student to do one small action. Do not cover the whole lesson.`
        :`${memoryLine}\n[REAL CLASSROOM OPENING: ${classLine}] Use the continuation memory if present; otherwise choose a suitable Islamic topic. Begin like a present teacher: greet warmly, name today's learning goal in one sentence, give a vivid 1-sentence hook, teach only the first tiny step, then ask one named student to do one small action. Do not cover the whole lesson.`;

      setIsThinking(true);thinkingRef.current=true;setFaceState("thinking");
      const openingEpoch=++chatEpochRef.current;
      try{
        const data=await api("POST","/noor/chat",{student_id:student.id,lesson_id:lid,message:topicLine,mode:"TEACHING",history:[]});
        if(!isCurrent()||pausedRef.current||openingEpoch!==chatEpochRef.current) return;
        const reply=data.reply;
        historyRef.current=[{role:"user",content:"[CLASS STARTING]"},{role:"assistant",content:reply}];
        lessonStateRef.current={...lessonStateRef.current,phase:"guided practice",lastTeacherMove:"opened lesson with first task",lastTeacherPoint:reply.slice(0,220)};
        setIsThinking(false);thinkingRef.current=false;setBubble(reply);
        initializingRef.current=false;setInitializing(false);
        speak(reply,()=>{setWaitingForHand(true);startHandWatch();startVision();startListening();});
      }catch(e){
        if(!isCurrent()||pausedRef.current||openingEpoch!==chatEpochRef.current) return;
        setIsThinking(false);thinkingRef.current=false;
        // Fallback message with scholar/sheikh tone
        const fb=isGroupClass
          ?`Bismillah. Assalamu Alaikum wa Rahmatullahi wa Barakatuhu, my students. I am Sheikh Noor, your Islamic teacher. I will call each of you by name, one at a time. Raise your hand when you have a question, and say your name first.`
          :`Bismillah. Assalamu Alaikum wa Rahmatullahi wa Barakatuhu, ${student.name}! I am Sheikh Noor, your Islamic teacher. Today we embark on a journey of knowledge and wisdom. Listen carefully, ya waladi. Raise your hand when you have a question or are ready to answer. May Allah bless your learning!`;
        initializingRef.current=false;setInitializing(false);
        setBubble(fb);speak(fb,()=>{setWaitingForHand(true);startHandWatch();startVision();startListening();});
      }
    };
    init();
    return()=>{
      activeClassRef.current=false;classEpochRef.current++;chatEpochRef.current++;
      monitorEpochRef.current++;
      clearInterval(visionRef.current);clearInterval(handRef.current);clearTimeout(sendTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      cancelVoice();stopListening();teacherVoiceRef.current?.dispose();teacherVoiceRef.current=null;
      try{recRef.current?.abort();}catch(e){}
      try{interruptRecRef.current?.abort();}catch(e){}
      try{if(mediaRecRef.current?.state==="recording") mediaRecRef.current.stop();}catch(e){}
      camStreamRef.current?.getTracks().forEach(t=>t.stop());
      micStreamRef.current?.getTracks().forEach(t=>t.stop());
      if(lid||lessonIdRef.current){
        const lId=lid||lessonIdRef.current,sId=sid||sessionIdRef.current;
        if(sId) api("POST","/noor/session/end",{session_id:sId,lesson_id:lId,student_id:student.id,cheating_attempts:cheatingRef.current}).catch(()=>{});
        api("POST","/noor/lesson/end",{lesson_id:lId,student_id:student.id,topics_covered:[modeRef.current],summary:buildContinuationSummary()}).catch(()=>{});
      }
    };
  },[]);

  // ── Keepalive — ping backend every 4 min to prevent sleep
  useEffect(()=>{
    const t=setInterval(()=>api("GET","/noor/ping").catch(()=>{}),240000);
    return()=>clearInterval(t);
  },[]);

  const doHomework=async()=>{
    if(initializingRef.current||pausedRef.current||!activeClassRef.current) return;
    const epoch=classEpochRef.current,monitorEpoch=monitorEpochRef.current;
    const isCurrent=()=>activeClassRef.current&&!pausedRef.current&&epoch===classEpochRef.current&&monitorEpoch===monitorEpochRef.current;
    clearInterval(handRef.current);setWaitingForHand(false);setMode("HOMEWORK");
    speak(isGroupClass?`${activeStudent?.name||"My student"}, hold your homework up to the camera now.`:"Ya waladi, hold your homework up to the camera now.",async()=>{
      await startCamera("environment");
      if(!isCurrent()) return;
      setTimeout(async()=>{
        if(!isCurrent()) return;
        const img=captureFrame();await startCamera("user");
        if(!isCurrent()) return;
        if(img) askAI({homeworkScan:true,imageB64:img});
        else speak("I could not see it, ya waladi. Try again.",()=>{setWaitingForHand(true);startHandWatch();});
      },2000);
    });
  };

  const pauseForVideo=()=>{
    pausedRef.current=true;setClassPaused(true);chatEpochRef.current++;
    monitorEpochRef.current++;clearInterval(handRef.current);clearInterval(visionRef.current);
    clearTimeout(silenceTimerRef.current);pendingHandRef.current=false;
    cancelVoice();stopListening();thinkingRef.current=false;setIsThinking(false);setFaceState("watching");
  };
  const resumeAfterVideo=()=>{
    if(!activeClassRef.current) return;
    pausedRef.current=false;setClassPaused(false);startHandWatch();startVision();
    if(lastNarrationRef.current) speak(lastNarrationRef.current,()=>{setWaitingForHand(true);startListening();}, {replay:true});
    else {startListening();resetSilenceTimer();}
  };

  return(
    <div style={{background:"linear-gradient(180deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",maxWidth:860,margin:"0 auto",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",boxSizing:"border-box",background:"rgba(0,0,0,0.3)"}}>
        <button type="button" onClick={stopClassroom} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#8dc49a",fontSize:13,cursor:"pointer",padding:"7px 10px",position:"relative",zIndex:5}}>← End</button>
        <div style={{fontWeight:"bold",color:"#f0c060",fontSize:14}}>{isGroupClass?`${classRoster.length} students`:student.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:isListening?"#4ade80":isSpeaking?"#f0c060":isThinking?"#a78bfa":"#6aaa80",display:"inline-block",boxShadow:isListening?"0 0 6px #4ade80":"none"}}/>
          <span style={{fontSize:11,color:isListening?"#4ade80":isSpeaking?"#f0c060":isThinking?"#a78bfa":"#6aaa80"}}>
            {classPaused?"Paused":initializing?"Starting lesson":voiceStatus.status==="loading"?"Preparing voice":voiceStatus.status==="blocked"?"Tap to hear":isListening?"Listening":isSpeaking?"Speaking":isThinking?"Thinking":"Watching"}
          </span>
        </div>
      </div>

      {alertMsg&&<div style={{width:"100%",background:"#922b21",textAlign:"center",padding:"7px",fontSize:13,fontWeight:"bold"}}>{alertMsg}</div>}
      {micError&&<div style={{width:"100%",background:"#7d3c00",textAlign:"center",padding:"7px",fontSize:12}}>{micError}</div>}
      {isGroupClass&&(
        <div style={{width:"100%",display:"flex",gap:6,padding:"7px 14px 0",boxSizing:"border-box",overflowX:"auto"}}>
          {classRoster.map(s=>(
            <button key={s.id} onClick={()=>setActiveStudentId(s.id)} style={{flex:"0 0 auto",background:activeStudentId===s.id?"#1a7a40":"rgba(255,255,255,0.08)",border:`1px solid ${activeStudentId===s.id?"#4ade80":"rgba(255,255,255,0.15)"}`,borderRadius:999,color:"white",padding:"6px 10px",fontSize:12,fontWeight:activeStudentId===s.id?"bold":"normal",cursor:"pointer"}}>
              {activeStudentId===s.id?"Listening to ":""}{s.name}
            </button>
          ))}
        </div>
      )}

      {/* Mic unlock — only shows if not granted */}
      {!micGranted&&(
        <button onClick={requestMic} style={{margin:"8px 14px 0",width:"calc(100% - 28px)",background:"#c0392b",border:"none",borderRadius:14,color:"white",padding:"14px",fontSize:16,fontWeight:"bold",cursor:"pointer",animation:"pulse 1.5s infinite"}}>
          🎤 Tap to activate microphone
        </button>
      )}

      {/* Face + Camera */}
      <div style={{display:"flex",gap:10,padding:"8px 14px 0",width:"100%",boxSizing:"border-box",alignItems:"center"}}>

        <div style={{flex:1,height:160,borderRadius:14,overflow:"hidden",border:`2px solid ${handDetected?"#f0c040":"rgba(255,255,255,0.15)"}`,background:"#000",position:"relative",transition:"border-color 0.3s"}}>
          <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}}/>
          <div style={{position:"absolute",top:4,left:4,background:"rgba(14,77,42,0.85)",borderRadius:7,padding:"2px 7px",fontSize:10,display:"flex",alignItems:"center",gap:3}}>
            <span style={{color:cameraReady?"#4ade80":"#f0c060"}}>●</span>{cameraReady?"Camera on":"Camera off"}
          </div>
          {waitingForHand&&<div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",background:"rgba(240,192,64,0.92)",borderRadius:7,padding:"2px 8px",fontSize:10,color:"#000",fontWeight:"bold",whiteSpace:"nowrap"}}>🖐 Raise hand to answer</div>}
        </div>
      </div>
      <canvas ref={canvasRef} style={{display:"none"}}/>

      <TeacherStage letter={mouthLetter} board={blackboard} speaking={isSpeaking}/>
      <div className="classroom-controls">
        <label htmlFor="teacher-voice">Teacher voice</label>
        <select id="teacher-voice" value={narrationVoice} onChange={e=>{cancelVoice();setNarrationVoice(e.target.value);}}>
          <option value="teacher">Brian · Warm teacher</option>
          <option value="storyteller">George · Storyteller</option>
          <option value="device">Device voice</option>
        </select>
        {narrationVoice==="device"&&<><label htmlFor="device-voice">Device voice</label><select id="device-voice" value={voiceChoice} onChange={e=>setVoiceChoice(e.target.value)}><option value="">Recommended device voice</option>{availableVoices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></>}
        <div className="voice-actions">
          <button disabled={classPaused||isThinking||initializing} onClick={()=>speak("Welcome to our classroom. Take your time. We will learn together, one small step at a time.",undefined,{preview:true})}>Preview voice</button>
          <button disabled={classPaused||isThinking||!lastNarrationRef.current} onClick={()=>speak(lastNarrationRef.current,undefined,{replay:true})}>Replay teacher</button>
          <button onClick={cancelVoice}>Stop voice</button>
          {voiceStatus.status==="blocked"&&<button onClick={()=>teacherVoiceRef.current?.resume()}>Tap to hear teacher</button>}
        </div>
        <p className="camera-status" role="status">{voiceStatus.message||(voiceStatus.source==="device"?"Device voice":"AI-generated teacher narration · ElevenLabs")}</p>
        <div className="camera-status" role="status">{cameraError||handStatus}</div>
        {cameraError&&<button onClick={()=>startCamera("user")}>Retry camera</button>}
        <button disabled={classPaused||initializing} onClick={acknowledgeHand}>✋ I have a question</button>
        <button disabled={classPaused||initializing} onClick={()=>setWritingPrompt({letter:mouthLetter?.letter||"",label:mouthLetter?.label||"letter practice"})}>✎ Practice writing</button>
        <p className="camera-status">{visionStatus}</p>
        <div aria-label="Tell Noor how you feel">{["I need help","Please repeat","I need a break"].map(text=><button key={text} disabled={isThinking||classPaused||initializing} onClick={()=>askAI({text})}>{text}</button>)}</div>
      </div>

      <StoryVideos lessonText={`${parentNotes||""}\n${bubble}`} onPause={pauseForVideo} onResume={resumeAfterVideo} disabled={initializing}/>

      {writingPrompt&&(
        <WritingPad
          prompt={writingPrompt}
          onClose={()=>setWritingPrompt(null)}
          onSubmit={img=>{
            const label=writingPrompt.label||"the letter";
            setWritingPrompt(null);
            askAI({text:`[WRITING PRACTICE: ${activeStudent?.name||"The child"} wrote ${label} on the touchscreen. Look at the drawing. Praise what is correct, give one specific correction if needed, then continue the lesson without restarting.]`,imageB64:img});
          }}
        />
      )}

      {/* Bubble */}
      <div style={{margin:"6px 14px 0",width:"calc(100% - 28px)",boxSizing:"border-box",background:"rgba(255,255,255,0.96)",borderRadius:16,padding:"10px 14px",minHeight:60,maxHeight:120,overflowY:"auto"}}>
        <div style={{fontSize:14,color:"#0d2818",lineHeight:1.55,whiteSpace:"pre-wrap"}}>
          {isThinking?<span style={{color:"#1a7a40"}}>🤔 Thinking...</span>:bubble}
        </div>
      </div>

      {caption&&<div style={{margin:"3px 14px 0",width:"calc(100% - 28px)",boxSizing:"border-box",background:"rgba(0,0,0,0.5)",borderRadius:9,padding:"5px 12px",fontSize:12,color:"#d0f0dc",fontStyle:"italic"}}>{caption}</div>}

      {/* Mode buttons — parent controls only */}
      <div style={{display:"flex",gap:8,padding:"8px 14px 0",width:"100%",boxSizing:"border-box"}}>
        {[["TEACHING","📚 Lesson","#1a7a40"],["RECITATION","🕌 Recite","#7d3c98"]].map(([m,l,c])=>(
          <button key={m} disabled={classPaused} onClick={()=>{setMode(m);askAI({text:`[MODE: ${m}] Switch to ${m} mode now.`});}} style={{flex:1,background:mode===m?c:"rgba(255,255,255,0.1)",border:`2px solid ${mode===m?c:"rgba(255,255,255,0.15)"}`,borderRadius:12,color:"white",padding:"9px",fontSize:12,fontWeight:mode===m?"bold":"normal",cursor:"pointer"}}>{l}</button>
        ))}
        <button disabled={classPaused} onClick={doHomework} style={{flex:1,background:"rgba(169,50,38,0.7)",border:"2px solid rgba(169,50,38,0.5)",borderRadius:12,color:"white",padding:"9px",fontSize:12,cursor:"pointer"}}>📝 Homework</button>
      </div>

      <div style={{fontSize:10,color:"#3d7a55",padding:"6px 0 12px",textAlign:"center"}}>Raise your hand with your face and hand in view, or use “I have a question”.</div>
      <style>{`@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(192,57,43,0.5)}70%{box-shadow:0 0 0 14px rgba(192,57,43,0)}100%{box-shadow:0 0 0 0 rgba(192,57,43,0)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
function Dashboard({ students, onBack }) {
  const [sel,setSel]=useState(students[0]?.id||null);
  const [data,setData]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [transcript,setTranscript]=useState([]);
  const [view,setView]=useState("overview");
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!sel) return;setLoading(true);
    Promise.all([api("GET",`/noor/student/${sel}`),api("GET",`/noor/sessions/${sel}`)]).then(([d,s])=>{setData(d);setSessions(s);}).catch(()=>{}).finally(()=>setLoading(false));
  },[sel]);

  const loadT=async lid=>{setView("transcript");const t=await api("GET",`/noor/transcript/${lid}`).catch(()=>[]);setTranscript(t);};
  const saveNotes=async()=>{
    if(!notes.trim()||!sel) return;setSaving(true);
    try{await api("POST","/noor/parent-notes",{student_id:sel,notes:notes.trim(),focus_topics:[]});setNotes("");}catch(e){}setSaving(false);
  };
  const p=data?.progress,s=data?.student;

  return(
    <div style={{background:"linear-gradient(180deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",maxWidth:480,margin:"0 auto",paddingBottom:24}}>
      <div style={{width:"100%",display:"flex",alignItems:"center",padding:"12px 14px",boxSizing:"border-box",background:"rgba(0,0,0,0.3)"}}>
        <button onClick={view==="overview"?onBack:()=>setView("overview")} style={{background:"none",border:"none",color:"#8dc49a",fontSize:14,cursor:"pointer"}}>← {view==="overview"?"Back":"Overview"}</button>
        <div style={{flex:1,textAlign:"center",fontWeight:"bold",color:"#f0c060",fontSize:16}}>📊 Parent Dashboard</div>
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 14px",width:"100%",boxSizing:"border-box",overflowX:"auto"}}>
        {students.map(s=><button key={s.id} onClick={()=>{setSel(s.id);setView("overview");}} style={{background:sel===s.id?"#1a7a40":"rgba(255,255,255,0.1)",border:`2px solid ${sel===s.id?"#1a7a40":"rgba(255,255,255,0.15)"}`,borderRadius:20,padding:"6px 16px",color:"white",fontSize:13,fontWeight:sel===s.id?"bold":"normal",cursor:"pointer",whiteSpace:"nowrap"}}>{s.name}</button>)}
      </div>
      {loading&&<div style={{color:"#6aaa80",marginTop:20}}>Loading...</div>}
      {view==="transcript"&&(
        <div style={{padding:"0 14px",width:"100%",boxSizing:"border-box"}}>
          <div style={{fontSize:15,fontWeight:"bold",color:"#f0c060",marginBottom:12}}>📄 Lesson Transcript</div>
          {transcript.length===0?<div style={{color:"#6aaa80"}}>No transcript yet</div>:
            transcript.map((t,i)=>(
              <div key={i} style={{display:"flex",gap:10,marginBottom:10,flexDirection:t.speaker==="teacher"?"row":"row-reverse"}}>
                <div style={{fontSize:18,flexShrink:0}}>{t.speaker==="teacher"?"👨‍🏫":"🧒"}</div>
                <div style={{background:t.speaker==="teacher"?"rgba(26,122,64,0.3)":"rgba(255,255,255,0.1)",borderRadius:14,padding:"8px 12px",fontSize:13,lineHeight:1.5,maxWidth:"80%"}}>
                  <div style={{fontSize:10,color:"#6aaa80",marginBottom:3}}>{new Date(t.timestamp).toLocaleTimeString()}</div>
                  {t.message}
                </div>
              </div>
            ))}
        </div>
      )}
      {view==="overview"&&data&&!loading&&(
        <div style={{padding:"0 14px",width:"100%",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {[["📚",p?.total_lessons||0,"Lessons"],["⏱",p?.total_minutes||0,"Minutes"],["🕌",p?.surahs_memorized?.length||0,"Surahs"]].map(([icon,val,label])=>(
              <div key={label} style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 10px",textAlign:"center"}}>
                <div style={{fontSize:22}}>{icon}</div><div style={{fontSize:24,fontWeight:"bold",color:"#f0c060"}}>{val}</div><div style={{fontSize:11,color:"#8dc49a"}}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
            <div style={{fontSize:13,color:"#8dc49a",marginBottom:8}}>Arabic Level</div>
            <div style={{background:"rgba(255,255,255,0.1)",borderRadius:20,height:12,overflow:"hidden"}}>
              <div style={{background:"linear-gradient(90deg,#1a7a40,#4ade80)",height:"100%",width:`${p?.arabic_level||0}%`,borderRadius:20}}/>
            </div>
            <div style={{fontSize:12,color:"#f0c060",marginTop:6,textAlign:"right"}}>{p?.arabic_level||0}%</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
            <div style={{fontSize:14,fontWeight:"bold",color:"#f0c060",marginBottom:10}}>✏️ Notes for Next Class</div>
            <textarea aria-label="Notes for the teacher" value={notes} onChange={e=>setNotes(e.target.value)} placeholder={`Notes for Sheikh Noor about ${s?.name}'s next lesson...`} rows={3}
              style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:12,padding:"10px 12px",color:"white",fontSize:13,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
            <button onClick={saveNotes} disabled={saving||!notes.trim()} style={{marginTop:8,background:"#1a7a40",border:"none",borderRadius:10,color:"white",padding:"8px 20px",fontSize:13,fontWeight:"bold",cursor:"pointer",opacity:notes.trim()?1:0.5}}>{saving?"Saving...":"Save"}</button>
          </div>
          {sessions.length>0&&(
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
              <div style={{fontSize:14,fontWeight:"bold",color:"#f0c060",marginBottom:10}}>📹 Sessions</div>
              {sessions.slice(0,8).map(sess=>(
                <div key={sess.id} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:"#8dc49a"}}>{new Date(sess.started_at).toLocaleDateString()} {new Date(sess.started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                    <span style={{fontSize:12,color:"#f0c060"}}>{Math.round((sess.duration_seconds||0)/60)} min</span>
                  </div>
                  {sess.transcript_summary&&<div style={{fontSize:12,color:"#d0f0dc",lineHeight:1.4,marginBottom:6}}>{sess.transcript_summary}</div>}
                  <div style={{display:"flex",gap:8,fontSize:11,color:"#6aaa80",marginBottom:6}}>
                    <span>🖐 {sess.hand_raises||0} raises</span><span>⚠️ {sess.cheating_attempts||0} alerts</span>
                  </div>
                  <button onClick={()=>loadT(sess.lesson_id)} style={{background:"rgba(26,122,64,0.4)",border:"1px solid rgba(26,122,64,0.6)",borderRadius:8,color:"white",padding:"4px 12px",fontSize:12,cursor:"pointer"}}>📄 Transcript</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════
export default function App() {
  const [screen,setScreen]=useState("select");
  const [classStudents,setClassStudents]=useState([]);
  const [parentNotes,setParentNotes]=useState(null);
  const [students,setStudents]=useState([]);
  useEffect(()=>{api("GET","/noor/students").then(setStudents).catch(()=>{});},[screen]);
  if(screen==="briefing"&&classStudents.length) return <ParentBriefing students={classStudents} onBack={()=>setScreen("select")} onStart={n=>{setParentNotes(n);setScreen("class");}}/>;
  if(screen==="class"&&classStudents.length) return <Classroom students={classStudents} parentNotes={parentNotes} onBack={()=>setScreen("select")}/>;
  if(screen==="dashboard") return <Dashboard students={students} onBack={()=>setScreen("select")}/>;
  return <StudentSelect onSelect={picked=>{setClassStudents(Array.isArray(picked)?picked:[picked]);setScreen("briefing");}} onDashboard={()=>setScreen("dashboard")}/>;
}
