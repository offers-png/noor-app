import { useEffect, useState } from "react";
import { api } from "./api";
import "./styles.css";

export default function StudentSelect({ onSelect, onDashboard }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState(false);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setStudents(await api("GET", "/noor/students")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const add = async e => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setFormError("");
    try {
      const student = await api("POST", "/noor/students", { name: name.trim(), age: age ? Number(age) : null, level: "beginner" });
      setStudents(prev => [...prev, student]); setAdding(false); setName(""); setAge("");
    } catch (e) { setFormError(e.message); }
    finally { setSaving(false); }
  };
  return <main className="welcome">
    <header className="welcome-header"><a className="wordmark" href="#">✦ Noor</a><span className="eyebrow">A little learning, every day</span></header>
    <div className="welcome-layout">
      <section className="welcome-intro">
        <span className="pill">Your family's learning space</span>
        <h1>Small steps.<br/><em>Bright beginnings.</em></h1>
        <p>Explore Arabic letters, Quran recitation, and Islamic stories with Sheikh Noor, your AI teacher.</p>
        <div className="learning-paths"><span>أ ب ت <small>Learn Arabic</small></span><span>☾ <small>Practice recitation</small></span><span>✧ <small>Discover stories</small></span></div>
        <aside className="lesson-tip"><strong>Before you begin</strong><p>Find a quiet spot and have a parent nearby. Lessons use your camera and microphone; your browser will ask for access.</p></aside>
      </section>
      <section className="student-panel" aria-labelledby="student-heading" aria-busy={loading}>
        <div className="panel-heading"><span className="eyebrow">LET'S GET STARTED</span><h2 id="student-heading">Who’s learning today?</h2><p>Choose a student to plan their lesson.</p></div>
        {loading ? <div className="empty-state" role="status">Loading your students…</div> : error ? <div className="noor-error" role="alert"><p>{error}</p><button className="secondary" onClick={load}>Try again</button></div> : <>
          {students.length > 1 && <button className="group-toggle secondary" aria-pressed={group} onClick={() => { setGroup(!group); setSelected([]); }}>{group ? "← Back to individual lessons" : "Learn together · Choose a group"}</button>}
          <div className="student-list">{students.map((student, i) => <button className={`student-card ${selected.includes(student.id) ? "selected" : ""}`} key={student.id} aria-pressed={group ? selected.includes(student.id) : undefined} onClick={() => group ? setSelected(prev => prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]) : onSelect([student])}>
            <span className={`student-avatar tone-${i % 3}`}>{student.name?.trim().slice(0, 1).toUpperCase() || "✦"}</span><span className="student-details"><strong>{student.name}</strong><small>{student.age ? `Age ${student.age} · ` : ""}{student.level || "beginner"}</small></span><span className="student-action">{group ? selected.includes(student.id) ? "✓" : "+" : "→"}</span>
          </button>)}</div>
          {!students.length && <div className="empty-state"><span className="empty-icon">✦</span><h3>Welcome to your first lesson</h3><p>Add a student to begin their learning journey.</p></div>}
          {group && <button className="primary" disabled={!selected.length} onClick={() => onSelect(students.filter(s => selected.includes(s.id)))}>Plan lesson{selected.length ? ` for ${selected.length} student${selected.length === 1 ? "" : "s"}` : " · Select students"}</button>}
          {!adding ? <button className="add-student" onClick={() => { setAdding(true); setFormError(""); }}>+ Add a student</button> : <form className="student-form" onSubmit={add}>
            <h3>New student</h3><label htmlFor="student-name">Child’s name</label><input id="student-name" autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" placeholder="Enter their name"/>
            <label htmlFor="student-age">Age <span>(optional)</span></label><input id="student-age" type="number" min="1" max="120" step="1" value={age} onChange={e => setAge(e.target.value)} placeholder="Enter their age"/>
            {formError && <p className="noor-error" role="alert">{formError}</p>}
            <div className="form-actions"><button className="primary" disabled={saving || !name.trim()}>{saving ? "Adding…" : "Add student"}</button><button className="secondary" type="button" disabled={saving} onClick={() => setAdding(false)}>Cancel</button></div>
          </form>}
          {!!students.length && <button className="dashboard-link" onClick={onDashboard}>View parent dashboard <span>↗</span></button>}
        </>}
        <p className="panel-footer">Made for curious minds. Guided by you.</p>
      </section>
    </div>
  </main>;
}
