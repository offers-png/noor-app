import { useState, useRef, useEffect, useCallback } from "react";

const API = "https://main-backend-k32m.onrender.com";
const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// ── Blackboard ────────────────────────────────────────────
function Blackboard({ content }) {
  // content: { type: 'arabic'|'text'|'ayah', lines: [{text, transliteration, translation}] }
  if (!content) return null;
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a3a1a, #0d2b0d)",
      border: "8px solid #5a3a1a",
      borderRadius: 12,
      padding: "16px 20px",
      margin: "8px 14px 0",
      width: "calc(100% - 28px)",
      boxSizing: "border-box",
      boxShadow: "inset 0 2px 12px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.4)",
      minHeight: 100,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Chalk dust effect */}
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.03) 0%, transparent 60%)", pointerEvents:"none" }}/>

      {/* Title */}
      {content.title && (
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:10, textAlign:"center", letterSpacing:2, textTransform:"uppercase" }}>
          ✦ {content.title} ✦
        </div>
      )}

      {content.lines?.map((line, i) => (
        <div key={i} style={{ marginBottom: i < content.lines.length-1 ? 14 : 0, textAlign:"center" }}>
          {/* Arabic text */}
          {line.arabic && (
            <div style={{
              fontSize: content.type === "arabic_letter" ? 64 : 28,
              color: "#f0e68c",
              fontFamily: "serif",
              direction: "rtl",
              lineHeight: 1.4,
              textShadow: "0 0 20px rgba(240,230,140,0.4)",
              animation: `chalkIn 0.6s ease-out ${i*0.3}s both`,
            }}>{line.arabic}</div>
          )}
          {/* Transliteration */}
          {line.transliteration && (
            <div style={{
              fontSize: 15,
              color: "#a8d8a8",
              fontStyle: "italic",
              marginTop: 4,
              animation: `chalkIn 0.6s ease-out ${i*0.3+0.2}s both`,
            }}>{line.transliteration}</div>
          )}
          {/* Translation */}
          {line.translation && (
            <div style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              marginTop: 2,
              animation: `chalkIn 0.6s ease-out ${i*0.3+0.4}s both`,
            }}>{line.translation}</div>
          )}
          {/* Plain text */}
          {line.text && !line.arabic && (
            <div style={{
              fontSize: 16,
              color: "#e8e8e8",
              animation: `chalkIn 0.6s ease-out ${i*0.3}s both`,
            }}>{line.text}</div>
          )}
        </div>
      ))}
      <style>{`
        @keyframes chalkIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ── Face ──────────────────────────────────────────────────
function Face({ state, size = 110 }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (state === "thinking") return;
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 130); }, 2800 + Math.random() * 1500);
    return () => clearInterval(t);
  }, [state]);
  const eyeRy = blink ? 1.5 : 12, eyeY = 100;
  return (
    <svg viewBox="0 0 200 230" width={size} height={size} style={{ filter:"drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}>
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
      {state==="speaking"
        ?<><path d="M83 148 Q100 142 117 148" stroke="#b84c52" strokeWidth="2" fill="none"/>
           <ellipse cx="100" cy="154" rx="17" ry="9" fill="#7a1f25"/>
           <ellipse cx="100" cy="157" rx="12" ry="5.5" fill="#c05560"/></>
        :state==="thinking"
        ?<path d="M87 152 Q100 150 113 152" stroke="#b84c52" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
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
//  SCREEN 1 — Student Select
// ══════════════════════════════════════════════════════════
function StudentSelect({ onSelect, onDashboard }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""), [age, setAge] = useState(""), [saving, setSaving] = useState(false);
  const avatars = ["🧒","👦","👧","🧒‍♀️","👶","🧑"];
  useEffect(()=>{ api("GET","/noor/students").then(setStudents).catch(()=>setStudents([])).finally(()=>setLoading(false)); },[]);
  const addStudent = async () => {
    if (!name.trim()) return; setSaving(true);
    try { const s=await api("POST","/noor/students",{name:name.trim(),age:age?parseInt(age):null,level:"beginner"}); setStudents(p=>[...p,s]); setName(""); setAge(""); setAdding(false); } catch(e){}
    setSaving(false);
  };
  return (
    <div style={{background:"linear-gradient(160deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",padding:24,gap:20}}>
      <div style={{textAlign:"center",marginTop:20}}><Face state="idle" size={100}/><div style={{fontSize:26,fontWeight:"bold",color:"#f0c060",marginTop:8}}>✨ Ustadha Noor</div><div style={{fontSize:14,color:"#a8d8b0"}}>Who is learning today?</div></div>
      {loading?<div style={{color:"#6aaa80"}}>Loading...</div>:(
        <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:380}}>
          {students.map((s,i)=>(
            <button key={s.id} onClick={()=>onSelect(s)} style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:20,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",color:"white",textAlign:"left"}}>
              <span style={{fontSize:36}}>{avatars[i%avatars.length]}</span>
              <div><div style={{fontSize:20,fontWeight:"bold"}}>{s.name}</div><div style={{fontSize:13,color:"#8dc49a"}}>Age {s.age||"?"} · {s.level}</div></div>
              <div style={{marginLeft:"auto",fontSize:22}}>▶</div>
            </button>
          ))}
          {!adding?(
            <button onClick={()=>setAdding(true)} style={{background:"rgba(26,122,64,0.3)",border:"2px dashed rgba(26,122,64,0.6)",borderRadius:20,padding:"14px",color:"#4ade80",fontSize:16,cursor:"pointer",fontWeight:"bold"}}>+ Add Student</button>
          ):(
            <div style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:20,padding:20,display:"flex",flexDirection:"column",gap:10}}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Child's name" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 14px",color:"white",fontSize:16,outline:"none"}}/>
              <input value={age} onChange={e=>setAge(e.target.value)} placeholder="Age (optional)" type="number" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 14px",color:"white",fontSize:16,outline:"none"}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addStudent} disabled={saving} style={{flex:1,background:"#1a7a40",border:"none",borderRadius:10,color:"white",padding:"10px",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>{saving?"Saving...":"✓ Add"}</button>
                <button onClick={()=>setAdding(false)} style={{flex:1,background:"rgba(255,255,255,0.1)",border:"none",borderRadius:10,color:"white",padding:"10px",fontSize:15,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {students.length>0&&<button onClick={onDashboard} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"8px 20px",color:"#8dc49a",fontSize:13,cursor:"pointer",marginTop:8}}>📊 Parent Dashboard</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 2 — Parent Briefing
// ══════════════════════════════════════════════════════════
function ParentBriefing({ student, onStart }) {
  const [notes, setNotes] = useState(""), [topics, setTopics] = useState([]), [saving, setSaving] = useState(false);
  const topicOptions = ["Arabic Letters","Quran Recitation","Surah Memorization","Islamic Stories","Duas","Tajweed","Pillars of Islam"];
  const toggle = t => setTopics(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const submit = async () => {
    setSaving(true);
    try { if(notes.trim()) await api("POST","/noor/parent-notes",{student_id:student.id,notes:notes.trim(),focus_topics:topics}); onStart(notes.trim()||null); }
    catch(e){ onStart(null); } setSaving(false);
  };
  return (
    <div style={{background:"linear-gradient(160deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",padding:24,gap:20}}>
      <div style={{textAlign:"center",marginTop:10}}><div style={{fontSize:32}}>📋</div><div style={{fontSize:22,fontWeight:"bold",color:"#f0c060"}}>Today's Lesson Plan</div><div style={{fontSize:14,color:"#a8d8b0",marginTop:4}}>For {student.name} — Optional</div></div>
      <div style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:13,color:"#8dc49a",marginBottom:8}}>Focus topics today:</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {topicOptions.map(t=><button key={t} onClick={()=>toggle(t)} style={{background:topics.includes(t)?"#1a7a40":"rgba(255,255,255,0.08)",border:`1px solid ${topics.includes(t)?"#1a7a40":"rgba(255,255,255,0.2)"}`,borderRadius:20,padding:"6px 14px",color:"white",fontSize:13,cursor:"pointer"}}>{t}</button>)}
          </div>
        </div>
        <div>
          <div style={{fontSize:13,color:"#8dc49a",marginBottom:8}}>Notes for Ustadha Noor:</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={`e.g. "${student.name} is working on Al-Fatiha. She keeps making mistakes on Ayah 5."`} rows={4}
            style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:14,padding:"12px 14px",color:"white",fontSize:14,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
        </div>
        <button onClick={submit} disabled={saving} style={{background:"linear-gradient(135deg,#1a7a40,#0e4d2a)",border:"none",borderRadius:20,color:"white",padding:"18px",fontSize:18,fontWeight:"bold",cursor:"pointer",boxShadow:"0 6px 24px rgba(0,0,0,0.4)"}}>
          {saving?"Starting...":`▶ Start ${student.name}'s Class`}
        </button>
        <button onClick={()=>onStart(null)} style={{background:"transparent",border:"none",color:"#6aaa80",fontSize:13,cursor:"pointer"}}>Skip — Start without notes</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 3 — Classroom
// ══════════════════════════════════════════════════════════

// Parse blackboard content from teacher reply
function parseBlackboard(text) {
  // Look for patterns like Arabic letters, surahs, duas
  const arabicRegex = /[\u0600-\u06FF]+/g;
  const arabicMatches = text.match(arabicRegex);

  // Check for specific lesson triggers
  const lower = text.toLowerCase();

  if (lower.includes("al-fatiha") || lower.includes("al fatiha") || lower.includes("fatiha")) {
    return { title:"Surah Al-Fatiha", type:"ayah", lines:[
      { arabic:"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", transliteration:"Bismillahi r-rahmani r-raheem", translation:"In the name of Allah, the Most Gracious, the Most Merciful" },
      { arabic:"الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", transliteration:"Alhamdu lillahi rabbi l-'aalameen", translation:"All praise is for Allah, Lord of all worlds" },
    ]};
  }
  if (lower.includes("al-ikhlas") || lower.includes("ikhlas")) {
    return { title:"Surah Al-Ikhlas", type:"ayah", lines:[
      { arabic:"قُلْ هُوَ اللَّهُ أَحَدٌ", transliteration:"Qul huwa Allahu ahad", translation:"Say: He is Allah, the One" },
      { arabic:"اللَّهُ الصَّمَدُ", transliteration:"Allahu s-samad", translation:"Allah, the Eternal Refuge" },
    ]};
  }
  if (lower.includes("al-kawthar") || lower.includes("kawthar")) {
    return { title:"Surah Al-Kawthar", type:"ayah", lines:[
      { arabic:"إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ", transliteration:"Inna a'taynaka l-kawthar", translation:"Indeed, We have granted you Al-Kawthar" },
    ]};
  }
  if (lower.includes("bismillah")) {
    return { title:"Bismillah", type:"arabic_letter", lines:[
      { arabic:"بِسْمِ اللَّهِ", transliteration:"Bismillah", translation:"In the name of Allah" },
    ]};
  }
  if (lower.includes("alef") || lower.includes("alif") || lower.includes("letter")) {
    return { title:"Arabic Letters", type:"arabic_letter", lines:[
      { arabic:"أ  ب  ت  ث", transliteration:"Alef · Ba · Ta · Tha", translation:"The first four Arabic letters" },
    ]};
  }
  if (lower.includes("dua") || lower.includes("du'a")) {
    if (lower.includes("eat") || lower.includes("food")) {
      return { title:"Dua Before Eating", type:"ayah", lines:[
        { arabic:"بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ", transliteration:"Bismillahi wa 'ala barakatiAllah", translation:"In the name of Allah and with the blessings of Allah" },
      ]};
    }
    if (lower.includes("sleep") || lower.includes("bed")) {
      return { title:"Dua Before Sleeping", type:"ayah", lines:[
        { arabic:"بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", transliteration:"Bismika Allahumma amutu wa ahya", translation:"In Your name O Allah, I die and I live" },
      ]};
    }
  }
  if (lower.includes("shahada") || lower.includes("kalima")) {
    return { title:"The Shahada", type:"ayah", lines:[
      { arabic:"لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ", transliteration:"La ilaha illa Allah, Muhammad rasul Allah", translation:"There is no god but Allah, Muhammad is the messenger of Allah" },
    ]};
  }
  if (lower.includes("subhanallah") || lower.includes("alhamdulillah") || lower.includes("allahu akbar")) {
    return { title:"Dhikr", type:"ayah", lines:[
      { arabic:"سُبْحَانَ اللَّهِ", transliteration:"SubhanAllah", translation:"Glory be to Allah" },
      { arabic:"الْحَمْدُ لِلَّهِ", transliteration:"Alhamdulillah", translation:"All praise to Allah" },
      { arabic:"اللَّهُ أَكْبَرُ", transliteration:"Allahu Akbar", translation:"Allah is the Greatest" },
    ]};
  }
  if (arabicMatches && arabicMatches.length > 0) {
    return { title:"On the Board", type:"ayah", lines:[
      { arabic:arabicMatches.slice(0,3).join("  ·  ") }
    ]};
  }
  return null;
}

function Classroom({ student, parentNotes, onBack }) {
  const [faceState, setFaceState] = useState("idle");
  const [bubble, setBubble] = useState("Starting class...");
  const [caption, setCaption] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [mode, setMode] = useState("TEACHING");
  const [alertMsg, setAlertMsg] = useState("");
  const [waitingForHand, setWaitingForHand] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [lessonId, setLessonId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [cheatingCount, setCheatingCount] = useState(0);
  const [blackboard, setBlackboard] = useState(null);
  const [micStatus, setMicStatus] = useState("idle"); // idle | recording | processing

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const micStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const synthRef = useRef(window.speechSynthesis);
  const historyRef = useRef([]);
  const busyRef = useRef(false);
  const visionRef = useRef(null);
  const handRef = useRef(null);
  const modeRef = useRef("TEACHING");
  const lessonIdRef = useRef(null);
  const sessionIdRef = useRef(null);
  const cheatingRef = useRef(0);
  const waitingRef = useRef(false);
  const micOpenRef = useRef(false);

  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{busyRef.current=isThinking||isSpeaking;},[isThinking,isSpeaking]);
  useEffect(()=>{lessonIdRef.current=lessonId;},[lessonId]);
  useEffect(()=>{sessionIdRef.current=sessionId;},[sessionId]);
  useEffect(()=>{cheatingRef.current=cheatingCount;},[cheatingCount]);
  useEffect(()=>{waitingRef.current=waitingForHand;},[waitingForHand]);

  // ── Camera ─────────────────────────────────────────────
  const startCamera = useCallback(async (facing="user") => {
    try {
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:480},height:{ideal:360}},audio:false});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
    } catch(e){console.log("cam",e);}
  },[]);

  const captureFrame = useCallback(()=>{
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c||v.videoWidth===0) return null;
    c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    return c.toDataURL("image/jpeg",0.5).split(",")[1];
  },[]);

  // ── Save transcript ────────────────────────────────────
  const saveTranscript = useCallback((speaker, message) => {
    if(!lessonIdRef.current) return;
    api("POST","/noor/transcript/add",{lesson_id:lessonIdRef.current,student_id:student.id,session_id:sessionIdRef.current,speaker,message,mode:modeRef.current}).catch(()=>{});
  },[student]);

  // ── TTS ────────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    synthRef.current.cancel();
    const clean=text.replace(/[*_#~`]/g,"").replace(/\n+/g," ").trim();
    if(!clean){onDone?.();return;}
    saveTranscript("teacher",clean);

    // Update blackboard based on content
    const board=parseBlackboard(clean);
    if(board) setBlackboard(board);

    const utt=new SpeechSynthesisUtterance(clean);
    utt.rate=0.87;utt.pitch=1.18;
    const voices=synthRef.current.getVoices();
    const v=voices.find(v=>/Samantha|Karen|Zira|Serena|Google UK English Female/i.test(v.name))||voices.find(v=>v.lang.startsWith("en"))||voices[0];
    if(v) utt.voice=v;
    utt.onstart=()=>{setIsSpeaking(true);setFaceState("speaking");};
    utt.onend=()=>{setIsSpeaking(false);setFaceState("watching");onDone?.();};
    utt.onerror=()=>{setIsSpeaking(false);setFaceState("watching");onDone?.();};
    synthRef.current.speak(utt);
  },[saveTranscript]);

  // ── MediaRecorder mic (reliable) ──────────────────────
  const startRecording = useCallback(async () => {
    if(micOpenRef.current) return;
    micOpenRef.current=true;
    setMicStatus("recording");
    setIsListening(true);
    setFaceState("listening");
    setCaption("Listening... speak now!");
    chunksRef.current=[];

    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      micStreamRef.current=stream;
      const recorder=new MediaRecorder(stream,{mimeType:"audio/webm"});
      recorderRef.current=recorder;
      recorder.ondataavailable=e=>{ if(e.data.size>0) chunksRef.current.push(e.data); };
      recorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        micOpenRef.current=false;
        setIsListening(false);
        setMicStatus("processing");
        setCaption("Processing...");
        setFaceState("thinking");

        if(chunksRef.current.length===0){
          setMicStatus("idle");setCaption("");
          speak("I didn't hear anything. Raise your hand or press the button to try again!",()=>{setWaitingForHand(true);startHandWatch();});
          return;
        }

        const blob=new Blob(chunksRef.current,{type:"audio/webm"});
        const reader=new FileReader();
        reader.onloadend=async()=>{
          const b64=reader.result.split(",")[1];
          setMicStatus("idle");setCaption("");

          // Use Claude directly since Whisper may not be set up — send audio as text prompt
          // Actually transcribe via Web Speech fallback OR send to backend
          // We'll use webkitSpeechRecognition as the transcriber separately
          // For now: send image + audio b64 to chat as a student message
          const img=captureFrame();
          await askAI({text:"[STUDENT SPOKE - audio captured]",imageB64:img,audioB64:b64});
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
    } catch(e){
      micOpenRef.current=false;
      setMicStatus("idle");setIsListening(false);setFaceState("watching");
      setCaption("Mic permission denied. Please allow microphone access.");
      setTimeout(()=>setCaption(""),3000);
    }
  },[captureFrame, speak]);

  const stopRecording = useCallback(()=>{
    if(recorderRef.current&&recorderRef.current.state==="recording"){
      recorderRef.current.stop();
    }
  },[]);

  // ── Web Speech Recognition (primary transcription) ────
  const openSpeechMic = useCallback((onResult)=>{
    if(micOpenRef.current) return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ startRecording(); return; }

    micOpenRef.current=true;
    setIsListening(true);setFaceState("listening");setMicStatus("recording");
    setCaption("🎤 Listening...");

    const rec=new SR();
    rec.lang="en-US";rec.interimResults=true;rec.continuous=false;
    rec.maxAlternatives=1;
    let final="";
    let silenceTimer;

    rec.onresult=e=>{
      clearTimeout(silenceTimer);
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal) final+=e.results[i][0].transcript+" ";
        else interim=e.results[i][0].transcript;
      }
      setCaption(final||interim);
      // Auto-stop after 1.5s of silence
      silenceTimer=setTimeout(()=>rec.stop(),1500);
    };

    rec.onnomatch=()=>{rec.stop();};

    rec.onend=()=>{
      clearTimeout(silenceTimer);
      micOpenRef.current=false;
      setIsListening(false);setMicStatus("idle");
      const said=(final||"").trim();
      setCaption("");
      if(said){
        saveTranscript("student",said);
        setHandDetected(false);setWaitingForHand(false);
        onResult(said);
      } else {
        setCaption("Didn't catch that. Try again!");
        setTimeout(()=>setCaption(""),2500);
        setFaceState("watching");
        setWaitingForHand(true);startHandWatch();
      }
    };

    rec.onerror=e=>{
      clearTimeout(silenceTimer);
      micOpenRef.current=false;
      setIsListening(false);setMicStatus("idle");setFaceState("watching");
      if(e.error==="not-allowed"){
        setCaption("❌ Mic blocked. Click the 🔒 in address bar → Allow microphone.");
        setTimeout(()=>setCaption(""),5000);
      } else {
        setCaption("Mic error: "+e.error+". Try again!");
        setTimeout(()=>setCaption(""),3000);
        setWaitingForHand(true);startHandWatch();
      }
    };

    try{rec.start();}
    catch(e){micOpenRef.current=false;setIsListening(false);setMicStatus("idle");}
  },[saveTranscript, startRecording]);

  // ── AI call ────────────────────────────────────────────
  const askAI = useCallback(async({text,imageB64,visionAlert,homeworkScan})=>{
    if(busyRef.current&&!visionAlert) return;
    setIsThinking(true);setFaceState("thinking");
    let msg=text||"";
    if(visionAlert) msg=`[VISION: ${visionAlert}]`;
    if(homeworkScan) msg="[HOMEWORK SCAN] Read and grade this homework carefully.";
    try {
      const body={student_id:student.id,lesson_id:lessonIdRef.current,message:msg,image_b64:imageB64||null,mode:modeRef.current,history:historyRef.current.slice(-14)};
      const data=await api("POST","/noor/chat",body);
      const reply=data.reply;
      historyRef.current=[...historyRef.current,{role:"user",content:msg},{role:"assistant",content:reply}].slice(-18);
      setIsThinking(false);setBubble(reply);
      speak(reply,()=>{ setWaitingForHand(true); startHandWatch(); });
    } catch(e){
      setIsThinking(false);setFaceState("watching");
      if(!visionAlert) speak("Sorry, let me try again!",()=>{setWaitingForHand(true);startHandWatch();});
    }
  },[student,speak]);

  // ── Hand raise watcher ─────────────────────────────────
  const startHandWatch = useCallback(()=>{
    clearInterval(handRef.current);
    let checking=false;
    handRef.current=setInterval(async()=>{
      if(!waitingRef.current||busyRef.current||micOpenRef.current||checking) return;
      checking=true;
      const img=captureFrame();
      if(!img){checking=false;return;}
      try{
        const data=await api("POST","/noor/hand-raise",{student_id:student.id,lesson_id:lessonIdRef.current,session_id:sessionIdRef.current,image_b64:img});
        if(data.raised){
          clearInterval(handRef.current);
          setHandDetected(true);setWaitingForHand(false);
          const callOn=`Yes ${student.name}! Go ahead!`;
          setBubble(callOn+"🎤");
          synthRef.current.cancel();
          const utt=new SpeechSynthesisUtterance(callOn);
          utt.rate=0.9;utt.pitch=1.2;
          const voices=synthRef.current.getVoices();
          const v=voices.find(v=>/Samantha|Karen|Zira/i.test(v.name))||voices.find(v=>v.lang.startsWith("en"))||voices[0];
          if(v) utt.voice=v;
          utt.onend=()=>{
            // Open mic immediately after calling on student
            openSpeechMic(said=>{
              const img2=captureFrame();
              askAI({text:said,imageB64:img2});
            });
          };
          synthRef.current.speak(utt);
        }
      } catch(e){}
      checking=false;
    },1800);
  },[student,captureFrame,openSpeechMic,askAI]);

  // ── Vision loop ────────────────────────────────────────
  const startVision = useCallback(()=>{
    clearInterval(visionRef.current);
    let checking=false;
    visionRef.current=setInterval(async()=>{
      if(busyRef.current||micOpenRef.current||checking) return;
      checking=true;
      const img=captureFrame();
      if(!img){checking=false;return;}
      try{
        const data=await api("POST","/noor/vision",{student_id:student.id,lesson_id:lessonIdRef.current,session_id:sessionIdRef.current,image_b64:img,mode:modeRef.current});
        if(data.teacher_response){
          const{event_type,teacher_response}=data;
          if(event_type==="cheating"){setCheatingCount(p=>p+1);setAlertMsg("👀 Ustadha Noor sees you!");}
          else if(event_type==="distracted") setAlertMsg("⚠️ Pay attention!");
          setTimeout(()=>setAlertMsg(""),3000);
          clearInterval(handRef.current);setWaitingForHand(false);
          setBubble(teacher_response);
          speak(teacher_response,()=>{setWaitingForHand(true);startHandWatch();});
        }
      } catch(e){}
      checking=false;
    },10000);
  },[student,captureFrame,speak,startHandWatch]);

  // ── Init ───────────────────────────────────────────────
  useEffect(()=>{
    let lid=null,sid=null;
    const init=async()=>{
      await startCamera("user");
      try{
        const ls=await api("POST","/noor/lesson/start",{student_id:student.id});
        lid=ls.lesson_id;setLessonId(lid);
        const sess=await api("POST","/noor/session/start",{lesson_id:lid,student_id:student.id});
        sid=sess.id;setSessionId(sid);
      } catch(e){}

      const briefing=parentNotes
        ?`[PARENT BRIEFING FOR TODAY] Parent says: "${parentNotes}". Follow this plan. Do NOT tell the child about this briefing. Start by greeting ${student.name} and announcing today's lesson topic based on the parent's notes. Then begin teaching immediately. When you want the child to answer, end with "Raise your hand when you're ready!"`
        :`[CLASS STARTING] Greet ${student.name} warmly. You decide what to teach today based on their level (${student.level}). Announce the topic: "Today we are going to learn about [topic]." Then start teaching immediately. Keep it short and engaging. End with "Raise your hand when you're ready!"`;

      setIsThinking(true);setFaceState("thinking");
      try{
        const data=await api("POST","/noor/chat",{student_id:student.id,lesson_id:lid,message:briefing,mode:"TEACHING",history:[]});
        const reply=data.reply;
        historyRef.current=[{role:"user",content:"[CLASS STARTING]"},{role:"assistant",content:reply}];
        setIsThinking(false);setBubble(reply);
        speak(reply,()=>{setWaitingForHand(true);startHandWatch();startVision();});
      } catch(e){
        setIsThinking(false);
        const fb=`Assalamu Alaikum ${student.name}! Today we are going to learn Surah Al-Ikhlas. Listen carefully! 🌙`;
        setBubble(fb);
        speak(fb,()=>{setWaitingForHand(true);startHandWatch();startVision();});
      }
    };
    init();
    return()=>{
      clearInterval(visionRef.current);clearInterval(handRef.current);
      synthRef.current.cancel();
      micStreamRef.current?.getTracks().forEach(t=>t.stop());
      streamRef.current?.getTracks().forEach(t=>t.stop());
      if(lid||lessonIdRef.current){
        const lId=lid||lessonIdRef.current,sId=sid||sessionIdRef.current;
        if(sId) api("POST","/noor/session/end",{session_id:sId,lesson_id:lId,student_id:student.id,cheating_attempts:cheatingRef.current}).catch(()=>{});
        api("POST","/noor/lesson/end",{lesson_id:lId,student_id:student.id,topics_covered:[]}).catch(()=>{});
      }
    };
  },[]);

  // ── Homework ───────────────────────────────────────────
  const doHomework=async()=>{
    clearInterval(handRef.current);setWaitingForHand(false);setMode("HOMEWORK");
    speak("Hold your homework up to the camera now!",async()=>{
      await startCamera("environment");
      setTimeout(async()=>{
        const img=captureFrame();await startCamera("user");
        if(img) askAI({homeworkScan:true,imageB64:img});
        else speak("I couldn't see it. Try again!",()=>{setWaitingForHand(true);startHandWatch();});
      },2000);
    });
  };

  const switchMode=m=>{
    setMode(m);clearInterval(handRef.current);
    askAI({text:`[MODE: ${m}] Switch to ${m} mode and lead the child.`});
  };

  const handleMicPress=()=>{
    if(isThinking||isSpeaking) return;
    synthRef.current.cancel();setIsSpeaking(false);
    clearInterval(handRef.current);setWaitingForHand(false);
    openSpeechMic(said=>{
      const img=captureFrame();
      askAI({text:said,imageB64:img});
    });
  };

  return (
    <div style={{background:"linear-gradient(180deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",maxWidth:480,margin:"0 auto",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",boxSizing:"border-box",background:"rgba(0,0,0,0.3)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#8dc49a",fontSize:14,cursor:"pointer"}}>← End Class</button>
        <div style={{fontWeight:"bold",color:"#f0c060",fontSize:15}}>{student.name}</div>
        <span style={{background:mode==="RECITATION"?"#7d3c98":mode==="HOMEWORK"?"#a93226":"#1a7a40",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:"bold"}}>
          {mode==="RECITATION"?"🕌 Reciting":mode==="HOMEWORK"?"📝 Homework":"📚 Lesson"}
        </span>
      </div>

      {alertMsg&&<div style={{width:"100%",background:"#922b21",textAlign:"center",padding:"8px",fontSize:14,fontWeight:"bold"}}>{alertMsg}</div>}

      {/* Face + Camera row */}
      <div style={{display:"flex",gap:10,padding:"8px 14px 0",width:"100%",boxSizing:"border-box",alignItems:"center"}}>
        <div style={{flexShrink:0}}><Face state={faceState} size={100}/></div>
        <div style={{flex:1,height:100,borderRadius:14,overflow:"hidden",border:"2px solid rgba(255,255,255,0.15)",background:"#000",position:"relative"}}>
          <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}}/>
          <div style={{position:"absolute",top:5,left:5,background:"rgba(14,77,42,0.85)",borderRadius:8,padding:"2px 8px",fontSize:11,display:"flex",alignItems:"center",gap:4}}>
            <span style={{color:"#4ade80"}}>●</span> Live
          </div>
          {waitingForHand&&!isListening&&(
            <div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",background:"rgba(240,192,64,0.92)",borderRadius:8,padding:"2px 8px",fontSize:11,color:"#000",fontWeight:"bold",whiteSpace:"nowrap"}}>
              🖐 Raise hand to answer
            </div>
          )}
          {handDetected&&<div style={{position:"absolute",inset:0,border:"3px solid #f0c040",borderRadius:12}}/>}
        </div>
      </div>
      <canvas ref={canvasRef} style={{display:"none"}}/>

      {/* BLACKBOARD */}
      <Blackboard content={blackboard}/>

      {/* Speech bubble */}
      <div style={{margin:"8px 14px 0",width:"calc(100% - 28px)",boxSizing:"border-box",background:"rgba(255,255,255,0.96)",borderRadius:18,padding:"12px 16px",minHeight:70,maxHeight:130,overflowY:"auto"}}>
        <div style={{fontSize:14,color:"#0d2818",lineHeight:1.6,whiteSpace:"pre-wrap"}}>
          {isThinking?<span style={{color:"#1a7a40"}}>🤔 Thinking...</span>:bubble}
        </div>
      </div>

      {/* Caption */}
      {caption&&(
        <div style={{margin:"4px 14px 0",width:"calc(100% - 28px)",boxSizing:"border-box",background:"rgba(0,0,0,0.5)",borderRadius:10,padding:"6px 12px",fontSize:13,color:"#d0f0dc",fontStyle:"italic"}}>
          {caption}
        </div>
      )}

      {/* Status */}
      <div style={{fontSize:12,marginTop:8,color:isListening?"#4ade80":isSpeaking?"#f0c060":waitingForHand?"#f0c040":"#6aaa80",textAlign:"center"}}>
        {isListening?"🎤 Listening — speak now!":isSpeaking?"🔊 Speaking...":isThinking?"🤔 Thinking...":waitingForHand?"🖐 Waiting for you to raise your hand...":"👁 Watching..."}
      </div>

      {/* BIG MIC BUTTON */}
      <button
        onPointerDown={handleMicPress}
        disabled={isThinking||isSpeaking||isListening}
        style={{
          margin:"8px 14px 0",width:"calc(100% - 28px)",
          background:isListening?"#c0392b":isThinking||isSpeaking?"rgba(255,255,255,0.08)":"#1a7a40",
          border:"none",borderRadius:18,color:"white",padding:"16px",
          fontSize:17,fontWeight:"bold",
          cursor:isThinking||isSpeaking||isListening?"not-allowed":"pointer",
          opacity:isThinking||isSpeaking?0.4:1,
          boxShadow:isListening?"0 0 0 8px rgba(192,57,43,0.3)":"0 4px 20px rgba(0,0,0,0.4)",
          transition:"all 0.2s",
        }}>
        {isListening?"🔴 Listening... wait for it to stop"
          :isThinking?"🤔 Thinking..."
          :isSpeaking?"🔊 Speaking..."
          :"🎤 Press to Speak"}
      </button>

      {/* Mode buttons */}
      <div style={{display:"flex",gap:8,padding:"8px 14px 0",width:"100%",boxSizing:"border-box"}}>
        {[["TEACHING","📚 Lesson","#1a7a40"],["RECITATION","🕌 Recite","#7d3c98"]].map(([m,l,c])=>(
          <button key={m} onClick={()=>switchMode(m)} style={{flex:1,background:mode===m?c:"rgba(255,255,255,0.1)",border:`2px solid ${mode===m?c:"rgba(255,255,255,0.15)"}`,borderRadius:12,color:"white",padding:"9px",fontSize:13,fontWeight:mode===m?"bold":"normal",cursor:"pointer"}}>{l}</button>
        ))}
        <button onClick={doHomework} style={{flex:1,background:"rgba(169,50,38,0.7)",border:"2px solid rgba(169,50,38,0.5)",borderRadius:12,color:"white",padding:"9px",fontSize:13,cursor:"pointer"}}>📝 Homework</button>
      </div>

      <div style={{fontSize:11,color:"#3d7a55",padding:"8px 0 14px",textAlign:"center"}}>
        🖐 Raise hand to answer · 🎤 Or press button to speak
      </div>
      <style>{`@keyframes wave{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 4 — Parent Dashboard
// ══════════════════════════════════════════════════════════
function Dashboard({ students, onBack }) {
  const [sel,setSel]=useState(students[0]?.id||null);
  const [data,setData]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [transcript,setTranscript]=useState([]);
  const [view,setView]=useState("overview");
  const [notes,setNotes]=useState("");
  const [savingNotes,setSavingNotes]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!sel) return; setLoading(true);
    Promise.all([api("GET",`/noor/student/${sel}`),api("GET",`/noor/sessions/${sel}`)]).then(([d,s])=>{setData(d);setSessions(s);}).catch(()=>{}).finally(()=>setLoading(false));
  },[sel]);

  const loadTranscript=async lid=>{
    setView("transcript");
    const t=await api("GET",`/noor/transcript/${lid}`).catch(()=>[]);
    setTranscript(t);
  };
  const saveNotes=async()=>{
    if(!notes.trim()||!sel) return; setSavingNotes(true);
    try{await api("POST","/noor/parent-notes",{student_id:sel,notes:notes.trim(),focus_topics:[]});setNotes("");}catch(e){}setSavingNotes(false);
  };
  const p=data?.progress,s=data?.student;

  return (
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
                <div style={{fontSize:20,flexShrink:0}}>{t.speaker==="teacher"?"👩‍🏫":"🧒"}</div>
                <div style={{background:t.speaker==="teacher"?"rgba(26,122,64,0.3)":"rgba(255,255,255,0.1)",borderRadius:14,padding:"8px 12px",fontSize:13,lineHeight:1.5,maxWidth:"80%"}}>
                  <div style={{fontSize:10,color:"#6aaa80",marginBottom:3}}>{new Date(t.timestamp).toLocaleTimeString()}</div>
                  {t.message}
                </div>
              </div>
            ))
          }
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
              <div style={{background:"linear-gradient(90deg,#1a7a40,#4ade80)",height:"100%",width:`${p?.arabic_level||0}%`,borderRadius:20,transition:"width 1s"}}/>
            </div>
            <div style={{fontSize:12,color:"#f0c060",marginTop:6,textAlign:"right"}}>{p?.arabic_level||0}%</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
            <div style={{fontSize:14,fontWeight:"bold",color:"#f0c060",marginBottom:10}}>✏️ Notes for Next Class</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={`Leave a note for Ustadha Noor about ${s?.name}'s next lesson...`} rows={3}
              style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:12,padding:"10px 12px",color:"white",fontSize:13,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
            <button onClick={saveNotes} disabled={savingNotes||!notes.trim()} style={{marginTop:8,background:"#1a7a40",border:"none",borderRadius:10,color:"white",padding:"8px 20px",fontSize:13,fontWeight:"bold",cursor:"pointer",opacity:notes.trim()?1:0.5}}>
              {savingNotes?"Saving...":"Save for Next Class"}
            </button>
          </div>
          {sessions.length>0&&(
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
              <div style={{fontSize:14,fontWeight:"bold",color:"#f0c060",marginBottom:10}}>📹 Session History</div>
              {sessions.slice(0,8).map(sess=>(
                <div key={sess.id} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:"#8dc49a"}}>{new Date(sess.started_at).toLocaleDateString()} {new Date(sess.started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                    <span style={{fontSize:12,color:"#f0c060"}}>{Math.round((sess.duration_seconds||0)/60)} min</span>
                  </div>
                  {sess.transcript_summary&&<div style={{fontSize:12,color:"#d0f0dc",lineHeight:1.4,marginBottom:6}}>{sess.transcript_summary}</div>}
                  <div style={{display:"flex",gap:8,fontSize:11,color:"#6aaa80",marginBottom:6}}>
                    <span>🖐 {sess.hand_raises||0} hand raises</span>
                    <span>⚠️ {sess.cheating_attempts||0} alerts</span>
                  </div>
                  <button onClick={()=>loadTranscript(sess.lesson_id)} style={{background:"rgba(26,122,64,0.4)",border:"1px solid rgba(26,122,64,0.6)",borderRadius:8,color:"white",padding:"4px 12px",fontSize:12,cursor:"pointer"}}>📄 View Transcript</button>
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
  const [student,setStudent]=useState(null);
  const [parentNotes,setParentNotes]=useState(null);
  const [students,setStudents]=useState([]);
  useEffect(()=>{ api("GET","/noor/students").then(setStudents).catch(()=>{}); },[screen]);
  if(screen==="briefing"&&student) return <ParentBriefing student={student} onStart={n=>{setParentNotes(n);setScreen("class");}}/>;
  if(screen==="class"&&student) return <Classroom student={student} parentNotes={parentNotes} onBack={()=>setScreen("select")}/>;
  if(screen==="dashboard") return <Dashboard students={students} onBack={()=>setScreen("select")}/>;
  return <StudentSelect onSelect={s=>{setStudent(s);setScreen("briefing");}} onDashboard={()=>setScreen("dashboard")}/>;
}
