import { useEffect, useState } from "react";
import "./teacher.css";

// Isolated beginner letter forms; numbered strokes separate the body and dots.
const strokes = {
  "أ": ["M260 75 L260 205", "M259 48 Q242 39 252 29 Q263 20 274 30 M245 51 L276 51"],
  "ب": ["M335 147 Q350 205 265 205 Q180 205 195 147", "M265 233 L267 233"],
  "ت": ["M335 147 Q350 205 265 205 Q180 205 195 147", "M250 117 L252 117", "M280 117 L282 117"],
  "ث": ["M335 147 Q350 205 265 205 Q180 205 195 147", "M250 117 L252 117", "M280 117 L282 117", "M265 92 L267 92"],
};

export default function TeacherStage({ letter, board, speaking }) {
  const paths = strokes[letter?.letter];
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setStep(0); setPlaying(Boolean(paths));
    if (!paths) return;
    let next = 0;
    const timer = setInterval(() => {
      next++;
      if (next >= paths.length) { setPlaying(false); clearInterval(timer); }
      else setStep(next);
    }, 1800);
    return () => clearInterval(timer);
  }, [letter?.letter, replay, paths]);
  return <section className="teacher-stage" aria-label="Teacher and lesson board">
    <div className="stage-top"><span>NOOR’S CLASSROOM</span><span>{playing ? "Writing demonstration" : speaking ? "Teacher speaking" : "Your turn"}</span></div>
    <div className="stage-scene">
      <svg className="standing-teacher" viewBox="0 0 170 320" role="img" aria-label="Standing teacher pointing to the board">
        <ellipse cx="80" cy="307" rx="57" ry="9" fill="#0003"/>
        <path d="M54 285 L51 306 L75 306 L79 281 M87 281 L91 306 L116 306 L110 284" fill="#203c33"/>
        <path d="M55 104 Q80 94 105 104 L121 290 Q83 305 39 289 Z" fill="#e5e4d6"/>
        <path d="M68 103 L82 134 L96 103 M82 133 L82 279" stroke="#c4caba" strokeWidth="3" fill="none"/>
        <path d="M54 112 Q23 135 25 184 L39 189 Q42 151 64 136" fill="#e5e4d6"/>
        <ellipse cx="32" cy="192" rx="9" ry="13" fill="#d9aa7d"/>
        <g className={playing ? "teacher-writing-arm" : ""}><path d="M105 112 L127 139 L149 115" fill="none" stroke="#e5e4d6" strokeWidth="19" strokeLinecap="round"/><circle cx="152" cy="109" r="9" fill="#d9aa7d"/><path d="M154 103 L162 89" stroke="#f7f5da" strokeWidth="4"/></g>
        <rect x="70" y="84" width="24" height="27" rx="8" fill="#d9aa7d"/>
        <ellipse cx="82" cy="61" rx="34" ry="40" fill="#e7bd91"/>
        <path d="M49 42 Q48 10 82 10 Q117 10 116 42 Z" fill="#46765b"/>
        <path d="M51 75 Q58 112 82 108 Q107 109 113 74 Q100 85 82 85 Q63 85 51 75" fill="#37453b"/>
        <path d="M61 53 L72 52 M91 52 L102 53" stroke="#37453b" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="67" cy="60" r="3" fill="#27392e"/><circle cx="97" cy="60" r="3" fill="#27392e"/>
        <path d="M80 63 L76 74 L84 75" stroke="#bb895f" strokeWidth="2" fill="none"/>
        <ellipse cx="82" cy="85" rx="8" ry={speaking ? 5 : 2} fill="#a05c47"/>
      </svg>
      <div className="teacher-board">
        <h2>{letter ? `Let’s write ${letter.label}` : board?.title || "Welcome to class"}</h2>
        {paths ? <>
          <svg key={`${letter.letter}-${replay}`} viewBox="150 10 240 260" className="stroke-board" role="img" aria-label={`Stroke ${step + 1} of ${paths.length} for ${letter.label}`}>
            <path d="M165 205 H375" stroke="#a6b79855" strokeDasharray="6 6"/>
            {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={i <= step ? "#f9e6a5" : "#f9e6a522"} strokeWidth={i === 0 ? 8 : 10} strokeLinecap="round" pathLength="1" className={i === step && playing ? "animated-stroke" : ""}/>) }
            {playing && <circle key={`${replay}-${step}`} r="5" fill="white"><animateMotion path={paths[step]} dur="1.6s" fill="freeze"/></circle>}
          </svg>
          <p className="stroke-caption" role="status">{playing ? `Watch stroke ${step + 1} of ${paths.length}` : "Now try it on your writing pad."}</p>
          <button onClick={() => setReplay(v => v + 1)}>↻ Show me again</button>
        </> : letter ? <><div className="board-letter" lang="ar" dir="rtl">{letter.letter}</div><p>Letter reference · Ask Noor to explain how to write it.</p></> : <div className="board-content">{board?.lines?.map((line, i) => <div key={i}><p lang="ar" dir="rtl">{line.arabic}</p><small>{line.transliteration}</small><small>{line.translation}</small></div>) || <p>Learn together, one step at a time.</p>}</div>}
      </div>
    </div>
  </section>;
}
