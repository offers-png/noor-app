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

function getMouthOpenY(shape, phase) {
  const opens = {
    open_wide:60,lips_together:51,tongue_top:62,tongue_between:60,
    throat:65,breath_h:68,throat_rough:65,throat_deep:68,throat_gargle:65,
    back_throat:65,mid_throat:62,open_breath:65,lips_round:64,lip_teeth:62,
    roll_r:62,teeth_close:56,smile_wide:60,
  };
  const max = opens[shape] || 60;
  return phase === 0 ? 50 : phase === 1 ? max : 50 + (max - 50) * 0.6;
}

function MouthAvatar({ letterData, speaking }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!speaking || !letterData) return;
    const t = setInterval(() => setPhase(p => (p + 1) % 3), 170);
    return () => clearInterval(t);
  }, [speaking, letterData]);
  if (!letterData) return null;
  const lowerY = getMouthOpenY(letterData.shape, phase);
  const hasLip = letterData.shape === "lips_together";
  const hasTongue = letterData.shape === "tongue_top" || letterData.shape === "tongue_between";
  return (
    <div style={{ background:"linear-gradient(135deg,#1a1a2e,#16213e)", borderRadius:16, padding:"10px 12px",
      border:`2px solid ${letterData.color}40`, display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:130 }}>
      <div style={{ fontSize:48, color:letterData.color, fontFamily:"serif", lineHeight:1,
        textShadow:`0 0 16px ${letterData.color}60`,
        animation: speaking ? "lp 0.4s ease-in-out infinite alternate" : "none" }}>
        {letterData.label.split("·")[0].trim()}
      </div>
      <svg viewBox="0 0 120 100" width={105} height={85} style={{ background:"#2d1a1a", borderRadius:10 }}>
        <ellipse cx="60" cy="50" rx="52" ry="44" fill="#FDEBD0"/>
        <path d="M 28 50 Q 60 42 92 50" stroke="#8b3a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {lowerY > 52 && (
          <path d={`M 28 50 Q 60 ${lowerY} 92 50 Q 60 50 28 50`} fill="#1a0800"/>
        )}
        {hasTongue && lowerY > 55 && (
          <ellipse cx="60" cy={50 + (lowerY - 50) * 0.35} rx="16" ry="7" fill="#c05560"/>
        )}
        <path d={`M 28 50 Q 60 ${lowerY} 92 50`} stroke="#8b3a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {hasLip && <><circle cx="44" cy="30" r="4" fill="#c8956a"/><circle cx="76" cy="30" r="4" fill="#c8956a"/></>}
        {lowerY > 54 && <line x1="34" y1="50" x2="86" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="7,4"/>}
        {speaking && lowerY > 52 && [1,2,3].map(i => (
          <ellipse key={i} cx="60" cy="50" rx={18+i*11} ry={6+i*4} fill="none" stroke={letterData.color} strokeWidth="1" opacity={0.35 - i*0.08}>
            <animate attributeName="rx" values={`${18+i*11};${26+i*11};${18+i*11}`} dur="0.55s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values={`${0.35-i*0.08};0;${0.35-i*0.08}`} dur="0.55s" repeatCount="indefinite"/>
          </ellipse>
        ))}
      </svg>
      <div style={{ fontSize:12, color:letterData.color, fontWeight:"bold" }}>{letterData.label}</div>
      <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", textAlign:"center" }}>{letterData.desc}</div>
      <style>{`@keyframes lp{from{transform:scale(1)}to{transform:scale(1.06)}}`}</style>
    </div>
  );
}

// ── Blackboard ─────────────────────────────────────────────
function Blackboard({ content }) {
  if (!content) return null;
  return (
    <div style={{ background:"linear-gradient(135deg,#1a3a1a,#0d2b0d)", border:"5px solid #5a3a1a",
      borderRadius:10, padding:"10px 12px", boxShadow:"inset 0 2px 10px rgba(0,0,0,0.5)", minHeight:75,
      flex:1, position:"relative" }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 80% 20%,rgba(255,255,255,0.03) 0%,transparent 60%)", pointerEvents:"none" }}/>
      {content.title && <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:6, textAlign:"center", letterSpacing:1, textTransform:"uppercase" }}>✦ {content.title} ✦</div>}
      {content.lines?.map((line, i) => (
        <div key={i} style={{ marginBottom:5, textAlign:"center" }}>
          {line.arabic && <div style={{ fontSize:content.type==="arabic_letter"?26:18, color:"#f0e68c", fontFamily:"serif", direction:"rtl", lineHeight:1.3 }}>{line.arabic}</div>}
          {line.transliteration && <div style={{ fontSize:10, color:"#a8d8a8", fontStyle:"italic", marginTop:2 }}>{line.transliteration}</div>}
          {line.translation && <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:1 }}>{line.translation}</div>}
        </div>
      ))}
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
function StudentSelect({ onSelect, onDashboard }) {
  const [students,setStudents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [adding,setAdding]=useState(false);
  const [name,setName]=useState(""), [age,setAge]=useState(""), [saving,setSaving]=useState(false);
  const avatars=["🧒","👦","👧","🧒‍♀️","👶","🧑"];
  useEffect(()=>{api("GET","/noor/students").then(setStudents).catch(()=>setStudents([])).finally(()=>setLoading(false));},[]);
  const addStudent=async()=>{
    if(!name.trim()) return; setSaving(true);
    try{const s=await api("POST","/noor/students",{name:name.trim(),age:age?parseInt(age):null,level:"beginner"});setStudents(p=>[...p,s]);setName("");setAge("");setAdding(false);}catch(e){}setSaving(false);
  };
  return(
    <div style={{background:"linear-gradient(160deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",padding:24,gap:20}}>
      <div style={{textAlign:"center",marginTop:20}}><Face state="idle" size={100}/><div style={{fontSize:26,fontWeight:"bold",color:"#f0c060",marginTop:8}}>✨ Sheikh Noor</div><div style={{fontSize:14,color:"#a8d8b0"}}>Islamic AI Teacher</div></div>
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
              <input value={age} onChange={e=>setAge(e.target.value)} placeholder="Age" type="number" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"10px 14px",color:"white",fontSize:16,outline:"none"}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addStudent} disabled={saving} style={{flex:1,background:"#1a7a40",border:"none",borderRadius:10,color:"white",padding:"10px",fontSize:15,fontWeight:"bold",cursor:"pointer"}}>{saving?"...":"✓ Add"}</button>
                <button onClick={()=>setAdding(false)} style={{flex:1,background:"rgba(255,255,255,0.1)",border:"none",borderRadius:10,color:"white",padding:"10px",fontSize:15,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {students.length>0&&<button onClick={onDashboard} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"8px 20px",color:"#8dc49a",fontSize:13,cursor:"pointer"}}>📊 Parent Dashboard</button>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  PARENT BRIEFING
// ══════════════════════════════════════════════════════════
function ParentBriefing({ student, onStart }) {
  const [notes,setNotes]=useState("");
  const [topics,setTopics]=useState([]);
  const [saving,setSaving]=useState(false);
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
    setSaving(true);
    // Build topic string to pass to teacher
    const topicLabels=topics.map(t=>topicOptions.find(o=>o.key===t)?.label.slice(2)).filter(Boolean);
    const combined=[...topicLabels, notes.trim()].filter(Boolean).join(". ");
    try{
      if(combined) await api("POST","/noor/parent-notes",{student_id:student.id,notes:combined,focus_topics:topics});
      onStart(combined||null);
    }catch(e){onStart(null);}
    setSaving(false);
  };

  return(
    <div style={{background:"linear-gradient(160deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",padding:24,gap:20,overflowY:"auto"}}>
      <div style={{textAlign:"center",marginTop:10}}><div style={{fontSize:32}}>📋</div><div style={{fontSize:22,fontWeight:"bold",color:"#f0c060"}}>Today's Lesson</div><div style={{fontSize:14,color:"#a8d8b0",marginTop:4}}>For {student.name}</div></div>
      <div style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:16}}>
        <div>
          <div style={{fontSize:14,color:"#f0c060",marginBottom:10,fontWeight:"bold"}}>Choose today's topic:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {topicOptions.map(t=>(
              <button key={t.key} onClick={()=>toggle(t.key)} style={{
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
          <textarea value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder={`e.g. "${student.name} struggles with the letter Ain. Please go slowly."`}
            rows={3} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:14,padding:"12px",color:"white",fontSize:14,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
        </div>
        <button onClick={submit} disabled={saving} style={{background:"linear-gradient(135deg,#1a7a40,#0e4d2a)",border:"none",borderRadius:20,color:"white",padding:"18px",fontSize:18,fontWeight:"bold",cursor:"pointer",boxShadow:"0 6px 24px rgba(0,0,0,0.4)"}}>
          {saving?"Starting...":`▶ Start ${student.name}'s Class`}
        </button>
        <button onClick={()=>onStart(null)} style={{background:"transparent",border:"none",color:"#6aaa80",fontSize:13,cursor:"pointer",textAlign:"center"}}>Skip — Let teacher decide</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  CLASSROOM
// ══════════════════════════════════════════════════════════
function Classroom({ student, parentNotes, onBack }) {
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
  const [lessonId,setLessonId]=useState(null);
  const [sessionId,setSessionId]=useState(null);
  const [cheatingCount,setCheatingCount]=useState(0);
  const [micGranted,setMicGranted]=useState(false);
  const [micError,setMicError]=useState("");

  const videoRef=useRef(null);
  const canvasRef=useRef(null);
  const camStreamRef=useRef(null);
  const synthRef=useRef(window.speechSynthesis);
  const recRef=useRef(null);
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

  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{lessonIdRef.current=lessonId;},[lessonId]);
  useEffect(()=>{sessionIdRef.current=sessionId;},[sessionId]);
  useEffect(()=>{cheatingRef.current=cheatingCount;},[cheatingCount]);
  useEffect(()=>{waitingRef.current=waitingForHand;},[waitingForHand]);
  useEffect(()=>{speakingRef.current=isSpeaking;},[isSpeaking]);
  useEffect(()=>{thinkingRef.current=isThinking;},[isThinking]);
  useEffect(()=>{listeningRef.current=isListening;},[isListening]);

  const busy=useCallback(()=>speakingRef.current||thinkingRef.current,[]);

  // ── Camera ──────────────────────────────────────────────
  const startCamera=useCallback(async(facing="user")=>{
    try{
      if(camStreamRef.current) camStreamRef.current.getTracks().forEach(t=>t.stop());
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:480},height:{ideal:360}},audio:false});
      camStreamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;await videoRef.current.play();}
    }catch(e){console.log("cam",e);}
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
    api("POST","/noor/transcript/add",{lesson_id:lessonIdRef.current,student_id:student.id,session_id:sessionIdRef.current,speaker,message,mode:modeRef.current}).catch(()=>{});
  },[student]);

  // ── TTS ─────────────────────────────────────────────────
  const speak=useCallback((text,onDone)=>{
    synthRef.current.cancel();
    // Strip Arabic script — TTS engine can't pronounce it, sounds broken
    // Also strip any diacritics/harakat. Only speak transliteration.
    const noArabic=text
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g," ")
      .replace(/[*_#~`]/g,"")
      .replace(/\s+/g," ")
      .trim();
    if(!noArabic){onDone?.();return;}
    saveT("teacher",text); // save original with Arabic for transcript
    const board=parseBlackboard(text);
    if(board) setBlackboard(board);
    const letter=detectLetter(text);
    if(letter) setMouthLetter(letter); else if(!board) setMouthLetter(null);

    const utt=new SpeechSynthesisUtterance(noArabic);
    utt.rate=0.87;utt.pitch=1.1;
    const voices=synthRef.current.getVoices();
    const v=voices.find(v=>/Samantha|Karen|Zira|Serena|Google UK English Female/i.test(v.name))||voices.find(v=>v.lang.startsWith("en"))||voices[0];
    if(v) utt.voice=v;
    utt.onstart=()=>{setIsSpeaking(true);speakingRef.current=true;setFaceState("speaking");};
    utt.onend=()=>{setIsSpeaking(false);speakingRef.current=false;setFaceState("watching");onDone?.();};
    utt.onerror=()=>{setIsSpeaking(false);speakingRef.current=false;setFaceState("watching");onDone?.();};
    synthRef.current.speak(utt);
  },[saveT]);

  // ── AI ───────────────────────────────────────────────────
  const askAI=useCallback(async({text,imageB64,visionAlert,homeworkScan})=>{
    if(busy()&&!visionAlert) return;
    setIsThinking(true);thinkingRef.current=true;setFaceState("thinking");
    let msg=text||"";
    if(visionAlert) msg=`[VISION: ${visionAlert}]`;
    if(homeworkScan) msg="[HOMEWORK SCAN] Read and grade this homework carefully.";
    try{
      const data=await api("POST","/noor/chat",{
        student_id:student.id,lesson_id:lessonIdRef.current,
        message:msg,image_b64:imageB64||null,
        mode:modeRef.current,history:historyRef.current.slice(-14),
      });
      const reply=data.reply;
      historyRef.current=[...historyRef.current,{role:"user",content:msg},{role:"assistant",content:reply}].slice(-18);
      setIsThinking(false);thinkingRef.current=false;setBubble(reply);
      speak(reply,()=>{
        setWaitingForHand(true);
        startHandWatch();
      });
    }catch(e){
      setIsThinking(false);thinkingRef.current=false;setFaceState("watching");
      if(!visionAlert) speak("Ya waladi, let me try again.",()=>{setWaitingForHand(true);startHandWatch();});
    }
  },[student,speak,busy]);

  // ── SPEECH RECOGNITION — continuous=true, supports Arabic & English ────────────────
  const startListening=useCallback(()=>{
    if(!micGranted||listeningRef.current) return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR) return;

    if(recRef.current){
      try{recRef.current.onend=null;recRef.current.onerror=null;recRef.current.onresult=null;recRef.current.abort();}catch(e){}
    }

    const rec=new SR();
    // Support both Arabic and English speech recognition
    rec.lang="ar-SA"; // Primary: Arabic (Saudi Arabia)
    rec.continuous=true;
    rec.interimResults=true;
    rec.maxAlternatives=1;
    recRef.current=rec;
    finalBufferRef.current="";

    rec.onstart=()=>{listeningRef.current=true;setIsListening(true);setMicError("");};

    rec.onresult=e=>{
      if(speakingRef.current||thinkingRef.current) return;
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal){
          finalBufferRef.current+=" "+e.results[i][0].transcript;
          clearTimeout(sendTimerRef.current);
          sendTimerRef.current=setTimeout(()=>{
            const said=finalBufferRef.current.trim();
            finalBufferRef.current="";
            if(said.length>1){
              setCaption(said);
              saveT("student",said);
              setHandDetected(false);setWaitingForHand(false);
              clearInterval(handRef.current);
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
      listeningRef.current=false;setIsListening(false);setCaption("");
      // Always restart unless teacher speaking or thinking
      if(!speakingRef.current&&!thinkingRef.current&&micGranted){
        setTimeout(startListening,300);
      }
    };

    rec.onerror=e=>{
      listeningRef.current=false;setIsListening(false);
      if(e.error==="not-allowed"){setMicError("Microphone blocked. Click 🔒 in address bar → Allow Microphone → Reload.");return;}
      if(e.error!=="no-speech"&&e.error!=="aborted") {
        console.log("Speech Recognition Error:",e.error);
        // Fallback to English if Arabic fails
        if(e.error==="network"||e.error==="service-not-allowed") {
          rec.lang="en-US";
        }
      }
      if(!speakingRef.current&&!thinkingRef.current&&micGranted) setTimeout(startListening,500);
    };

    try{rec.start();}catch(e){listeningRef.current=false;setTimeout(startListening,1000);}
  },[micGranted,captureFrame,askAI,saveT]);

  // Restart listening after teacher finishes speaking
  useEffect(()=>{
    if(!isSpeaking&&!isThinking&&micGranted&&!listeningRef.current){
      setTimeout(startListening,400);
    }
  },[isSpeaking,isThinking,micGranted]);

  // ── REQUEST MIC PERMISSION ───────────────────────────────
  const requestMic=useCallback(async()=>{
    try{
      const s=await navigator.mediaDevices.getUserMedia({audio:true});
      s.getTracks().forEach(t=>t.stop()); // just need the permission
      setMicGranted(true);
      setMicError("");
    }catch(e){
      setMicError("Microphone denied. Please allow mic access in browser settings.");
    }
  },[]);

  // Start listening once mic granted
  useEffect(()=>{
    if(micGranted&&!listeningRef.current&&!speakingRef.current) startListening();
  },[micGranted]);

  // ── HAND RAISE — via backend with improved error handling ─────────────────────────────
  const startHandWatch=useCallback(()=>{
    clearInterval(handRef.current);
    let busy=false;
    let failCount=0;
    handRef.current=setInterval(async()=>{
      if(!waitingRef.current||speakingRef.current||thinkingRef.current||busy) return;
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
        failCount=0; // Reset on success
        if(data.raised){
          clearInterval(handRef.current);
          setHandDetected(true);setWaitingForHand(false);
          try{recRef.current?.abort();}catch(e){}
          listeningRef.current=false;setIsListening(false);
          const callOn=`Ahsant! Yes, ya waladi! Go ahead.`;
          setBubble(callOn+" 🎤");
          speak(callOn,()=>setTimeout(startListening,200));
        }
      }catch(e){
        failCount++;
        console.log("Hand detection error:",e.message,"(attempt",failCount+")");
        // If backend is down, show user feedback
        if(failCount>3) {
          console.warn("Backend hand-raise endpoint not responding. Ensure backend is running.");
        }
      }
      busy=false;
    },1500);
  },[captureFrame,speak,startListening,student]);

  // ── VISION / EMOTION LOOP — via backend with improved error handling ─────────────────
  const startVision=useCallback(()=>{
    clearInterval(visionRef.current);
    let busy=false;
    let failCount=0;
    visionRef.current=setInterval(async()=>{
      if(speakingRef.current||thinkingRef.current||busy) return;
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
        failCount=0; // Reset on success
        if(data.event_type==="cheating"){
          setCheatingCount(p=>p+1);
          setAlertMsg("👀 Sheikh Noor sees you!");
          setTimeout(()=>setAlertMsg(""),3000);
        } else if(data.event_type==="distracted"){
          setAlertMsg("⚠️ Pay attention!");
          setTimeout(()=>setAlertMsg(""),3000);
        }
        if(data.teacher_response){
          setBubble(data.teacher_response);
          speak(data.teacher_response,()=>{setWaitingForHand(true);startHandWatch();});
        }
      }catch(e){
        failCount++;
        if(failCount>5) {
          console.warn("Vision endpoint not responding. Backend may be down.");
        }
      }
      busy=false;
    },8000);
  },[captureFrame,askAI,speak,startHandWatch,student]);

  // ── INIT ────────────────────────────────────────────────
  useEffect(()=>{
    let lid=null,sid=null;
    const init=async()=>{
      await startCamera("user");
      // Request mic permission immediately on load
      await requestMic();
      try{
        const ls=await api("POST","/noor/lesson/start",{student_id:student.id});
        lid=ls.lesson_id;setLessonId(lid);
        const sess=await api("POST","/noor/session/start",{lesson_id:lid,student_id:student.id});
        sid=sess.id;setSessionId(sid);
      }catch(e){}

      // Build opening message — pass parent topic explicitly
      // Enhance scholar/sheikh behavior: authoritative, knowledgeable, patient teacher
      const topicLine=parentNotes
        ?`[SCHOLAR TEACHER MODE] You are Sheikh Noor, a wise and patient Islamic scholar. Your role is to teach ${student.name} with the wisdom of a true sheikh. Parent's focus: ${parentNotes}. This is your ONLY topic today. Greet ${student.name} with respect and warmth, announce exactly this topic, then begin teaching it with deep Islamic knowledge and Quranic references. Be authoritative yet encouraging. Use Quranic verses and Islamic principles to support your teaching.`
        :`[SCHOLAR TEACHER MODE] You are Sheikh Noor, a wise and patient Islamic scholar. Your role is to teach ${student.name} with the wisdom of a true sheikh. No specific topic given. Choose wisely based on ${student.name}'s level (${student.level}). Greet ${student.name} with respect and warmth, announce your chosen topic, then begin teaching it with deep Islamic knowledge and Quranic references. Be authoritative yet encouraging.`;

      setIsThinking(true);thinkingRef.current=true;setFaceState("thinking");
      try{
        const data=await api("POST","/noor/chat",{student_id:student.id,lesson_id:lid,message:topicLine,mode:"TEACHING",history:[]});
        const reply=data.reply;
        historyRef.current=[{role:"user",content:"[CLASS STARTING]"},{role:"assistant",content:reply}];
        setIsThinking(false);thinkingRef.current=false;setBubble(reply);
        speak(reply,()=>{setWaitingForHand(true);startHandWatch();startVision();});
      }catch(e){
        setIsThinking(false);thinkingRef.current=false;
        // Fallback message with scholar/sheikh tone
        const fb=`Bismillah. Assalamu Alaikum wa Rahmatullahi wa Barakatuhu, ${student.name}! I am Sheikh Noor, your Islamic teacher. Today we embark on a journey of knowledge and wisdom. Listen carefully, ya waladi. Raise your hand when you have a question or are ready to answer. May Allah bless your learning!`;
        setBubble(fb);speak(fb,()=>{setWaitingForHand(true);startHandWatch();startVision();});
      }
    };
    init();
    return()=>{
      clearInterval(visionRef.current);clearInterval(handRef.current);clearTimeout(sendTimerRef.current);
      synthRef.current.cancel();
      try{recRef.current?.abort();}catch(e){}
      camStreamRef.current?.getTracks().forEach(t=>t.stop());
      if(lid||lessonIdRef.current){
        const lId=lid||lessonIdRef.current,sId=sid||sessionIdRef.current;
        if(sId) api("POST","/noor/session/end",{session_id:sId,lesson_id:lId,student_id:student.id,cheating_attempts:cheatingRef.current}).catch(()=>{});
        api("POST","/noor/lesson/end",{lesson_id:lId,student_id:student.id,topics_covered:[]}).catch(()=>{});
      }
    };
  },[]);

  // ── Keepalive — ping backend every 4 min to prevent sleep
  useEffect(()=>{
    const t=setInterval(()=>api("GET","/noor/ping").catch(()=>{}),240000);
    return()=>clearInterval(t);
  },[]);

  const doHomework=async()=>{
    clearInterval(handRef.current);setWaitingForHand(false);setMode("HOMEWORK");
    speak("Ya waladi, hold your homework up to the camera now.",async()=>{
      await startCamera("environment");
      setTimeout(async()=>{
        const img=captureFrame();await startCamera("user");
        if(img) askAI({homeworkScan:true,imageB64:img});
        else speak("I could not see it, ya waladi. Try again.",()=>{setWaitingForHand(true);startHandWatch();});
      },2000);
    });
  };

  return(
    <div style={{background:"linear-gradient(180deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",maxWidth:480,margin:"0 auto",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",boxSizing:"border-box",background:"rgba(0,0,0,0.3)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#8dc49a",fontSize:13,cursor:"pointer"}}>← End</button>
        <div style={{fontWeight:"bold",color:"#f0c060",fontSize:14}}>{student.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:isListening?"#4ade80":isSpeaking?"#f0c060":isThinking?"#a78bfa":"#6aaa80",display:"inline-block",boxShadow:isListening?"0 0 6px #4ade80":"none"}}/>
          <span style={{fontSize:11,color:isListening?"#4ade80":isSpeaking?"#f0c060":isThinking?"#a78bfa":"#6aaa80"}}>
            {isListening?"Listening":isSpeaking?"Speaking":isThinking?"Thinking":"Watching"}
          </span>
        </div>
      </div>

      {alertMsg&&<div style={{width:"100%",background:"#922b21",textAlign:"center",padding:"7px",fontSize:13,fontWeight:"bold"}}>{alertMsg}</div>}
      {micError&&<div style={{width:"100%",background:"#7d3c00",textAlign:"center",padding:"7px",fontSize:12}}>{micError}</div>}

      {/* Mic unlock — only shows if not granted */}
      {!micGranted&&(
        <button onClick={requestMic} style={{margin:"8px 14px 0",width:"calc(100% - 28px)",background:"#c0392b",border:"none",borderRadius:14,color:"white",padding:"14px",fontSize:16,fontWeight:"bold",cursor:"pointer",animation:"pulse 1.5s infinite"}}>
          🎤 Tap to activate microphone
        </button>
      )}

      {/* Face + Camera */}
      <div style={{display:"flex",gap:10,padding:"8px 14px 0",width:"100%",boxSizing:"border-box",alignItems:"center"}}>
        <div style={{flexShrink:0}}><Face state={faceState} size={90}/></div>
        <div style={{flex:1,height:90,borderRadius:14,overflow:"hidden",border:`2px solid ${handDetected?"#f0c040":"rgba(255,255,255,0.15)"}`,background:"#000",position:"relative",transition:"border-color 0.3s"}}>
          <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}}/>
          <div style={{position:"absolute",top:4,left:4,background:"rgba(14,77,42,0.85)",borderRadius:7,padding:"2px 7px",fontSize:10,display:"flex",alignItems:"center",gap:3}}>
            <span style={{color:"#4ade80"}}>●</span>Live
          </div>
          {waitingForHand&&<div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",background:"rgba(240,192,64,0.92)",borderRadius:7,padding:"2px 8px",fontSize:10,color:"#000",fontWeight:"bold",whiteSpace:"nowrap"}}>🖐 Raise hand to answer</div>}
        </div>
      </div>
      <canvas ref={canvasRef} style={{display:"none"}}/>

      {/* Blackboard + Mouth */}
      {(blackboard||mouthLetter)&&(
        <div style={{display:"flex",gap:8,padding:"6px 14px 0",width:"100%",boxSizing:"border-box",alignItems:"stretch"}}>
          {blackboard&&<Blackboard content={blackboard}/>}
          {mouthLetter&&<MouthAvatar letterData={mouthLetter} speaking={isSpeaking}/>}
        </div>
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
          <button key={m} onClick={()=>{setMode(m);askAI({text:`[MODE: ${m}] Switch to ${m} mode now.`});}} style={{flex:1,background:mode===m?c:"rgba(255,255,255,0.1)",border:`2px solid ${mode===m?c:"rgba(255,255,255,0.15)"}`,borderRadius:12,color:"white",padding:"9px",fontSize:12,fontWeight:mode===m?"bold":"normal",cursor:"pointer"}}>{l}</button>
        ))}
        <button onClick={doHomework} style={{flex:1,background:"rgba(169,50,38,0.7)",border:"2px solid rgba(169,50,38,0.5)",borderRadius:12,color:"white",padding:"9px",fontSize:12,cursor:"pointer"}}>📝 Homework</button>
      </div>

      <div style={{fontSize:10,color:"#3d7a55",padding:"6px 0 12px",textAlign:"center"}}>🖐 Raise hand to answer · Always listening · No touch needed</div>
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
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={`Notes for Sheikh Noor about ${s?.name}'s next lesson...`} rows={3}
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
  const [student,setStudent]=useState(null);
  const [parentNotes,setParentNotes]=useState(null);
  const [students,setStudents]=useState([]);
  useEffect(()=>{api("GET","/noor/students").then(setStudents).catch(()=>{});},[screen]);
  if(screen==="briefing"&&student) return <ParentBriefing student={student} onStart={n=>{setParentNotes(n);setScreen("class");}}/>;
  if(screen==="class"&&student) return <Classroom student={student} parentNotes={parentNotes} onBack={()=>setScreen("select")}/>;
  if(screen==="dashboard") return <Dashboard students={students} onBack={()=>setScreen("select")}/>;
  return <StudentSelect onSelect={s=>{setStudent(s);setScreen("briefing");}} onDashboard={()=>setScreen("dashboard")}/>;
}
