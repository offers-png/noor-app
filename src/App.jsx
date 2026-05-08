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

// ══════════════════════════════════════════════════════════
//  MOUTH PRONUNCIATION AVATAR
// ══════════════════════════════════════════════════════════
const MOUTH_SHAPES = {
  // Arabic letters with mouth position description
  "أ": { shape: "open_wide", label: "أ • Alif", color: "#f0c060", desc: "Open mouth wide, from throat" },
  "ا": { shape: "open_wide", label: "ا • Alif", color: "#f0c060", desc: "Open mouth wide, from throat" },
  "ب": { shape: "lips_together", label: "ب • Ba", color: "#4ade80", desc: "Press lips together, then open" },
  "ت": { shape: "tongue_top", label: "ت • Ta", color: "#60a5fa", desc: "Tongue touches upper teeth" },
  "ث": { shape: "tongue_between", label: "ث • Tha", color: "#f472b6", desc: "Tongue between teeth" },
  "ج": { shape: "throat", label: "ج • Jim", color: "#a78bfa", desc: "Back of throat, soft" },
  "ح": { shape: "breath_h", label: "ح • Ha", color: "#fb923c", desc: "Breathe from deep throat" },
  "خ": { shape: "throat_rough", label: "خ • Kha", color: "#f87171", desc: "Rough sound from throat" },
  "د": { shape: "tongue_top", label: "د • Dal", color: "#34d399", desc: "Tongue tip to upper teeth" },
  "ر": { shape: "roll_r", label: "ر • Ra", color: "#fbbf24", desc: "Roll the R with tongue" },
  "س": { shape: "teeth_close", label: "س • Sin", color: "#38bdf8", desc: "Teeth close, air flows" },
  "ش": { shape: "lips_round", label: "ش • Shin", color: "#e879f9", desc: "Lips slightly rounded" },
  "ع": { shape: "throat_deep", label: "ع • Ain", color: "#f0c060", desc: "Deep squeeze from throat" },
  "غ": { shape: "throat_gargle", label: "غ • Ghain", color: "#4ade80", desc: "Soft gargle from throat" },
  "ف": { shape: "lip_teeth", label: "ف • Fa", color: "#60a5fa", desc: "Lower lip touches upper teeth" },
  "ق": { shape: "back_throat", label: "ق • Qaf", color: "#f472b6", desc: "Very back of throat" },
  "ك": { shape: "mid_throat", label: "ك • Kaf", color: "#a78bfa", desc: "Middle of throat" },
  "ل": { shape: "tongue_top", label: "ل • Lam", color: "#fb923c", desc: "Tongue to top of mouth" },
  "م": { shape: "lips_together", label: "م • Mim", color: "#f87171", desc: "Close lips, hum through nose" },
  "ن": { shape: "tongue_top", label: "ن • Nun", color: "#34d399", desc: "Tongue to upper teeth, nasal" },
  "ه": { shape: "open_breath", label: "ه • Ha", color: "#fbbf24", desc: "Open mouth, breathe out" },
  "و": { shape: "lips_round", label: "و • Waw", color: "#38bdf8", desc: "Lips form a circle" },
  "ي": { shape: "smile_wide", label: "ي • Ya", color: "#e879f9", desc: "Wide smile position" },
};

// Map shape name to SVG mouth path
function getMouthPath(shape) {
  switch(shape) {
    case "open_wide":    return { upper:"M 30 45 Q 60 30 90 45", lower:"M 30 45 Q 60 80 90 45", fill:"#1a0800", openY:75 };
    case "lips_together":return { upper:"M 25 50 Q 60 44 95 50", lower:"M 25 50 Q 60 56 95 50", fill:"#c05560", openY:50 };
    case "tongue_top":   return { upper:"M 30 44 Q 60 32 90 44", lower:"M 30 44 Q 60 72 90 44", fill:"#1a0800", openY:68, tongue:true };
    case "tongue_between":return{ upper:"M 28 46 Q 60 36 92 46", lower:"M 28 46 Q 60 66 92 46", fill:"#1a0800", openY:66, tongue:true };
    case "throat":
    case "breath_h":
    case "throat_rough":
    case "throat_deep":
    case "throat_gargle":
    case "back_throat":
    case "mid_throat":
    case "open_breath":  return { upper:"M 30 43 Q 60 28 90 43", lower:"M 30 43 Q 60 76 90 43", fill:"#1a0800", openY:76 };
    case "lips_round":   return { upper:"M 35 44 Q 60 36 85 44", lower:"M 35 44 Q 60 72 85 44", fill:"#1a0800", openY:70 };
    case "lip_teeth":    return { upper:"M 28 45 Q 60 35 92 45", lower:"M 28 45 Q 60 65 92 45", fill:"#1a0800", openY:65 };
    case "roll_r":       return { upper:"M 30 44 Q 60 33 90 44", lower:"M 30 44 Q 60 70 90 44", fill:"#1a0800", openY:70 };
    case "teeth_close":  return { upper:"M 28 46 Q 60 38 92 46", lower:"M 28 46 Q 60 60 92 46", fill:"#1a0800", openY:60 };
    case "smile_wide":   return { upper:"M 22 48 Q 60 35 98 48", lower:"M 22 48 Q 60 65 98 48", fill:"#1a0800", openY:65 };
    default:             return { upper:"M 30 45 Q 60 35 90 45", lower:"M 30 45 Q 60 68 90 45", fill:"#1a0800", openY:68 };
  }
}

function MouthAvatar({ letterData, speaking }) {
  const [phase, setPhase] = useState(0); // 0=closed 1=open 2=mid
  useEffect(() => {
    if (!speaking || !letterData) return;
    const t1 = setInterval(() => setPhase(p => (p+1)%3), 180);
    return () => clearInterval(t1);
  }, [speaking, letterData]);

  if (!letterData) return null;
  const mp = getMouthPath(letterData.shape);
  const openAmount = phase===0?0:phase===1?1:0.6;
  const lowerY = mp.openY * openAmount + 50 * (1-openAmount);

  return (
    <div style={{
      background:"linear-gradient(135deg,#1a1a2e,#16213e)",
      borderRadius:20, padding:"12px 16px",
      border:`2px solid ${letterData.color}40`,
      display:"flex", flexDirection:"column", alignItems:"center", gap:8,
      minWidth:140,
    }}>
      {/* Arabic letter large */}
      <div style={{ fontSize:52, color:letterData.color, fontFamily:"serif", lineHeight:1,
        textShadow:`0 0 20px ${letterData.color}60`,
        animation: speaking ? "letterPulse 0.4s ease-in-out infinite alternate" : "none",
      }}>{letterData.label.split("•")[0].trim()}</div>

      {/* Mouth SVG */}
      <svg viewBox="0 0 120 100" width={110} height={90} style={{ background:"#2d1a1a", borderRadius:12, overflow:"hidden" }}>
        {/* Face base */}
        <ellipse cx="60" cy="50" rx="55" ry="45" fill="#FDEBD0"/>
        {/* Upper lip */}
        <path d={mp.upper} stroke="#8b3a3a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* Mouth opening */}
        <path d={`M 30 ${50} Q 60 ${lowerY} 90 ${50} Q 60 ${50} 30 ${50}`} fill={openAmount>0.2?mp.fill:"none"}/>
        {/* Tongue for tongue-touching letters */}
        {mp.tongue && openAmount > 0.3 && (
          <ellipse cx="60" cy={50 + (lowerY-50)*0.4} rx="18" ry="8" fill="#c05560"/>
        )}
        {/* Lower lip */}
        <path d={`M 30 ${50} Q 60 ${lowerY} 90 ${50}`} stroke="#8b3a3a" strokeWidth="3" fill="none" strokeLinecap="round"/>
        {/* Nasal dots for م/ن */}
        {(letterData.shape==="lips_together") && (
          <g><circle cx="44" cy="30" r="4" fill="#c8956a"/><circle cx="76" cy="30" r="4" fill="#c8956a"/></g>
        )}
        {/* Teeth line when open */}
        {openAmount > 0.3 && (
          <line x1="35" y1="50" x2="85" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="8,4"/>
        )}
        {/* Sound waves coming out */}
        {speaking && openAmount > 0.2 && [1,2,3].map(i=>(
          <ellipse key={i} cx="60" cy="50" rx={20+i*12} ry={8+i*5} fill="none"
            stroke={letterData.color} strokeWidth="1" opacity={0.4-i*0.1}>
            <animate attributeName="rx" values={`${20+i*12};${28+i*12};${20+i*12}`} dur="0.6s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values={`${0.4-i*0.1};0;${0.4-i*0.1}`} dur="0.6s" repeatCount="indefinite"/>
          </ellipse>
        ))}
      </svg>

      {/* Label */}
      <div style={{ fontSize:13, color:letterData.color, fontWeight:"bold" }}>{letterData.label}</div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", textAlign:"center", maxWidth:130 }}>{letterData.desc}</div>
      <style>{`@keyframes letterPulse{from{transform:scale(1)}to{transform:scale(1.08)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  BLACKBOARD
// ══════════════════════════════════════════════════════════
function Blackboard({ content }) {
  if (!content) return null;
  return (
    <div style={{
      background:"linear-gradient(135deg,#1a3a1a,#0d2b0d)",
      border:"6px solid #5a3a1a", borderRadius:12, padding:"14px 18px",
      margin:"6px 14px 0", width:"calc(100% - 28px)", boxSizing:"border-box",
      boxShadow:"inset 0 2px 12px rgba(0,0,0,0.5),0 4px 20px rgba(0,0,0,0.4)",
      minHeight:90, position:"relative",
    }}>
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 80% 20%,rgba(255,255,255,0.03) 0%,transparent 60%)",pointerEvents:"none"}}/>
      {content.title&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,textAlign:"center",letterSpacing:2,textTransform:"uppercase"}}>✦ {content.title} ✦</div>}
      {content.lines?.map((line,i)=>(
        <div key={i} style={{marginBottom:i<content.lines.length-1?12:0,textAlign:"center"}}>
          {line.arabic&&<div style={{fontSize:content.type==="arabic_letter"?56:24,color:"#f0e68c",fontFamily:"serif",direction:"rtl",lineHeight:1.4,textShadow:"0 0 20px rgba(240,230,140,0.4)",animation:`chalkIn 0.6s ease-out ${i*0.3}s both`}}>{line.arabic}</div>}
          {line.transliteration&&<div style={{fontSize:14,color:"#a8d8a8",fontStyle:"italic",marginTop:3,animation:`chalkIn 0.6s ease-out ${i*0.3+0.2}s both`}}>{line.transliteration}</div>}
          {line.translation&&<div style={{fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:2,animation:`chalkIn 0.6s ease-out ${i*0.3+0.4}s both`}}>{line.translation}</div>}
          {line.text&&!line.arabic&&<div style={{fontSize:15,color:"#e8e8e8",animation:`chalkIn 0.6s ease-out ${i*0.3}s both`}}>{line.text}</div>}
        </div>
      ))}
      <style>{`@keyframes chalkIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Parse blackboard from teacher text ────────────────────
function parseBlackboard(text) {
  const lower = text.toLowerCase();
  if (lower.includes("al-fatiha")||lower.includes("fatiha")) return {title:"Surah Al-Fatiha",type:"ayah",lines:[
    {arabic:"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",transliteration:"Bismillahi r-rahmani r-raheem",translation:"In the name of Allah, the Most Gracious"},
    {arabic:"الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",transliteration:"Alhamdu lillahi rabbi l-aalameen",translation:"All praise is for Allah, Lord of all worlds"},
  ]};
  if (lower.includes("al-ikhlas")||lower.includes("ikhlas")) return {title:"Surah Al-Ikhlas",type:"ayah",lines:[
    {arabic:"قُلْ هُوَ اللَّهُ أَحَدٌ",transliteration:"Qul huwa Allahu ahad",translation:"Say: He is Allah, the One"},
    {arabic:"اللَّهُ الصَّمَدُ",transliteration:"Allahu s-samad",translation:"Allah, the Eternal Refuge"},
  ]};
  if (lower.includes("al-kawthar")||lower.includes("kawthar")) return {title:"Surah Al-Kawthar",type:"ayah",lines:[
    {arabic:"إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ",transliteration:"Inna a'taynaka l-kawthar",translation:"Indeed, We have granted you Al-Kawthar"},
  ]};
  if (lower.includes("shahada")||lower.includes("kalima")) return {title:"The Shahada",type:"ayah",lines:[
    {arabic:"لَا إِلَٰهَ إِلَّا اللَّهُ",transliteration:"La ilaha illa Allah",translation:"There is no god but Allah"},
    {arabic:"مُحَمَّدٌ رَسُولُ اللَّهِ",transliteration:"Muhammadun rasul Allah",translation:"Muhammad is the messenger of Allah"},
  ]};
  if (lower.includes("bismillah")) return {title:"Bismillah",type:"arabic_letter",lines:[
    {arabic:"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",transliteration:"Bismillahi r-rahmani r-raheem",translation:"In the name of Allah"},
  ]};
  if (lower.includes("alef")||lower.includes("alif")||lower.includes("letter")||lower.includes("alphabet")) return {title:"Arabic Letters",type:"arabic_letter",lines:[
    {arabic:"أ  ب  ت  ث  ج  ح",transliteration:"Alef · Ba · Ta · Tha · Jim · Ha",translation:""},
    {arabic:"خ  د  ذ  ر  ز  س",transliteration:"Kha · Dal · Thal · Ra · Zay · Sin",translation:""},
  ]};
  if (lower.includes("subhanallah")||lower.includes("alhamdulillah")||lower.includes("allahu akbar")) return {title:"Dhikr",type:"ayah",lines:[
    {arabic:"سُبْحَانَ اللَّهِ",transliteration:"SubhanAllah",translation:"Glory be to Allah"},
    {arabic:"الْحَمْدُ لِلَّهِ",transliteration:"Alhamdulillah",translation:"All praise to Allah"},
    {arabic:"اللَّهُ أَكْبَرُ",transliteration:"Allahu Akbar",translation:"Allah is the Greatest"},
  ]};
  if (lower.includes("eat")||lower.includes("food")) return {title:"Dua Before Eating",type:"ayah",lines:[
    {arabic:"بِسْمِ اللَّهِ",transliteration:"Bismillah",translation:"In the name of Allah"},
  ]};
  if (lower.includes("sleep")||lower.includes("bed")) return {title:"Dua Before Sleeping",type:"ayah",lines:[
    {arabic:"بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",transliteration:"Bismika Allahumma amutu wa ahya",translation:"In Your name O Allah, I die and I live"},
  ]};
  const arabicMatches=text.match(/[\u0600-\u06FF]+/g);
  if(arabicMatches?.length>0) return {title:"On the Board",type:"ayah",lines:[{arabic:arabicMatches.slice(0,4).join("  ·  ")}]};
  return null;
}

// ── Detect which Arabic letter teacher is saying ──────────
function detectLetter(text) {
  const map = {
    "alif":  "أ","alef": "أ","elif": "أ",
    " ba ":  "ب","baa":  "ب",
    " ta ":  "ت","taa":  "ت",
    "tha":   "ث","thaa": "ث",
    "jim":   "ج","jeem": "ج",
    " ha ":  "ح","haa":  "ح",
    "kha":   "خ","khaa": "خ",
    "dal":   "د","daal": "د",
    " ra ":  "ر","raa":  "ر",
    "sin":   "س","seen": "س",
    "shin":  "ش","sheen":"ش",
    "ain":   "ع","ayn":  "ع",
    "ghain": "غ","ghayn":"غ",
    " fa ":  "ف","faa":  "ف",
    "qaf":   "ق","qaaf": "ق",
    "kaf":   "ك","kaaf": "ك",
    "lam":   "ل",
    "mim":   "م","meem": "م",
    "nun":   "ن","noon": "ن",
    " ha":   "ه",
    "waw":   "و","wow":  "و",
    "yaa":   "ي","ya":   "ي",
  };
  const lower=" "+text.toLowerCase()+" ";
  for(const [key,letter] of Object.entries(map)){
    if(lower.includes(key)) return MOUTH_SHAPES[letter]?{...MOUTH_SHAPES[letter],letter}:null;
  }
  return null;
}

// ── Face SVG ──────────────────────────────────────────────
function Face({ state, size=100 }) {
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
//  SCREEN 1 — Student Select
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
    try{const s=await api("POST","/noor/students",{name:name.trim(),age:age?parseInt(age):null,level:"beginner"});setStudents(p=>[...p,s]);setName("");setAge("");setAdding(false);}catch(e){}
    setSaving(false);
  };
  return(
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
  const [notes,setNotes]=useState(""), [topics,setTopics]=useState([]), [saving,setSaving]=useState(false);
  const topicOptions=["Arabic Letters","Quran Recitation","Surah Memorization","Islamic Stories","Duas","Tajweed","Pillars of Islam"];
  const toggle=t=>setTopics(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const submit=async()=>{
    setSaving(true);
    try{if(notes.trim()) await api("POST","/noor/parent-notes",{student_id:student.id,notes:notes.trim(),focus_topics:topics});onStart(notes.trim()||null);}
    catch(e){onStart(null);}setSaving(false);
  };
  return(
    <div style={{background:"linear-gradient(160deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",padding:24,gap:20}}>
      <div style={{textAlign:"center",marginTop:10}}><div style={{fontSize:32}}>📋</div><div style={{fontSize:22,fontWeight:"bold",color:"#f0c060"}}>Today's Lesson Plan</div><div style={{fontSize:14,color:"#a8d8b0",marginTop:4}}>For {student.name}</div></div>
      <div style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:14}}>
        <div><div style={{fontSize:13,color:"#8dc49a",marginBottom:8}}>Focus topics:</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{topicOptions.map(t=><button key={t} onClick={()=>toggle(t)} style={{background:topics.includes(t)?"#1a7a40":"rgba(255,255,255,0.08)",border:`1px solid ${topics.includes(t)?"#1a7a40":"rgba(255,255,255,0.2)"}`,borderRadius:20,padding:"6px 14px",color:"white",fontSize:13,cursor:"pointer"}}>{t}</button>)}</div></div>
        <div><div style={{fontSize:13,color:"#8dc49a",marginBottom:8}}>Notes for Ustadha Noor:</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={`e.g. "${student.name} is working on Al-Fatiha. She keeps making mistakes on Ayah 5."`} rows={4}
            style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:14,padding:"12px 14px",color:"white",fontSize:14,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.5}}/>
        </div>
        <button onClick={submit} disabled={saving} style={{background:"linear-gradient(135deg,#1a7a40,#0e4d2a)",border:"none",borderRadius:20,color:"white",padding:"18px",fontSize:18,fontWeight:"bold",cursor:"pointer"}}>{saving?"Starting...":`▶ Start ${student.name}'s Class`}</button>
        <button onClick={()=>onStart(null)} style={{background:"transparent",border:"none",color:"#6aaa80",fontSize:13,cursor:"pointer"}}>Skip</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 3 — CLASSROOM (no touch, always listening)
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
  const [lessonId,setLessonId]=useState(null);
  const [sessionId,setSessionId]=useState(null);
  const [cheatingCount,setCheatingCount]=useState(0);
  const [blackboard,setBlackboard]=useState(null);
  const [mouthLetter,setMouthLetter]=useState(null);
  const [micStatus,setMicStatus]=useState("locked"); // locked until first tap

  const videoRef=useRef(null);
  const canvasRef=useRef(null);
  const streamRef=useRef(null);
  const synthRef=useRef(window.speechSynthesis);
  const recRef=useRef(null);
  const historyRef=useRef([]);
  const busyRef=useRef(false);
  const visionRef=useRef(null);
  const handRef=useRef(null);
  const modeRef=useRef("TEACHING");
  const lessonIdRef=useRef(null);
  const sessionIdRef=useRef(null);
  const cheatingRef=useRef(0);
  const waitingRef=useRef(false);
  const listeningRef=useRef(false);
  const speakingRef=useRef(false);

  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{busyRef.current=isThinking||isSpeaking;},[isThinking,isSpeaking]);
  useEffect(()=>{lessonIdRef.current=lessonId;},[lessonId]);
  useEffect(()=>{sessionIdRef.current=sessionId;},[sessionId]);
  useEffect(()=>{cheatingRef.current=cheatingCount;},[cheatingCount]);
  useEffect(()=>{waitingRef.current=waitingForHand;},[waitingForHand]);
  useEffect(()=>{listeningRef.current=isListening;},[isListening]);
  useEffect(()=>{speakingRef.current=isSpeaking;},[isSpeaking]);

  // ── Camera ─────────────────────────────────────────────
  const startCamera=useCallback(async(facing="user")=>{
    try{
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:480},height:{ideal:360}},audio:false});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
    }catch(e){console.log("cam",e);}
  },[]);

  const captureFrame=useCallback(()=>{
    const v=videoRef.current,c=canvasRef.current;
    if(!v||!c||v.videoWidth===0) return null;
    c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0);
    return c.toDataURL("image/jpeg",0.5).split(",")[1];
  },[]);

  const saveTranscript=useCallback((speaker,message)=>{
    if(!lessonIdRef.current) return;
    api("POST","/noor/transcript/add",{lesson_id:lessonIdRef.current,student_id:student.id,session_id:sessionIdRef.current,speaker,message,mode:modeRef.current}).catch(()=>{});
  },[student]);

  // ── TTS ────────────────────────────────────────────────
  const speak=useCallback((text,onDone)=>{
    synthRef.current.cancel();
    const clean=text.replace(/[*_#~`]/g,"").replace(/\n+/g," ").trim();
    if(!clean){onDone?.();return;}
    saveTranscript("teacher",clean);
    const board=parseBlackboard(clean);
    if(board) setBlackboard(board);
    const letter=detectLetter(clean);
    if(letter) setMouthLetter(letter);

    const utt=new SpeechSynthesisUtterance(clean);
    utt.rate=0.87;utt.pitch=1.18;
    const voices=synthRef.current.getVoices();
    const v=voices.find(v=>/Samantha|Karen|Zira|Serena|Google UK English Female/i.test(v.name))||voices.find(v=>v.lang.startsWith("en"))||voices[0];
    if(v) utt.voice=v;
    utt.onstart=()=>{setIsSpeaking(true);speakingRef.current=true;setFaceState("speaking");};
    utt.onend=()=>{setIsSpeaking(false);speakingRef.current=false;setFaceState("watching");onDone?.();};
    utt.onerror=()=>{setIsSpeaking(false);speakingRef.current=false;setFaceState("watching");onDone?.();};
    synthRef.current.speak(utt);
  },[saveTranscript]);

  // ── AI call ────────────────────────────────────────────
  const askAI=useCallback(async({text,imageB64,visionAlert,homeworkScan})=>{
    if(busyRef.current&&!visionAlert) return;
    setIsThinking(true);setFaceState("thinking");
    let msg=text||"";
    if(visionAlert) msg=`[VISION: ${visionAlert}]`;
    if(homeworkScan) msg="[HOMEWORK SCAN] Read and grade this homework carefully.";
    try{
      const data=await api("POST","/noor/chat",{student_id:student.id,lesson_id:lessonIdRef.current,message:msg,image_b64:imageB64||null,mode:modeRef.current,history:historyRef.current.slice(-14)});
      const reply=data.reply;
      historyRef.current=[...historyRef.current,{role:"user",content:msg},{role:"assistant",content:reply}].slice(-18);
      setIsThinking(false);setBubble(reply);
      speak(reply,()=>{
        setWaitingForHand(true);
        startHandWatch();
        // Also restart continuous listen after teacher speaks
        setTimeout(()=>startContinuousListen(),300);
      });
    }catch(e){
      setIsThinking(false);setFaceState("watching");
      if(!visionAlert){speak("Sorry, let me try again!",()=>{setWaitingForHand(true);startHandWatch();startContinuousListen();});}
    }
  },[student,speak]);

  // ── CONTINUOUS LISTEN — single persistent instance ────
  const startContinuousListen=useCallback(()=>{
    if(micStatus==="locked") return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){ setCaption("Voice not supported — use Chrome"); return; }

    // Kill any existing instance first
    if(recRef.current){
      try{ recRef.current.onend=null; recRef.current.onerror=null; recRef.current.onresult=null; recRef.current.abort(); }catch(e){}
    }

    const rec=new SR();
    rec.lang="en-US";
    rec.interimResults=true;
    rec.continuous=true; // KEY: one instance runs forever
    rec.maxAlternatives=1;
    recRef.current=rec;
    let finalBuffer="";
    let sendTimer=null;

    const sendIfReady=()=>{
      const said=finalBuffer.trim();
      if(said.length<2) return;
      finalBuffer="";
      clearTimeout(sendTimer);
      if(speakingRef.current||busyRef.current) return; // ignore if teacher speaking
      setCaption(said);
      saveTranscript("student",said);
      const img=captureFrame();
      setHandDetected(false);setWaitingForHand(false);
      clearInterval(handRef.current);
      askAI({text:said,imageB64:img});
    };

    rec.onstart=()=>{
      listeningRef.current=true;
      setIsListening(true);
      setMicStatus("on");
      setFaceState(f=>speakingRef.current?f:"listening");
    };

    rec.onresult=e=>{
      if(speakingRef.current||busyRef.current) return; // teacher talking — ignore
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal){
          finalBuffer+=e.results[i][0].transcript+" ";
          clearTimeout(sendTimer);
          sendTimer=setTimeout(sendIfReady,800); // wait 0.8s after final result
        } else {
          interim=e.results[i][0].transcript;
        }
      }
      if(interim&&!speakingRef.current) setCaption(interim);
    };

    rec.onend=()=>{
      listeningRef.current=false;
      setIsListening(false);
      // Auto-restart unless teacher is speaking or we're thinking
      if(!speakingRef.current&&!busyRef.current&&micStatus!=="locked"){
        setTimeout(()=>startContinuousListen(),300);
      }
    };

    rec.onerror=e=>{
      listeningRef.current=false;
      setIsListening(false);
      if(e.error==="not-allowed"){
        setMicStatus("locked");
        setCaption("❌ Mic blocked — click 🔒 in address bar → Allow Microphone");
        return;
      }
      if(e.error!=="no-speech"&&e.error!=="aborted") console.log("SR:",e.error);
      // Restart
      if(!speakingRef.current&&!busyRef.current&&micStatus!=="locked"){
        setTimeout(()=>startContinuousListen(),500);
      }
    };

    try{ rec.start(); }
    catch(e){
      listeningRef.current=false;
      setTimeout(()=>startContinuousListen(),1000);
    }
  },[captureFrame,askAI,saveTranscript,micStatus]);

  // ── Hand raise watch ───────────────────────────────────
  const startHandWatch=useCallback(()=>{
    clearInterval(handRef.current);
    let busy=false;
    handRef.current=setInterval(async()=>{
      if(!waitingRef.current||speakingRef.current||busy) return;
      busy=true;
      const img=captureFrame();
      if(!img){busy=false;return;}
      try{
        // More lenient prompt — detects any upward arm/hand movement
        const res=await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":"","anthropic-version":"2023-06-01"},
        });
        // Use backend hand-raise endpoint
        const data=await api("POST","/noor/hand-raise",{
          student_id:student.id,
          lesson_id:lessonIdRef.current,
          session_id:sessionIdRef.current,
          image_b64:img
        });
        if(data.raised){
          clearInterval(handRef.current);
          setHandDetected(true);setWaitingForHand(false);
          // Pause mic
          try{recRef.current?.abort();}catch(e){}
          listeningRef.current=false;setIsListening(false);
          const callOn=`Ahsant! Yes, ya waladi! Go ahead.`;
          setBubble(callOn+" 🎤");
          speak(callOn,()=>setTimeout(()=>startContinuousListen(),300));
        }
      }catch(e){}
      busy=false;
    },1500);
  },[student,captureFrame,speak,startContinuousListen]);

  // ── Vision / attention ─────────────────────────────────
  const startVision=useCallback(()=>{
    clearInterval(visionRef.current);
    let busy=false;
    visionRef.current=setInterval(async()=>{
      if(speakingRef.current||listeningRef.current||busyRef.current||busy) return;
      busy=true;
      const img=captureFrame();
      if(!img){busy=false;return;}
      try{
        const data=await api("POST","/noor/vision",{student_id:student.id,lesson_id:lessonIdRef.current,session_id:sessionIdRef.current,image_b64:img,mode:modeRef.current});
        if(data.teacher_response){
          if(data.event_type==="cheating"){setCheatingCount(p=>p+1);setAlertMsg("👀 Ustadha Noor sees you!");}
          else if(data.event_type==="distracted") setAlertMsg("⚠️ Pay attention!");
          setTimeout(()=>setAlertMsg(""),3000);
          recRef.current?.stop?.();listeningRef.current=false;
          clearInterval(handRef.current);setWaitingForHand(false);
          setBubble(data.teacher_response);
          speak(data.teacher_response,()=>{setWaitingForHand(true);startHandWatch();startContinuousListen();});
        }
      }catch(e){}
      busy=false;
    },10000);
  },[student,captureFrame,speak,startHandWatch,startContinuousListen]);

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
      }catch(e){}
      const briefing=parentNotes
        ?`[PARENT BRIEFING] Parent says: "${parentNotes}". Follow this plan exactly. Do NOT ask the child what they want to learn. Do NOT ask for their name. Greet ${student.name} by name, announce exactly what you will teach today based on parent notes, then immediately start teaching. End with "Raise your hand when you are ready!"`
        :`[CLASS STARTING] Greet ${student.name} by name. You are in charge. Do NOT ask what they want to learn. Do NOT ask questions yet. Choose a topic for today based on level (${student.level}). Say "Today we are going to learn [specific topic]" then immediately start teaching it. End your opening with "Raise your hand when you are ready to answer!"`;
      setIsThinking(true);setFaceState("thinking");
      try{
        const data=await api("POST","/noor/chat",{student_id:student.id,lesson_id:lid,message:briefing,mode:"TEACHING",history:[]});
        const reply=data.reply;
        historyRef.current=[{role:"user",content:"[CLASS STARTING]"},{role:"assistant",content:reply}];
        setIsThinking(false);setBubble(reply);
        speak(reply,()=>{setWaitingForHand(true);startHandWatch();startVision();startContinuousListen();});
      }catch(e){
        setIsThinking(false);
        const fb=`Assalamu Alaikum ${student.name}! Today we are going to learn Surah Al-Ikhlas. Listen carefully! 🌙 Raise your hand when you are ready!`;
        setBubble(fb);speak(fb,()=>{setWaitingForHand(true);startHandWatch();startVision();startContinuousListen();});
      }
    };
    init();
    return()=>{
      clearInterval(visionRef.current);clearInterval(handRef.current);
      synthRef.current.cancel();recRef.current?.stop?.();
      streamRef.current?.getTracks().forEach(t=>t.stop());
      if(lid||lessonIdRef.current){
        const lId=lid||lessonIdRef.current,sId=sid||sessionIdRef.current;
        if(sId) api("POST","/noor/session/end",{session_id:sId,lesson_id:lId,student_id:student.id,cheating_attempts:cheatingRef.current}).catch(()=>{});
        api("POST","/noor/lesson/end",{lesson_id:lId,student_id:student.id,topics_covered:[]}).catch(()=>{});
      }
    };
  },[]);

  const doHomework=async()=>{
    clearInterval(handRef.current);setWaitingForHand(false);setMode("HOMEWORK");recRef.current?.stop?.();
    speak("Hold your homework up to the camera now!",async()=>{
      await startCamera("environment");
      setTimeout(async()=>{
        const img=captureFrame();await startCamera("user");
        if(img) askAI({homeworkScan:true,imageB64:img});
        else speak("I couldn't see it. Try again!",()=>{setWaitingForHand(true);startHandWatch();startContinuousListen();});
      },2000);
    });
  };

  return(
    <div style={{background:"linear-gradient(180deg,#051a0d,#0d3320)",minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',Arial,sans-serif",color:"white",maxWidth:480,margin:"0 auto",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",boxSizing:"border-box",background:"rgba(0,0,0,0.3)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#8dc49a",fontSize:13,cursor:"pointer"}}>← End</button>
        <div style={{fontWeight:"bold",color:"#f0c060",fontSize:14}}>{student.name}</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:isListening?"#4ade80":isSpeaking?"#f0c060":"#6aaa80",display:"inline-block",boxShadow:isListening?"0 0 6px #4ade80":"none"}}/>
          <span style={{fontSize:11,color:isListening?"#4ade80":isSpeaking?"#f0c060":"#6aaa80"}}>
            {isListening?"Listening":isSpeaking?"Speaking":isThinking?"Thinking":"Watching"}
          </span>
        </div>
      </div>

      {alertMsg&&<div style={{width:"100%",background:"#922b21",textAlign:"center",padding:"7px",fontSize:13,fontWeight:"bold"}}>{alertMsg}</div>}

      {/* Face + Camera */}
      <div style={{display:"flex",gap:10,padding:"8px 14px 0",width:"100%",boxSizing:"border-box",alignItems:"center"}}>
        <div style={{flexShrink:0}}><Face state={faceState} size={95}/></div>
        <div style={{flex:1,height:95,borderRadius:14,overflow:"hidden",border:`2px solid ${handDetected?"#f0c040":"rgba(255,255,255,0.15)"}`,background:"#000",position:"relative",transition:"border-color 0.3s"}}>
          <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)"}}/>
          <div style={{position:"absolute",top:4,left:4,background:"rgba(14,77,42,0.85)",borderRadius:8,padding:"2px 7px",fontSize:10,display:"flex",alignItems:"center",gap:3}}>
            <span style={{color:"#4ade80"}}>●</span>Live
          </div>
          {waitingForHand&&!isListening&&(
            <div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",background:"rgba(240,192,64,0.92)",borderRadius:8,padding:"2px 8px",fontSize:10,color:"#000",fontWeight:"bold",whiteSpace:"nowrap"}}>
              🖐 Raise hand to answer
            </div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{display:"none"}}/>

      {/* Blackboard + Mouth Avatar side by side */}
      <div style={{display:"flex",gap:8,padding:"6px 14px 0",width:"100%",boxSizing:"border-box",alignItems:"flex-start"}}>
        {blackboard&&(
          <div style={{flex:1,background:"linear-gradient(135deg,#1a3a1a,#0d2b0d)",border:"5px solid #5a3a1a",borderRadius:10,padding:"10px 12px",boxShadow:"inset 0 2px 10px rgba(0,0,0,0.5)",minHeight:80}}>
            {blackboard.title&&<div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginBottom:6,textAlign:"center",letterSpacing:1,textTransform:"uppercase"}}>✦ {blackboard.title} ✦</div>}
            {blackboard.lines?.map((line,i)=>(
              <div key={i} style={{marginBottom:6,textAlign:"center"}}>
                {line.arabic&&<div style={{fontSize:blackboard.type==="arabic_letter"?28:18,color:"#f0e68c",fontFamily:"serif",direction:"rtl",lineHeight:1.3}}>{line.arabic}</div>}
                {line.transliteration&&<div style={{fontSize:10,color:"#a8d8a8",fontStyle:"italic",marginTop:2}}>{line.transliteration}</div>}
                {line.translation&&<div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:1}}>{line.translation}</div>}
              </div>
            ))}
          </div>
        )}
        {mouthLetter&&(
          <MouthAvatar letterData={mouthLetter} speaking={isSpeaking}/>
        )}
      </div>

      {/* Speech bubble */}
      <div style={{margin:"6px 14px 0",width:"calc(100% - 28px)",boxSizing:"border-box",background:"rgba(255,255,255,0.96)",borderRadius:16,padding:"10px 14px",minHeight:60,maxHeight:110,overflowY:"auto"}}>
        <div style={{fontSize:14,color:"#0d2818",lineHeight:1.5,whiteSpace:"pre-wrap"}}>
          {isThinking?<span style={{color:"#1a7a40"}}>🤔 Thinking...</span>:bubble}
        </div>
      </div>

      {/* Caption */}
      {caption&&(
        <div style={{margin:"4px 14px 0",width:"calc(100% - 28px)",boxSizing:"border-box",background:"rgba(0,0,0,0.5)",borderRadius:10,padding:"5px 12px",fontSize:13,color:"#d0f0dc",fontStyle:"italic"}}>
          {caption}
        </div>
      )}

      {/* Mode buttons — for parent setup only */}
      <div style={{display:"flex",gap:8,padding:"8px 14px 0",width:"100%",boxSizing:"border-box"}}>
        {[["TEACHING","📚 Lesson","#1a7a40"],["RECITATION","🕌 Recite","#7d3c98"]].map(([m,l,c])=>(
          <button key={m} onClick={()=>{setMode(m);askAI({text:`[MODE: ${m}] Switch to ${m} mode and lead the child.`});}} style={{flex:1,background:mode===m?c:"rgba(255,255,255,0.1)",border:`2px solid ${mode===m?c:"rgba(255,255,255,0.15)"}`,borderRadius:12,color:"white",padding:"9px",fontSize:12,fontWeight:mode===m?"bold":"normal",cursor:"pointer"}}>{l}</button>
        ))}
        <button onClick={doHomework} style={{flex:1,background:"rgba(169,50,38,0.7)",border:"2px solid rgba(169,50,38,0.5)",borderRadius:12,color:"white",padding:"9px",fontSize:12,cursor:"pointer"}}>📝 Homework</button>
      </div>

      {/* One-time mic unlock button — disappears after first tap */}
      {micStatus==="locked"&&(
        <button onClick={()=>{setMicStatus("idle");startContinuousListen();}} style={{
          margin:"8px 14px 0",width:"calc(100% - 28px)",
          background:"#1a7a40",border:"none",borderRadius:16,
          color:"white",padding:"14px",fontSize:16,fontWeight:"bold",cursor:"pointer",
          boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
          animation:"pulse 1.5s infinite",
        }}>
          👆 Tap once to activate microphone
        </button>
      )}

      <div style={{fontSize:10,color:"#3d7a55",padding:"6px 0 12px",textAlign:"center"}}>
        🖐 Raise hand to answer · No touch needed · Always listening
      </div>
      <style>{`@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(26,122,64,0.5)}70%{box-shadow:0 0 0 14px rgba(26,122,64,0)}100%{box-shadow:0 0 0 0 rgba(26,122,64,0)}}`}</style>
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

  const loadTranscript=async lid=>{setView("transcript");const t=await api("GET",`/noor/transcript/${lid}`).catch(()=>[]);setTranscript(t);};
  const saveNotes=async()=>{
    if(!notes.trim()||!sel) return; setSavingNotes(true);
    try{await api("POST","/noor/parent-notes",{student_id:sel,notes:notes.trim(),focus_topics:[]});setNotes("");}catch(e){}setSavingNotes(false);
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
                <div style={{fontSize:18,flexShrink:0}}>{t.speaker==="teacher"?"👩‍🏫":"🧒"}</div>
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
            <button onClick={saveNotes} disabled={savingNotes||!notes.trim()} style={{marginTop:8,background:"#1a7a40",border:"none",borderRadius:10,color:"white",padding:"8px 20px",fontSize:13,fontWeight:"bold",cursor:"pointer",opacity:notes.trim()?1:0.5}}>{savingNotes?"Saving...":"Save for Next Class"}</button>
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
  useEffect(()=>{api("GET","/noor/students").then(setStudents).catch(()=>{});},[screen]);
  if(screen==="briefing"&&student) return <ParentBriefing student={student} onStart={n=>{setParentNotes(n);setScreen("class");}}/>;
  if(screen==="class"&&student) return <Classroom student={student} parentNotes={parentNotes} onBack={()=>setScreen("select")}/>;
  if(screen==="dashboard") return <Dashboard students={students} onBack={()=>setScreen("select")}/>;
  return <StudentSelect onSelect={s=>{setStudent(s);setScreen("briefing");}} onDashboard={()=>setScreen("dashboard")}/>;
}
