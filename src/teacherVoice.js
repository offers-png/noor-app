export const MAX_TEACHER_TEXT_LENGTH = 3500;
const NATURAL_VOICE_URL = "/.netlify/functions/teacher-voice";
const FALLBACK_MESSAGE = "Natural voice unavailable. Using your device voice.";
const BLOCKED_MESSAGE = "Tap Play to hear the teacher.";

/** Presentation cleanup only. Religious text selection belongs to the caller. */
export function prepareTeacherText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/!?\[([^\]]*)\]\([^\n)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_#~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One classroom speaker. speak() resolves after playback setup, not the end of
 * the narration. onDone runs once on completion or unrecoverable failure;
 * cancellation/replacement/disposal never advance the lesson.
 */
export function createTeacherVoice({
  onState = () => {},
  fetchImpl = globalThis.fetch?.bind(globalThis),
  AudioClass = globalThis.Audio,
  synthesis = globalThis.speechSynthesis,
  UtteranceClass = globalThis.SpeechSynthesisUtterance,
  urlApi = globalThis.URL,
} = {}) {
  let epoch = 0;
  let disposed = false;
  let active = null;
  let cachedAudio = null;
  let state = { status: "idle", source: "natural", message: "" };

  const current = job => !disposed && active === job && job.epoch === epoch && !job.finished;
  const notify = (status, source, message = "") => {
    if (disposed) return;
    if (state.status === status && state.source === source && state.message === message) return;
    state = { status, source, message };
    onState({ ...state });
  };
  const releaseAudio = job => {
    const audio = job.audio;
    job.audio = null;
    if (audio) {
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      try { audio.pause(); } catch { /* Media may have already been released. */ }
      try { audio.removeAttribute?.("src"); audio.load?.(); } catch { /* Best-effort decoder cleanup. */ }
    }
    if (job.objectUrl) {
      try { urlApi?.revokeObjectURL(job.objectUrl); } catch { /* URL may already be revoked. */ }
      job.objectUrl = null;
    }
  };
  const releaseUtterance = job => {
    clearTimeout(job.startTimer);
    job.startTimer = null;
    const utterance = job.utterance;
    job.utterance = null;
    if (utterance) {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      try { synthesis?.cancel(); } catch { /* Device voice is optional. */ }
    }
  };
  const release = job => {
    clearTimeout(job.requestTimer);
    job.controller?.abort();
    releaseAudio(job);
    releaseUtterance(job);
  };
  const finish = (job, error = "") => {
    if (!current(job)) return;
    job.finished = true;
    release(job);
    active = null;
    notify(error ? "error" : "idle", job.source, error || job.fallbackMessage);
    // A consumer may synchronously replace/cancel speech inside onState.
    if (!disposed && job.epoch === epoch) job.onDone?.();
  };
  const cancel = () => {
    epoch++;
    const previous = active;
    active = null;
    if (previous) release(previous);
    notify("idle", state.source, previous?.fallbackMessage || (state.status === "idle" ? state.message : ""));
  };

  const startDevice = job => {
    if (!current(job)) return;
    releaseAudio(job);
    releaseUtterance(job);
    job.source = "device";
    notify("loading", "device", job.fallbackMessage || "Preparing your device voice…");
    if (!current(job)) return;
    if (!synthesis?.speak || !UtteranceClass) {
      finish(job, "Voice unavailable. You can read the lesson.");
      return;
    }
    try {
      const utterance = new UtteranceClass(job.text);
      const voices = synthesis.getVoices?.() || [];
      const voice = voices.find(item => item.voiceURI === job.deviceVoiceURI)
        || voices.find(item => item.lang?.startsWith("en") && /Natural|Aria|Jenny|Sonia|Google UK English/i.test(item.name))
        || voices.find(item => item.lang?.startsWith("en"));
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = 0.94;
      utterance.pitch = 1;
      job.utterance = utterance;
      utterance.onstart = () => {
        if (!current(job) || job.utterance !== utterance) return;
        clearTimeout(job.startTimer);
        notify("playing", "device", job.fallbackMessage || "Using your device voice.");
      };
      utterance.onend = () => {
        if (job.utterance === utterance) finish(job);
      };
      utterance.onerror = event => {
        if (!current(job) || job.utterance !== utterance) return;
        clearTimeout(job.startTimer);
        if (event?.error === "not-allowed") {
          notify("blocked", "device", BLOCKED_MESSAGE);
        } else {
          finish(job, "Device voice unavailable. You can read the lesson.");
        }
      };
      // Some browsers omit a not-allowed event until a user activates audio.
      job.startTimer = setTimeout(() => {
        if (current(job) && job.utterance === utterance && state.status === "loading") {
          notify("blocked", "device", BLOCKED_MESSAGE);
        }
      }, 5000);
      synthesis.speak(utterance);
    } catch {
      finish(job, "Device voice unavailable. You can read the lesson.");
    }
  };

  const fallback = job => {
    if (!current(job)) return;
    // Fail once through the device path; never retry a failing natural track.
    job.fallbackMessage = FALLBACK_MESSAGE;
    startDevice(job);
  };

  const playAudio = async job => {
    const audio = job.audio;
    if (!current(job) || !audio) return;
    notify("loading", "natural", "Preparing the teacher’s voice…");
    if (!current(job) || job.audio !== audio) return;
    try {
      await audio.play();
      if (current(job) && job.audio === audio) notify("playing", "natural", "Natural teacher voice.");
    } catch (error) {
      if (!current(job) || job.audio !== audio) return;
      if (error?.name === "NotAllowedError") {
        notify("blocked", "natural", BLOCKED_MESSAGE);
      } else {
        cachedAudio = null;
        fallback(job);
      }
    }
  };

  const startNatural = async job => {
    if (!fetchImpl || !AudioClass || !urlApi?.createObjectURL) { fallback(job); return; }
    try {
      let blob;
      if (cachedAudio?.text === job.text && cachedAudio.voice === job.voice) {
        blob = cachedAudio.blob;
      } else {
        job.controller = new AbortController();
        job.requestTimer = setTimeout(() => job.controller.abort(), 15000);
        const response = await fetchImpl(NATURAL_VOICE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ text: job.text, voice: job.voice }),
          signal: job.controller.signal,
        });
        if (!current(job)) return;
        if (!response?.ok) throw new Error("Natural voice unavailable");
        const type = response.headers?.get?.("content-type") || "";
        if (type && !/^audio\//i.test(type)) throw new Error("Expected audio");
        blob = await response.blob();
        if (!current(job)) return;
        if (!blob?.size || blob.size > 8 * 1024 * 1024) throw new Error("Invalid audio");
        clearTimeout(job.requestTimer);
        cachedAudio = { text: job.text, voice: job.voice, blob };
      }
      if (!current(job)) return;
      job.objectUrl = urlApi.createObjectURL(blob);
      const audio = new AudioClass(job.objectUrl);
      job.audio = audio;
      audio.preload = "auto";
      audio.onplaying = () => {
        if (current(job) && job.audio === audio) notify("playing", "natural", "Natural teacher voice.");
      };
      audio.onended = () => {
        if (job.audio === audio) finish(job);
      };
      audio.onerror = () => {
        if (!current(job) || job.audio !== audio) return;
        cachedAudio = null;
        fallback(job);
      };
      await playAudio(job);
    } catch {
      if (current(job)) { cachedAudio = null; fallback(job); }
    } finally {
      clearTimeout(job.requestTimer);
    }
  };

  const speak = async (text, { voice = "teacher", deviceVoiceURI = "", onDone } = {}) => {
    if (disposed) return;
    // No intermediate idle event when replacing speech: listening must stay off.
    epoch++;
    const previous = active;
    active = null;
    if (previous) release(previous);
    const source = voice === "device" ? "device" : "natural";
    const job = {
      epoch, text: prepareTeacherText(text), voice: voice === "storyteller" ? "storyteller" : "teacher",
      source, deviceVoiceURI, onDone, fallbackMessage: "", finished: false,
      audio: null, objectUrl: null, utterance: null, controller: null,
      requestTimer: null, startTimer: null,
    };
    active = job;
    if (!job.text) { finish(job); return; }
    if (job.text.length > MAX_TEACHER_TEXT_LENGTH) {
      finish(job, "This reply is too long to read aloud. Ask for a shorter explanation.");
      return;
    }
    notify("loading", source, source === "natural" ? "Preparing the teacher’s voice…" : "Preparing your device voice…");
    if (!current(job)) return;
    if (source === "device") startDevice(job);
    else await startNatural(job);
  };

  const resume = async () => {
    const job = active;
    if (!job || !current(job) || state.status !== "blocked") return;
    if (job.source === "natural") await playAudio(job);
    else startDevice(job);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    epoch++;
    const previous = active;
    active = null;
    cachedAudio = null;
    if (previous) release(previous);
  };

  return { speak, cancel, resume, dispose };
}
