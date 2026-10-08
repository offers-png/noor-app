import { useCallback, useEffect, useRef, useState } from "react";
import { STORY_TOPICS, STORY_STORAGE_KEY, emptyStorySettings, loadStorySettings, saveStorySettings, resetStorySettings, createStoryPin, verifyStoryPin, recordPinAttempt, approvedVideoForLesson, detectStoryTopic, approveStoryVideo, fetchStoryVideos, validateApprovedPlayback, createStoryEmbedUrl, isChannelSource } from "./storyVideos.js";
import "./story-videos.css";

const disclosure = "YouTube is an external service. Loading its player sends connection information to YouTube. Ads, recommendations, and links that leave this app may appear, including after a video ends. Privacy-enhanced embedding does not make YouTube ad-free or guarantee child suitability. Watch together with an adult.";
const duration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function StoryVideos({ lessonText = "", onPause, onResume, disabled = false }) {
  const [settings, setSettings] = useState(emptyStorySettings);
  const [modal, setModal] = useState(null);
  const [paused, setPaused] = useState(false);
  const [pauseReady, setPauseReady] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetText, setResetText] = useState("");
  const [topic, setTopic] = useState("nuh");
  const [channelId, setChannelId] = useState("");
  const [results, setResults] = useState([]);
  const [candidate, setCandidate] = useState(null);
  const [video, setVideo] = useState(null);
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dialogRef = useRef(null);
  const priorFocus = useRef(null);
  const generation = useRef(0);
  const request = useRef(null);
  const operation = useRef(false);
  const parentFingerprint = useRef(null);
  const callbacks = useRef({ onPause, onResume });
  useEffect(() => { callbacks.current = { onPause, onResume }; }, [onPause, onResume]);

  const cancel = useCallback(() => {
    generation.current += 1; request.current?.abort(); request.current = null; operation.current = false;
    parentFingerprint.current = null;
    setParentOpen(false); setVideo(null); setCandidate(null); setConsent(false); setReviewed(false); setResults([]); setBusy(false); setPin(""); setConfirmPin("");
  }, []);
  const close = useCallback(async resume => {
    cancel(); setModal(null); setResetOpen(false); setError(""); setNotice(""); priorFocus.current?.focus();
    const current = generation.current;
    if (resume) {
      try { await callbacks.current.onResume?.(); if (generation.current === current) setPaused(false); }
      catch { if (generation.current === current) setError("The teacher could not resume. Try Resume teacher again."); }
    }
  }, [cancel]);
  useEffect(() => {
    const read = () => { try { setSettings(loadStorySettings()); } catch (e) { setError(e.message); } };
    read();
    const changed = event => {
      if (event.key !== STORY_STORAGE_KEY && event.key !== null) return;
      cancel(); read(); setNotice("Video settings changed in another tab. Unlock again to manage them.");
    };
    const hidden = () => { if (document.hidden) { cancel(); setNotice("Video playback stopped when you left this page. Loading again requires fresh consent."); } };
    window.addEventListener("storage", changed); document.addEventListener("visibilitychange", hidden);
    return () => { generation.current += 1; request.current?.abort(); window.removeEventListener("storage", changed); document.removeEventListener("visibilitychange", hidden); };
  }, [cancel]);
  useEffect(() => {
    if (!modal) return;
    dialogRef.current?.querySelector("button, input, select")?.focus();
    const key = event => {
      if (event.key === "Escape") { event.preventDefault(); void close(false); }
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), iframe, [tabindex='0']") ?? []);
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [modal, close]);

  const open = async (mode, approval = null) => {
    if (disabled) return;
    cancel(); const current = generation.current; priorFocus.current = document.activeElement;
    setError(""); setNotice(""); setResetOpen(false); setResetConfirmed(false); setResetText(""); setPauseReady(false); setPaused(true); setModal(mode); setCandidate(approval); setBusy(true);
    try {
      await callbacks.current.onPause?.();
      if (generation.current !== current) return;
      setPauseReady(true);
      try {
        const saved = loadStorySettings(); setSettings(saved);
        if (mode === "manage") {
          const detected = detectStoryTopic(lessonText) ?? "nuh";
          setTopic(detected); setChannelId(saved.approvals.find(item => item.topic === detected)?.channelId ?? saved.approvals[0]?.channelId ?? "");
        }
      } catch (e) { setError(e.message); }
    } catch { if (generation.current === current) setError("The teacher could not pause. Close this dialog and try again before loading a video."); }
    finally { if (generation.current === current) setBusy(false); }
  };
  const run = async work => {
    if (operation.current || !pauseReady) return;
    operation.current = true; setBusy(true); setError(""); setNotice("");
    const current = generation.current;
    const controller = new AbortController(); request.current = controller;
    const active = () => generation.current === current && !controller.signal.aborted;
    try { await work(controller.signal, active); }
    catch (e) { if (active()) setError(e.message || "Video settings could not be updated."); }
    finally { if (active()) { operation.current = false; setBusy(false); request.current = null; } }
  };
  const authorizedSettings = () => {
    const current = loadStorySettings();
    if (!parentFingerprint.current || current.pin?.hash !== parentFingerprint.current) throw new Error("Unlock the local video PIN before changing approvals.");
    return current;
  };
  const unlock = event => {
    event.preventDefault();
    void run(async (_signal, active) => {
      const current = loadStorySettings();
      if (current.lock.until > Date.now()) throw new Error("Too many PIN attempts. Wait one minute before trying again.");
      if (!current.pin) {
        if (pin !== confirmPin) throw new Error("The two PINs must match.");
        const newPin = await createStoryPin(pin);
        if (!active()) return;
        if (loadStorySettings().pin) throw new Error("A PIN was created in another tab. Close and unlock again.");
        const saved = saveStorySettings({ ...current, pin: newPin }); setSettings(saved); parentFingerprint.current = newPin.hash;
      } else {
        const correct = await verifyStoryPin(pin, current.pin);
        if (!active()) return;
        const latest = loadStorySettings();
        if (latest.pin?.hash !== current.pin.hash) throw new Error("The video PIN changed. Close and unlock again.");
        setSettings(saveStorySettings(recordPinAttempt(latest, correct)));
        if (!correct) throw new Error("Incorrect PIN. Please try again.");
        parentFingerprint.current = current.pin.hash;
      }
      setParentOpen(true); setPin(""); setConfirmPin(""); setNotice("Parent video settings unlocked on this page.");
    });
  };
  const search = event => {
    event.preventDefault();
    void run(async (signal, active) => {
      authorizedSettings(); setVideo(null); setCandidate(null); setConsent(false); setReviewed(false); setResults([]);
      const found = await fetchStoryVideos({ action: "search", topic, channelId: channelId.trim() }, { signal });
      if (active()) { authorizedSettings(); setResults(found); setNotice(found.length ? "Choose a result to preview and review. Search filters cannot judge animation or religious accuracy." : "No eligible videos were found in this channel for this topic."); }
    });
  };
  const preview = item => {
    void run(async (_signal, active) => {
      authorizedSettings(); await callbacks.current.onPause?.();
      if (!active()) return;
      setCandidate({ ...item, topic: item.topic ?? topic, reviewedAt: item.reviewedAt ?? new Date().toISOString() }); setVideo(null); setConsent(false); setReviewed(false);
    });
  };
  const loadPlayer = () => {
    if (!candidate || !consent) return;
    void run(async (signal, active) => {
      if (modal === "manage") authorizedSettings();
      else {
        const current = loadStorySettings().approvals.find(item => item.topic === candidate.topic);
        if (!current || current.id !== candidate.id || current.channelId !== candidate.channelId) throw new Error("This approval changed. Close this dialog and ask a parent to review the current story.");
      }
      await callbacks.current.onPause?.();
      const checked = await validateApprovedPlayback(candidate, { signal });
      if (active()) {
        if (modal === "manage") authorizedSettings();
        setVideo(checked); setReviewed(false);
      }
    });
  };
  const approve = () => void run(async (_signal, active) => {
    if (!video || video.id !== candidate?.id) throw new Error("Load and preview this recording before approving it.");
    const saved = saveStorySettings(approveStoryVideo(authorizedSettings(), candidate.topic, video, reviewed));
    if (active()) { setSettings(saved); setVideo(null); setCandidate(null); setConsent(false); setReviewed(false); setNotice("Your reviewed story is approved for this topic on this browser."); }
  });
  const remove = topicToRemove => void run(async (_signal, active) => {
    const current = authorizedSettings(); const saved = saveStorySettings({ ...current, approvals: current.approvals.filter(item => item.topic !== topicToRemove) });
    if (active()) { setSettings(saved); setVideo(null); setCandidate(null); setConsent(false); setReviewed(false); setNotice("Story approval removed."); }
  });
  const reset = () => void run(async (_signal, active) => {
    const cleared = resetStorySettings(resetConfirmed && resetText === "REMOVE");
    if (active()) { cancel(); setSettings(cleared); setResetOpen(false); setResetConfirmed(false); setResetText(""); setNotice("All video approvals and the video PIN were removed. Create a new PIN before reviewing videos."); }
  });
  const changeTopic = value => { setTopic(value); setResults([]); setCandidate(null); setVideo(null); setConsent(false); setReviewed(false); };
  const matched = approvedVideoForLesson(settings, lessonText);
  const detected = detectStoryTopic(lessonText);

  return <section className="story-videos" aria-label="Parent-reviewed story videos">
    <div className="story-videos-heading"><div><p className="story-eyebrow">Watch and learn together</p><h3>Story time</h3></div><button type="button" className="story-secondary" disabled={disabled} onClick={() => void open("manage")}>Parent video settings</button></div>
    {matched ? <><p>A parent reviewed a video for {STORY_TOPICS[matched.topic].label}. Nothing plays automatically.</p><button type="button" disabled={disabled} onClick={() => void open("watch", matched)}>Watch story</button></> : <p>{detected ? `A parent can review a story about ${STORY_TOPICS[detected].label} for this lesson.` : "Reviewed videos appear when the teacher discusses a supported story topic."}</p>}
    {paused && !modal && <div className="story-notice"><p>The teacher is paused.</p><button type="button" onClick={() => void close(true)}>Resume teacher</button></div>}
    {!modal && error && <p className="story-error" role="alert">{error}</p>}
    {modal && <div className="story-backdrop"><div ref={dialogRef} className="story-dialog" role="dialog" aria-modal="true" aria-labelledby="story-dialog-title">
      <div className="story-dialog-heading"><h2 id="story-dialog-title">{modal === "manage" ? "Parent video settings" : `Story: ${STORY_TOPICS[candidate?.topic ?? matched?.topic ?? "kindness"].label}`}</h2><button type="button" className="story-secondary" onClick={() => void close(true)}>Close and resume teacher</button></div>
      <p className="story-muted">The teacher, microphone, and camera checks are paused while this dialog is open.</p>
      {error && <p className="story-error" role="alert">{error}</p>}{notice && <p className="story-notice" role="status">{notice}</p>}
      {busy && <p role="status">Please wait…</p>}
      {modal === "manage" && <>
        <p>Your PIN and video approvals stay in this browser. An adult must review each video before children watch.</p>
        {!parentOpen && !resetOpen && <form onSubmit={unlock} className="story-form">
          <h3>{settings.pin ? "Unlock video approvals" : "Create the adult video PIN"}</h3>
          <label htmlFor="story-pin">{settings.pin ? "Video settings PIN" : "New video settings PIN (at least 6 digits)"}</label><input id="story-pin" type="password" inputMode="numeric" autoComplete="off" value={pin} maxLength={32} onChange={event => setPin(event.target.value)} disabled={busy || !pauseReady} />
          {!settings.pin && <><label htmlFor="story-confirm-pin">Confirm video settings PIN</label><input id="story-confirm-pin" type="password" inputMode="numeric" autoComplete="off" value={confirmPin} maxLength={32} onChange={event => setConfirmPin(event.target.value)} disabled={busy || !pauseReady} /></>}
          <button type="submit" disabled={busy || !pauseReady || !/^\d{6,32}$/.test(pin)}>{settings.pin ? "Unlock" : "Save adult PIN"}</button>
        </form>}
        {parentOpen && !resetOpen && <>
          <form onSubmit={search} className="story-form"><h3>Find a story to review</h3><p>Search sends your chosen topic and channel to the site’s YouTube video service. Results must still be watched and reviewed by an adult.</p><label htmlFor="story-topic">Story topic</label><select id="story-topic" value={topic} disabled={busy} onChange={event => changeTopic(event.target.value)}>{Object.entries(STORY_TOPICS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select><label htmlFor="story-channel">YouTube channel</label><input id="story-channel" value={channelId} aria-describedby="story-channel-help" aria-invalid={!!channelId.trim() && !isChannelSource(channelId)} autoComplete="off" spellCheck={false} placeholder="@YourTrustedChannel" maxLength={150} disabled={busy} onChange={event => { setChannelId(event.target.value); setResults([]); setCandidate(null); setVideo(null); setConsent(false); setReviewed(false); }} /><p id="story-channel-help" className="story-muted">Paste the channel link or its @handle. Choose a channel you trust.{!!channelId.trim() && !isChannelSource(channelId) && " Use a basic channel link without /videos or extra parameters."}</p><button type="submit" disabled={busy || !isChannelSource(channelId)}>Search stories</button></form>
          <div className="story-results">{results.map(item => <article key={item.id} className="story-result"><h4>{item.title}</h4><p>{item.channelTitle} · {duration(item.durationSeconds)}</p><button type="button" className="story-secondary" disabled={busy} onClick={() => preview(item)}>Preview for parent review</button></article>)}</div>
          {!!settings.approvals.length && <div className="story-approved"><h3>Your reviewed stories</h3>{settings.approvals.map(item => <article key={item.topic} className="story-result"><h4>{STORY_TOPICS[item.topic].label}</h4><p>Reviewed {new Date(item.reviewedAt).toLocaleDateString()} · video {item.id}</p><div className="story-actions"><button type="button" className="story-secondary" disabled={busy} onClick={() => preview(item)}>Preview approved story</button><button type="button" className="story-secondary" disabled={busy} onClick={() => remove(item.topic)}>Remove approval</button></div></article>)}</div>}
        </>}
        {!resetOpen && <button type="button" className="story-reset-link" disabled={busy || !pauseReady} onClick={() => { setResetOpen(true); setVideo(null); setCandidate(null); setConsent(false); setReviewed(false); }}>Reset video PIN and remove all approvals</button>}
        {resetOpen && <div className="story-reset"><h3>Remove every approved video and the PIN?</h3><p>This only resets story videos in this browser. No previously approved story will remain available after reset.</p><label className="story-check"><input type="checkbox" checked={resetConfirmed} disabled={busy} onChange={event => setResetConfirmed(event.target.checked)} /><span>I confirm removal of every story approval and the saved video PIN.</span></label><label htmlFor="story-reset-confirm">Type REMOVE to confirm</label><input id="story-reset-confirm" value={resetText} autoComplete="off" disabled={busy} onChange={event => setResetText(event.target.value)} /><div className="story-actions"><button type="button" disabled={busy || !resetConfirmed || resetText !== "REMOVE"} onClick={reset}>Remove approvals and PIN</button><button type="button" className="story-secondary" disabled={busy} onClick={() => setResetOpen(false)}>Keep video settings</button></div></div>}
      </>}
      {candidate && (modal === "watch" || parentOpen) && !resetOpen && <div className="story-preview"><h3>{video?.title ?? candidate.title ?? `Reviewed story about ${STORY_TOPICS[candidate.topic].label}`}</h3><p className="story-disclosure">{disclosure}</p>
        {!video && <><label className="story-check"><input type="checkbox" checked={consent} disabled={busy || !pauseReady} onChange={event => setConsent(event.target.checked)} /><span>I agree to load the external YouTube player for this visit.</span></label><button type="button" disabled={!consent || busy || !pauseReady} onClick={loadPlayer}>Check video and load YouTube player</button></>}
        {video && <><div className="story-player"><iframe title={`YouTube video: ${video.title}`} src={createStoryEmbedUrl(video.id)} referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div><p className="story-muted">{video.channelTitle} · {duration(video.durationSeconds)} · availability checked just now. Use YouTube’s visible controls to play. Its content and recommendations can change.</p>{modal === "manage" && <><label className="story-check"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} /><span>I watched this video and reviewed its child suitability, animation, and religious accuracy, including whether visual depictions are appropriate for our family. This is my review; API filters do not make that judgment.</span></label><button type="button" disabled={!reviewed || busy} onClick={approve}>Approve for {STORY_TOPICS[candidate.topic].label}</button></>}</>}
      </div>}
      <button type="button" className="story-secondary story-bottom-close" onClick={() => void close(true)}>Close and resume teacher</button>
    </div></div>}
  </section>;
}
