import { useState, useRef, useEffect, useCallback } from "react";

const API = "https://main-backend-k32m.onrender.com";

// ── Helpers ───────────────────────────────────────────────
const api = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// ── Face SVG ──────────────────────────────────────────────
function Face({ state, size = 140 }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (state === "thinking") return;
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    }, 2800 + Math.random() * 1500);
    return () => clearInterval(t);
  }, [state]);
  const eyeRy = blink ? 1.5 : 12;
  const eyeY = 100;
  return (
    <svg viewBox="0 0 200 230" width={size} height={size} style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.4))" }}>
      <ellipse cx="100" cy="140" rx="88" ry="98" fill="#0e4d2a" />
      <rect x="82" y="172" width="36" height="30" rx="7" fill="#FDEBD0" />
      <ellipse cx="100" cy="118" rx="65" ry="70" fill="#FDEBD0" />
      <ellipse cx="100" cy="68" rx="67" ry="36" fill="#0e4d2a" />
      <ellipse cx="100" cy="74" rx="60" ry="30" fill="#1a7a40" />
      <path d="M35 125 Q18 162 40 200 Q68 178 82 172" fill="#0e4d2a" />
      <path d="M165 125 Q182 162 160 200 Q132 178 118 172" fill="#0e4d2a" />
      <ellipse cx="76" cy={eyeY} rx="14" ry={eyeRy} fill="white" />
      {!blink && <circle cx={76+(state==="listening"?-4:0)} cy={eyeY} r={8} fill="#1a0800"/>}
      {!blink && <circle cx={78} cy={eyeY-3} r={2.5} fill="white"/>}
      <ellipse cx="124" cy={eyeY} rx="14" ry={eyeRy} fill="white" />
      {!blink && <circle cx={124+(state==="listening"?-4:0)} cy={eyeY} r={8} fill="#1a0800"/>}
      {!blink && <circle cx={126} cy={eyeY-3} r={2.5} fill="white"/>}
      {state==="thinking" && !blink && [[76,eyeY],[124,eyeY]].map(([cx,cy],i)=>(
        <g key={i}><circle cx={cx-5} cy={cy} r={4} fill="#1a0800"/><circle cx={cx+5} cy={cy} r={4} fill="#1a0800"/></g>
      ))}
      <path d="M62 65 Q76 59 90 63" stroke="#3a1500" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M110 63 Q124 59 138 65" stroke="#3a1500" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M96 118 Q93 128 90 133 Q100 136 110 133 Q107 128 104 118" fill="none" stroke="#c8956a" strokeWidth="1.2"/>
      {state==="speaking"
        ? <><path d="M83 148 Q100 142 117 148" stroke="#b84c52" strokeWidth="2" fill="none"/>
            <ellipse cx="100" cy="154" rx="17" ry="9" fill="#7a1f25"/>
            <ellipse cx="100" cy="157" rx="12" ry="5.5" fill="#c05560"/></>
        : state==="thinking"
        ? <path d="M87 152 Q100 150 113 152" stroke="#b84c52" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        : <path d="M83 148 Q100 160 117 148" stroke="#b84c52" strokeWidth="3" fill="none" strokeLinecap="round"/>}
      <ellipse cx="65" cy="128" rx="12" ry="8" fill="#f4a0a0" opacity="0.35"/>
      <ellipse cx="135" cy="128" rx="12" ry="8" fill="#f4a0a0" opacity="0.35"/>
      {state==="thinking" && [0,1,2].map(i=>(
        <circle key={i} cx={152+i*14} cy={60-i*12} r={5+i*2} fill="#1a7a40" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.1;0.9" dur="0.9s" begin={`${i*0.3}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      {state==="listening" && [28,172].map((cx,i)=>(
        <circle key={i} cx={cx} cy="118" r="8" fill="none" stroke="#1a7a40" strokeWidth="2.5">
          <animate attributeName="r" values="5;16;5" dur="1.1s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.1s" repeatCount="indefinite"/>
        </circle>
      ))}
      {state==="watching" && [76,124].map((cx,i)=>(
        <circle key={i} cx={cx} cy={eyeY} r={15} fill="none" stroke="#f0c040" strokeWidth="1.5" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.05;0.5" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
}

// ── Waveform ──────────────────────────────────────────────
function Waveform({ active }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:3, height:24 }}>
      {[0.4,0.7,1,0.8,0.5,0.9,0.6,0.4,0.75,0.5].map((h,i)=>(
        <div key={i} style={{
          width:3, borderRadius:4,
          background: active ? "#4ade80" : "rgba(255,255,255,0.2)",
          height: active ? `${h*24}px` : "3px",
          transition:"height 0.15s",
          animation: active ? `wave ${0.6+i*0.07}s ease-in-out infinite alternate` : "none",
        }}/>
      ))}
      <style>{`@keyframes wave{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 1 — Student Select
// ══════════════════════════════════════════════════════════
function StudentSelect({ onSelect, onDashboard }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("GET", "/noor/students").then(setStudents).catch(()=>setStudents([])).finally(()=>setLoading(false));
  }, []);

  const addStudent = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const s = await api("POST", "/noor/students", { name: name.trim(), age: age ? parseInt(age) : null, level: "beginner" });
      setStudents(prev => [...prev, s]);
      setName(""); setAge(""); setAdding(false);
    } catch(e) {}
    setSaving(false);
  };

  const avatars = ["🧒","👦","👧","🧒‍♀️","👶","🧑"];

  return (
    <div style={{
      background:"linear-gradient(160deg,#051a0d,#0d3320)",
      minHeight:"100dvh", display:"flex", flexDirection:"column",
      alignItems:"center", fontFamily:"'Segoe UI',Arial,sans-serif",
      color:"white", padding:24, gap:20,
    }}>
      <div style={{ textAlign:"center", marginTop:20 }}>
        <Face state="idle" size={100}/>
        <div style={{ fontSize:26, fontWeight:"bold", color:"#f0c060", marginTop:8 }}>✨ Ustadha Noor</div>
        <div style={{ fontSize:14, color:"#a8d8b0" }}>Who is learning today?</div>
      </div>

      {loading ? <div style={{ color:"#6aaa80" }}>Loading...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:380 }}>
          {students.map((s,i) => (
            <button key={s.id} onClick={() => onSelect(s)} style={{
              background:"rgba(255,255,255,0.08)", border:"2px solid rgba(255,255,255,0.15)",
              borderRadius:20, padding:"16px 20px", display:"flex", alignItems:"center", gap:14,
              cursor:"pointer", color:"white", textAlign:"left",
              transition:"all 0.2s",
            }}>
              <span style={{ fontSize:36 }}>{avatars[i % avatars.length]}</span>
              <div>
                <div style={{ fontSize:20, fontWeight:"bold" }}>{s.name}</div>
                <div style={{ fontSize:13, color:"#8dc49a" }}>Age {s.age || "?"} · {s.level}</div>
              </div>
              <div style={{ marginLeft:"auto", fontSize:24 }}>▶</div>
            </button>
          ))}

          {!adding ? (
            <button onClick={() => setAdding(true)} style={{
              background:"rgba(26,122,64,0.3)", border:"2px dashed rgba(26,122,64,0.6)",
              borderRadius:20, padding:"14px", color:"#4ade80",
              fontSize:16, cursor:"pointer", fontWeight:"bold",
            }}>+ Add Student</button>
          ) : (
            <div style={{
              background:"rgba(255,255,255,0.08)", border:"2px solid rgba(255,255,255,0.15)",
              borderRadius:20, padding:20, display:"flex", flexDirection:"column", gap:10,
            }}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Child's name"
                style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)",
                  borderRadius:10, padding:"10px 14px", color:"white", fontSize:16, outline:"none" }}/>
              <input value={age} onChange={e=>setAge(e.target.value)} placeholder="Age (optional)" type="number"
                style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)",
                  borderRadius:10, padding:"10px 14px", color:"white", fontSize:16, outline:"none" }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={addStudent} disabled={saving} style={{
                  flex:1, background:"#1a7a40", border:"none", borderRadius:10,
                  color:"white", padding:"10px", fontSize:15, fontWeight:"bold", cursor:"pointer",
                }}>{saving ? "Saving..." : "✓ Add"}</button>
                <button onClick={() => setAdding(false)} style={{
                  flex:1, background:"rgba(255,255,255,0.1)", border:"none", borderRadius:10,
                  color:"white", padding:"10px", fontSize:15, cursor:"pointer",
                }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {students.length > 0 && (
        <button onClick={onDashboard} style={{
          background:"transparent", border:"1px solid rgba(255,255,255,0.2)",
          borderRadius:20, padding:"8px 20px", color:"#8dc49a", fontSize:13, cursor:"pointer", marginTop:8,
        }}>📊 Parent Dashboard</button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 2 — Classroom (main AI teacher)
// ══════════════════════════════════════════════════════════
function Classroom({ student, onBack }) {
  const [faceState, setFaceState] = useState("idle");
  const [bubble, setBubble] = useState("Starting class...");
  const [caption, setCaption] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [mode, setMode] = useState("TEACHING");
  const [alertMsg, setAlertMsg] = useState("");
  const [lessonId, setLessonId] = useState(null);
  const [topics, setTopics] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const recRef = useRef(null);
  const historyRef = useRef([]);
  const busyRef = useRef(false);
  const visionRef = useRef(null);
  const listeningRef = useRef(false);
  const transcriptRef = useRef("");
  const modeRef = useRef("TEACHING");
  const lessonIdRef = useRef(null);
  const topicsRef = useRef([]);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { busyRef.current = isThinking || isSpeaking; }, [isThinking, isSpeaking]);
  useEffect(() => { lessonIdRef.current = lessonId; }, [lessonId]);
  useEffect(() => { topicsRef.current = topics; }, [topics]);

  // ── Camera ─────────────────────────────────────────────
  const startCamera = useCallback(async (facing = "user") => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width:{ideal:480}, height:{ideal:360} }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch(e) { console.log("cam", e); }
  }, []);

  const captureFrame = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0) return null;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.55).split(",")[1];
  }, []);

  // ── TTS ────────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    synthRef.current.cancel();
    const clean = text.replace(/[*_#~`]/g,"").replace(/\n+/g," ").trim();
    if (!clean) { onDone?.(); return; }
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 0.87; utt.pitch = 1.18;
    const voices = synthRef.current.getVoices();
    const v = voices.find(v=>/Samantha|Karen|Zira|Serena|Google UK English Female/i.test(v.name))
      || voices.find(v=>v.lang.startsWith("en")) || voices[0];
    if (v) utt.voice = v;
    utt.onstart = () => { setIsSpeaking(true); setFaceState("speaking"); };
    utt.onend = () => { setIsSpeaking(false); setFaceState("watching"); onDone?.(); };
    utt.onerror = () => { setIsSpeaking(false); setFaceState("watching"); onDone?.(); };
    synthRef.current.speak(utt);
  }, []);

  // ── AI Chat ────────────────────────────────────────────
  const askAI = useCallback(async ({ text, imageB64, visionAlert, homeworkScan }) => {
    if (busyRef.current && !visionAlert) return;
    setIsThinking(true); setFaceState("thinking");

    let msg = text || "";
    if (visionAlert) msg = `[VISION: ${visionAlert}]`;
    if (homeworkScan) msg = "[HOMEWORK SCAN] Read and grade this homework.";

    try {
      const body = {
        student_id: student.id,
        lesson_id: lessonIdRef.current,
        message: msg,
        image_b64: imageB64 || null,
        mode: modeRef.current,
        history: historyRef.current.slice(-12),
      };
      const data = await api("POST", "/noor/chat", body);
      const reply = data.reply;
      historyRef.current = [...historyRef.current, { role:"user", content: msg }, { role:"assistant", content: reply }].slice(-16);

      // Track topics
      const topicMap = { arabic:["arabic","letter","word"], quran:["quran","surah","recit","tajweed"], dua:["dua","prayer","salah"], stories:["prophet","story","islam"] };
      Object.entries(topicMap).forEach(([t, kw]) => {
        if (kw.some(k => reply.toLowerCase().includes(k)) && !topicsRef.current.includes(t)) {
          setTopics(prev => [...new Set([...prev, t])]);
        }
      });

      setIsThinking(false);
      setBubble(reply);
      speak(reply, () => { if (!visionAlert) startListen(); });
    } catch(e) {
      setIsThinking(false); setFaceState("watching");
      if (!visionAlert) speak("Can you try again?", startListen);
    }
  }, [student, speak]);

  // ── Continuous listen ──────────────────────────────────
  const startListen = useCallback(() => {
    if (listeningRef.current || busyRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    recRef.current = rec; transcriptRef.current = "";

    rec.onstart = () => { listeningRef.current = true; setIsListening(true); setFaceState("listening"); };
    rec.onresult = e => {
      const t = Array.from(e.results).map(r=>r[0].transcript).join("");
      transcriptRef.current = t; setCaption(t);
    };
    rec.onend = () => {
      listeningRef.current = false; setIsListening(false); setCaption("");
      const said = transcriptRef.current.trim();
      if (said && !busyRef.current) {
        const img = captureFrame();
        askAI({ text: said, imageB64: img });
      } else if (!busyRef.current) {
        setTimeout(() => { if (!busyRef.current) startListen(); }, 800);
      }
    };
    rec.onerror = () => {
      listeningRef.current = false; setIsListening(false);
      setTimeout(() => { if (!busyRef.current) startListen(); }, 1200);
    };
    try { rec.start(); } catch(e) {}
  }, [captureFrame, askAI]);

  // ── Vision loop ────────────────────────────────────────
  const startVision = useCallback(() => {
    clearInterval(visionRef.current);
    visionRef.current = setInterval(async () => {
      if (busyRef.current) return;
      const img = captureFrame();
      if (!img) return;
      try {
        const data = await api("POST", "/noor/vision", {
          student_id: student.id,
          lesson_id: lessonIdRef.current,
          image_b64: img,
          mode: modeRef.current,
        });
        if (data.teacher_response) {
          const { event_type, teacher_response } = data;
          if (event_type === "cheating") setAlertMsg("👀 Ustadha Noor sees you!");
          else if (event_type === "distracted") setAlertMsg("⚠️ Pay attention!");
          setTimeout(() => setAlertMsg(""), 3000);
          recRef.current?.stop();
          listeningRef.current = false;
          setBubble(teacher_response);
          speak(teacher_response, startListen);
        }
      } catch(e) {}
    }, 9000);
  }, [student, captureFrame, speak, startListen]);

  // ── Init ───────────────────────────────────────────────
  useEffect(() => {
    let lid = null;
    const init = async () => {
      await startCamera("user");
      // Start lesson in DB
      try {
        const ls = await api("POST", "/noor/lesson/start", { student_id: student.id });
        lid = ls.lesson_id;
        setLessonId(lid);
      } catch(e) {}

      // Greeting
      setIsThinking(true); setFaceState("thinking");
      try {
        const data = await api("POST", "/noor/chat", {
          student_id: student.id,
          lesson_id: lid,
          message: `[CLASS STARTING] Greet ${student.name} warmly. They are ${student.age || 8} years old. Start the lesson.`,
          mode: "TEACHING",
          history: [],
        });
        const reply = data.reply;
        historyRef.current = [{ role:"user", content:"[CLASS STARTING]" }, { role:"assistant", content: reply }];
        setIsThinking(false);
        setBubble(reply);
        speak(reply, () => { startListen(); startVision(); });
      } catch(e) {
        setIsThinking(false);
        const fb = `Assalamu Alaikum ${student.name}! I'm Ustadha Noor. Let's start learning! 🌙`;
        setBubble(fb);
        speak(fb, () => { startListen(); startVision(); });
      }
    };
    init();

    return () => {
      clearInterval(visionRef.current);
      synthRef.current.cancel();
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      // End lesson
      if (lid || lessonIdRef.current) {
        api("POST", "/noor/lesson/end", {
          lesson_id: lid || lessonIdRef.current,
          student_id: student.id,
          topics_covered: topicsRef.current,
        }).catch(()=>{});
      }
    };
  }, []);

  // ── Homework ───────────────────────────────────────────
  const doHomework = async () => {
    recRef.current?.stop();
    setMode("HOMEWORK");
    speak("Hold your homework up to the camera!", async () => {
      await startCamera("environment");
      setTimeout(async () => {
        const img = captureFrame();
        await startCamera("user");
        if (img) askAI({ homeworkScan: true, imageB64: img });
        else speak("I couldn't see the homework. Try again!", startListen);
      }, 2000);
    });
  };

  const switchMode = (m) => {
    setMode(m);
    recRef.current?.stop();
    askAI({ text: `[MODE: ${m}] Switch to ${m} mode and guide me.` });
  };

  return (
    <div style={{
      background:"linear-gradient(180deg,#051a0d,#0d3320)",
      minHeight:"100dvh", display:"flex", flexDirection:"column",
      alignItems:"center", fontFamily:"'Segoe UI',Arial,sans-serif",
      color:"white", maxWidth:480, margin:"0 auto", overflow:"hidden",
    }}>
      {/* Top bar */}
      <div style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 14px", boxSizing:"border-box", background:"rgba(0,0,0,0.3)",
      }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#8dc49a", fontSize:14, cursor:"pointer" }}>← Back</button>
        <div style={{ fontWeight:"bold", color:"#f0c060", fontSize:15 }}>{student.name}</div>
        <span style={{
          background: mode==="RECITATION"?"#7d3c98": mode==="HOMEWORK"?"#a93226":"#1a7a40",
          borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:"bold",
        }}>
          {mode==="RECITATION"?"🕌 Reciting": mode==="HOMEWORK"?"📝 Homework":"📚 Lesson"}
        </span>
      </div>

      {/* Alert */}
      {alertMsg && (
        <div style={{ width:"100%", background:"#922b21", textAlign:"center", padding:"8px", fontSize:14, fontWeight:"bold" }}>
          {alertMsg}
        </div>
      )}

      {/* Face + Camera */}
      <div style={{ display:"flex", gap:10, padding:"10px 14px 0", width:"100%", boxSizing:"border-box", alignItems:"center" }}>
        <div style={{ flexShrink:0 }}><Face state={faceState} size={120}/></div>
        <div style={{
          flex:1, height:110, borderRadius:16, overflow:"hidden",
          border:"2px solid rgba(255,255,255,0.15)", background:"#000", position:"relative",
        }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)" }}/>
          <div style={{
            position:"absolute", top:5, left:5,
            background:"rgba(14,77,42,0.85)", borderRadius:8, padding:"2px 8px", fontSize:11,
            display:"flex", alignItems:"center", gap:4,
          }}>
            <span style={{ color:"#4ade80" }}>●</span> Live
          </div>
          {mode==="RECITATION" && (
            <div style={{
              position:"absolute", bottom:5, left:5,
              background:"rgba(125,60,152,0.9)", borderRadius:8, padding:"2px 7px", fontSize:10,
            }}>👁 Watching</div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display:"none" }}/>

      {/* Bubble */}
      <div style={{
        margin:"10px 14px 0", width:"calc(100% - 28px)", boxSizing:"border-box",
        background:"rgba(255,255,255,0.96)", borderRadius:20,
        padding:"14px 16px", minHeight:90, maxHeight:160, overflowY:"auto",
      }}>
        <div style={{ fontSize:15, color:"#0d2818", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
          {isThinking ? <span style={{ color:"#1a7a40" }}>🤔 Thinking...</span> : bubble}
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div style={{
          margin:"6px 14px 0", width:"calc(100% - 28px)", boxSizing:"border-box",
          background:"rgba(0,0,0,0.4)", borderRadius:12, padding:"8px 14px",
          fontSize:13, color:"#d0f0dc", fontStyle:"italic",
        }}>"{caption}"</div>
      )}

      {/* Mic status */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10 }}>
        <Waveform active={isListening}/>
        <span style={{ fontSize:12, color: isListening?"#4ade80": isSpeaking?"#f0c060":"#6aaa80" }}>
          {isListening?"Listening...": isSpeaking?"Speaking...": isThinking?"Thinking...":"Waiting..."}
        </span>
        <Waveform active={isSpeaking}/>
      </div>

      {/* Mode buttons */}
      <div style={{ display:"flex", gap:8, padding:"10px 14px 0", width:"100%", boxSizing:"border-box" }}>
        {[["TEACHING","📚 Lesson","#1a7a40"],["RECITATION","🕌 Recite","#7d3c98"]].map(([m,l,c])=>(
          <button key={m} onClick={()=>switchMode(m)} style={{
            flex:1, background: mode===m ? c : "rgba(255,255,255,0.1)",
            border:`2px solid ${mode===m ? c : "rgba(255,255,255,0.15)"}`,
            borderRadius:14, color:"white", padding:"10px",
            fontSize:13, fontWeight: mode===m?"bold":"normal", cursor:"pointer",
          }}>{l}</button>
        ))}
        <button onClick={doHomework} style={{
          flex:1, background:"rgba(169,50,38,0.7)",
          border:"2px solid rgba(169,50,38,0.5)",
          borderRadius:14, color:"white", padding:"10px",
          fontSize:13, cursor:"pointer",
        }}>📝 Homework</button>
      </div>

      <div style={{ fontSize:11, color:"#3d7a55", padding:"10px 0 16px", textAlign:"center" }}>
        No touch needed · Voice only · Camera always on
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCREEN 3 — Parent Dashboard
// ══════════════════════════════════════════════════════════
function Dashboard({ students, onBack }) {
  const [selected, setSelected] = useState(students[0]?.id || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api("GET", `/noor/student/${selected}`).then(setData).catch(()=>setData(null)).finally(()=>setLoading(false));
  }, [selected]);

  const p = data?.progress;
  const s = data?.student;

  return (
    <div style={{
      background:"linear-gradient(180deg,#051a0d,#0d3320)",
      minHeight:"100dvh", display:"flex", flexDirection:"column",
      alignItems:"center", fontFamily:"'Segoe UI',Arial,sans-serif",
      color:"white", maxWidth:480, margin:"0 auto", padding:"0 0 24px",
    }}>
      <div style={{
        width:"100%", display:"flex", alignItems:"center", padding:"12px 14px",
        boxSizing:"border-box", background:"rgba(0,0,0,0.3)",
      }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#8dc49a", fontSize:14, cursor:"pointer" }}>← Back</button>
        <div style={{ flex:1, textAlign:"center", fontWeight:"bold", color:"#f0c060", fontSize:16 }}>📊 Parent Dashboard</div>
      </div>

      {/* Student tabs */}
      <div style={{ display:"flex", gap:8, padding:"12px 14px", width:"100%", boxSizing:"border-box", overflowX:"auto" }}>
        {students.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} style={{
            background: selected===s.id ? "#1a7a40" : "rgba(255,255,255,0.1)",
            border:`2px solid ${selected===s.id ? "#1a7a40" : "rgba(255,255,255,0.15)"}`,
            borderRadius:20, padding:"6px 16px", color:"white",
            fontSize:13, fontWeight: selected===s.id?"bold":"normal", cursor:"pointer", whiteSpace:"nowrap",
          }}>{s.name}</button>
        ))}
      </div>

      {loading && <div style={{ color:"#6aaa80", marginTop:20 }}>Loading...</div>}

      {data && !loading && (
        <div style={{ padding:"0 14px", width:"100%", boxSizing:"border-box", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[
              ["📚", p?.total_lessons || 0, "Lessons"],
              ["⏱", p?.total_minutes || 0, "Minutes"],
              ["🕌", (p?.surahs_memorized?.length || 0), "Surahs"],
            ].map(([icon, val, label]) => (
              <div key={label} style={{
                background:"rgba(255,255,255,0.08)", borderRadius:16, padding:"14px 10px", textAlign:"center",
              }}>
                <div style={{ fontSize:22 }}>{icon}</div>
                <div style={{ fontSize:24, fontWeight:"bold", color:"#f0c060" }}>{val}</div>
                <div style={{ fontSize:11, color:"#8dc49a" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Arabic level */}
          <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:16 }}>
            <div style={{ fontSize:13, color:"#8dc49a", marginBottom:8 }}>Arabic Level</div>
            <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:20, height:12, overflow:"hidden" }}>
              <div style={{ background:"linear-gradient(90deg,#1a7a40,#4ade80)", height:"100%", width:`${p?.arabic_level || 0}%`, borderRadius:20, transition:"width 1s" }}/>
            </div>
            <div style={{ fontSize:12, color:"#f0c060", marginTop:6, textAlign:"right" }}>{p?.arabic_level || 0}%</div>
          </div>

          {/* Surahs */}
          {(p?.surahs_memorized?.length > 0 || p?.surahs_in_progress?.length > 0) && (
            <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:"bold", color:"#f0c060", marginBottom:10 }}>🕌 Quran Progress</div>
              {p.surahs_memorized?.map(s => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ color:"#4ade80" }}>✓</span>
                  <span style={{ fontSize:14 }}>{s}</span>
                  <span style={{ marginLeft:"auto", background:"#1a7a40", borderRadius:10, padding:"2px 8px", fontSize:11 }}>Memorized</span>
                </div>
              ))}
              {p.surahs_in_progress?.map(s => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ color:"#f0c060" }}>◐</span>
                  <span style={{ fontSize:14 }}>{s}</span>
                  <span style={{ marginLeft:"auto", background:"#7d3c98", borderRadius:10, padding:"2px 8px", fontSize:11 }}>In Progress</span>
                </div>
              ))}
            </div>
          )}

          {/* Duas */}
          {p?.duas_learned?.length > 0 && (
            <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:"bold", color:"#f0c060", marginBottom:10 }}>🤲 Duas Learned</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {p.duas_learned.map(d => (
                  <span key={d} style={{ background:"rgba(26,122,64,0.4)", borderRadius:20, padding:"4px 12px", fontSize:12 }}>{d}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recent homework */}
          {data.recent_homework?.length > 0 && (
            <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:"bold", color:"#f0c060", marginBottom:10 }}>📝 Recent Homework</div>
              {data.recent_homework.map(h => (
                <div key={h.id} style={{
                  background:"rgba(255,255,255,0.05)", borderRadius:12, padding:"10px 12px", marginBottom:8,
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"#8dc49a" }}>{new Date(h.submitted_at).toLocaleDateString()}</span>
                    <span style={{
                      background: h.grade==="excellent"?"#1a7a40": h.grade==="good"?"#7d3c98":"#a93226",
                      borderRadius:10, padding:"1px 8px", fontSize:11,
                    }}>{h.grade} {h.score ? `· ${h.score}/100` : ""}</span>
                  </div>
                  <div style={{ fontSize:13, color:"#d0f0dc", lineHeight:1.4 }}>{h.feedback?.slice(0,120)}...</div>
                </div>
              ))}
            </div>
          )}

          {/* Recent lessons */}
          {data.recent_lessons?.length > 0 && (
            <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:16, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:"bold", color:"#f0c060", marginBottom:10 }}>📅 Recent Lessons</div>
              {data.recent_lessons.slice(0,5).map(l => (
                <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, fontSize:13 }}>
                  <span style={{ color:"#8dc49a" }}>{new Date(l.started_at).toLocaleDateString()}</span>
                  <span style={{ color:"white" }}>{Math.round((l.duration_seconds||0)/60)} min</span>
                  <span style={{ color:"#f0c060", fontSize:11 }}>{l.topics_covered?.join(", ") || "lesson"}</span>
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
  const [screen, setScreen] = useState("select"); // select | class | dashboard
  const [student, setStudent] = useState(null);
  const [students, setStudents] = useState([]);

  const handleSelect = (s) => { setStudent(s); setScreen("class"); };
  const handleDashboard = () => setScreen("dashboard");
  const handleBack = () => setScreen("select");

  // Keep students list fresh for dashboard
  useEffect(() => {
    api("GET", "/noor/students").then(setStudents).catch(()=>{});
  }, [screen]);

  if (screen === "class" && student) return <Classroom student={student} onBack={handleBack}/>;
  if (screen === "dashboard") return <Dashboard students={students} onBack={handleBack}/>;
  return <StudentSelect onSelect={handleSelect} onDashboard={handleDashboard}/>;
}
