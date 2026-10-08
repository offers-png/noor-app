import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createTeacherVoice, MAX_TEACHER_TEXT_LENGTH, prepareTeacherText } from "./teacherVoice.js";

const speakers = new Set();
afterEach(() => { for (const speaker of speakers) speaker.dispose(); speakers.clear(); });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const audioResponse = () => new Response(new Blob(["mp3-audio"], { type: "audio/mpeg" }));

function fixture(options = {}) {
  const states = [], requests = [], audio = [], utterances = [], createdUrls = [], revokedUrls = [];
  let cancelCount = 0;
  class Audio {
    constructor(src) { this.src = src; this.pauseCount = 0; audio.push(this); }
    play() {
      if (options.play) return options.play(this);
      this.onplaying?.();
      return Promise.resolve();
    }
    pause() { this.pauseCount++; }
    removeAttribute(name) { if (name === "src") this.src = ""; }
    load() {}
  }
  class Utterance { constructor(text) { this.text = text; } }
  const synthesis = {
    getVoices: () => [
      { voiceURI: "device-one", name: "Natural voice", lang: "en-US" },
      { voiceURI: "device-two", name: "Chosen voice", lang: "en-GB" },
    ],
    speak: item => { utterances.push(item); if (options.deviceStarts !== false) item.onstart?.(); },
    cancel: () => { cancelCount++; },
  };
  const speaker = createTeacherVoice({
    onState: next => { states.push(next); options.onState?.(next, speaker); },
    fetchImpl: (url, request) => {
      requests.push({ url, ...request });
      return options.fetch ? options.fetch(url, request) : Promise.resolve(audioResponse());
    },
    AudioClass: Audio,
    synthesis: options.noDevice ? null : synthesis,
    UtteranceClass: Utterance,
    urlApi: {
      createObjectURL: blob => { const url = `blob:voice-${createdUrls.length + 1}`; createdUrls.push({ url, blob }); return url; },
      revokeObjectURL: url => revokedUrls.push(url),
    },
  });
  speakers.add(speaker);
  return { speaker, states, requests, audio, utterances, createdUrls, revokedUrls, lastState: () => states.at(-1), cancelCount: () => cancelCount };
}

test("cleans teaching markup and bounds the text sent to the same-origin voice function", async () => {
  const f = fixture();
  await f.speaker.speak("## Hello, **Yusuf**. [Read together](https://example.com).", { voice: "storyteller" });
  assert.equal(prepareTeacherText(null), "");
  assert.equal(f.requests[0].url, "/.netlify/functions/teacher-voice");
  assert.equal(f.requests[0].method, "POST");
  assert.equal(f.requests[0].credentials, "same-origin");
  assert.deepEqual(JSON.parse(f.requests[0].body), { text: "Hello, Yusuf. Read together.", voice: "storyteller" });
  assert.ok(f.requests[0].signal instanceof AbortSignal);
  assert.equal(f.lastState().status, "playing");
  assert.equal(f.lastState().source, "natural");
});

test("too-long narration fails visibly without charging for generation or silently truncating", async () => {
  const f = fixture();
  let done = 0;
  await f.speaker.speak("a".repeat(MAX_TEACHER_TEXT_LENGTH + 1), { onDone: () => done++ });
  assert.equal(f.requests.length, 0);
  assert.equal(f.utterances.length, 0);
  assert.equal(f.lastState().status, "error");
  assert.match(f.lastState().message, /too long/);
  assert.equal(done, 1);
});

test("normal audio completion calls onDone once and releases its decoder and object URL", async () => {
  const f = fixture();
  let done = 0;
  await f.speaker.speak("Let us learn one letter.", { onDone: () => done++ });
  const ended = f.audio[0].onended;
  assert.equal(done, 0);
  ended(); ended();
  assert.equal(done, 1);
  assert.equal(f.lastState().status, "idle");
  assert.equal(f.audio[0].pauseCount, 1);
  assert.deepEqual(f.revokedUrls, ["blob:voice-1"]);
});

test("loading is observable before the natural audio request resolves", async () => {
  const waiting = deferred();
  const f = fixture({ fetch: () => waiting.promise });
  const setup = f.speaker.speak("A warm welcome.");
  assert.equal(f.lastState().status, "loading");
  assert.equal(f.audio.length, 0);
  waiting.resolve(audioResponse());
  await setup;
  assert.equal(f.lastState().status, "playing");
});

test("cancel during generation aborts the request and ignores an uncooperative late response", async () => {
  const waiting = deferred();
  const f = fixture({ fetch: () => waiting.promise });
  let done = 0;
  const setup = f.speaker.speak("Let us continue.", { onDone: () => done++ });
  f.speaker.cancel();
  const eventsAfterCancel = f.states.length;
  assert.equal(f.requests[0].signal.aborted, true);
  waiting.resolve(audioResponse());
  await setup;
  assert.equal(f.states.length, eventsAfterCancel);
  assert.equal(f.audio.length, 0);
  assert.equal(f.utterances.length, 0);
  assert.equal(done, 0);
});

test("aborted generation never starts the device fallback", async () => {
  const f = fixture({ fetch: (_url, request) => new Promise((_resolve, reject) => {
    request.signal.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true });
  }) });
  const setup = f.speaker.speak("Teacher reply.");
  f.speaker.cancel();
  await setup;
  assert.equal(f.utterances.length, 0);
  assert.equal(f.lastState().status, "idle");
});

test("replacement prevents old audio events from clearing the new teacher or advancing its lesson", async () => {
  const f = fixture();
  let oldDone = 0, newDone = 0;
  await f.speaker.speak("First explanation.", { onDone: () => oldDone++ });
  const oldEnd = f.audio[0].onended, oldPlaying = f.audio[0].onplaying, oldError = f.audio[0].onerror;
  const oldEventCount = f.states.length;
  await f.speaker.speak("Answer to a raised hand.", { onDone: () => newDone++ });
  assert.equal(f.states.slice(oldEventCount).some(item => item.status === "idle"), false);
  oldEnd(); oldPlaying(); oldError();
  assert.equal(oldDone, 0);
  assert.equal(newDone, 0);
  assert.equal(f.lastState().status, "playing");
  assert.equal(f.utterances.length, 0);
  f.audio[1].onended();
  assert.equal(newDone, 1);
});

test("replaced generation cannot override a newer reply even if it resolves last", async () => {
  const waiting = deferred();
  let fetchCount = 0;
  const f = fixture({ fetch: () => ++fetchCount === 1 ? waiting.promise : Promise.resolve(audioResponse()) });
  let oldDone = 0;
  const oldSetup = f.speaker.speak("Old reply.", { onDone: () => oldDone++ });
  await f.speaker.speak("New reply.");
  waiting.resolve(audioResponse());
  await oldSetup;
  assert.equal(f.audio.length, 1);
  assert.equal(f.lastState().status, "playing");
  assert.equal(oldDone, 0);
});

test("a late play promise cannot revive canceled audio", async () => {
  const playing = deferred();
  const f = fixture({ play: () => playing.promise });
  const setup = f.speaker.speak("An explanation.");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.audio.length, 1);
  f.speaker.cancel();
  playing.resolve();
  await setup;
  assert.equal(f.lastState().status, "idle");
  assert.equal(f.audio[0].pauseCount, 1);
});

test("blocked browser audio is preserved and resumed without another synthesis request", async () => {
  let plays = 0, done = 0;
  const f = fixture({ play: element => {
    if (++plays === 1) return Promise.reject(new DOMException("Gesture required", "NotAllowedError"));
    element.onplaying?.(); return Promise.resolve();
  } });
  await f.speaker.speak("Hello class.", { onDone: () => done++ });
  assert.equal(f.lastState().status, "blocked");
  assert.equal(f.lastState().source, "natural");
  assert.match(f.lastState().message, /Tap Play/);
  assert.equal(f.revokedUrls.length, 0);
  assert.equal(f.utterances.length, 0);
  assert.equal(done, 0);
  await f.speaker.resume();
  assert.equal(f.requests.length, 1);
  assert.equal(f.audio.length, 1);
  assert.equal(f.lastState().status, "playing");
  f.audio[0].onended();
  assert.equal(done, 1);
});

test("canceling blocked audio prevents resume from replaying it", async () => {
  const f = fixture({ play: () => Promise.reject(new DOMException("Blocked", "NotAllowedError")) });
  let done = 0;
  await f.speaker.speak("Teacher greeting.", { onDone: () => done++ });
  f.speaker.cancel();
  await f.speaker.resume();
  assert.equal(f.lastState().status, "idle");
  assert.equal(f.requests.length, 1);
  assert.equal(done, 0);
  assert.deepEqual(f.revokedUrls, ["blob:voice-1"]);
});

test("server failure visibly falls back and keeps that explanation visible after completion", async () => {
  const f = fixture({ fetch: async () => new Response("not configured", { status: 503 }) });
  let done = 0;
  await f.speaker.speak("A teacher reply.", { onDone: () => done++ });
  assert.equal(f.lastState().source, "device");
  assert.equal(f.lastState().status, "playing");
  assert.match(f.lastState().message, /Natural voice unavailable/);
  f.utterances[0].onend();
  assert.equal(done, 1);
  assert.equal(f.lastState().status, "idle");
  assert.match(f.lastState().message, /Using your device/);
});

test("non-audio and empty responses fall back without creating a fake playable track", async () => {
  for (const response of [new Response("{}", { headers: { "Content-Type": "application/json" } }), new Response(new Blob([], { type: "audio/mpeg" }))]) {
    const f = fixture({ fetch: async () => response });
    await f.speaker.speak("Instruction.");
    assert.equal(f.audio.length, 0);
    assert.equal(f.utterances.length, 1);
    assert.equal(f.lastState().source, "device");
  }
});

test("a media decoding failure releases audio and only starts one device narration", async () => {
  const f = fixture();
  let done = 0;
  await f.speaker.speak("Instruction.", { onDone: () => done++ });
  const failed = f.audio[0].onerror;
  failed(); failed();
  assert.equal(f.utterances.length, 1);
  assert.equal(f.audio[0].pauseCount, 1);
  assert.equal(f.revokedUrls.length, 1);
  assert.equal(done, 0);
  f.utterances[0].onend();
  assert.equal(done, 1);
});

test("explicit device voice bypasses the server and respects the chosen installed voice", async () => {
  const f = fixture();
  let done = 0;
  await f.speaker.speak("Welcome.", { voice: "device", deviceVoiceURI: "device-two", onDone: () => done++ });
  assert.equal(f.requests.length, 0);
  assert.equal(f.utterances[0].voice.voiceURI, "device-two");
  assert.equal(f.lastState().source, "device");
  const oldEnd = f.utterances[0].onend;
  f.speaker.cancel(); oldEnd();
  assert.equal(done, 0);
  assert.equal(f.cancelCount(), 1);
});

test("blocked device speech can be retried from a user gesture without a server request", async () => {
  const f = fixture({ deviceStarts: false });
  let done = 0;
  await f.speaker.speak("Welcome.", { voice: "device", onDone: () => done++ });
  const oldEnd = f.utterances[0].onend;
  f.utterances[0].onerror({ error: "not-allowed" });
  assert.equal(f.lastState().status, "blocked");
  await f.speaker.resume();
  oldEnd();
  assert.equal(done, 0);
  assert.equal(f.utterances.length, 2);
  f.utterances[1].onstart();
  assert.equal(f.lastState().status, "playing");
  f.utterances[1].onend();
  assert.equal(done, 1);
  assert.equal(f.requests.length, 0);
});

test("unrecoverable voice failure advances out of the busy state once", async () => {
  const f = fixture({ noDevice: true, fetch: async () => { throw new TypeError("Offline"); } });
  let done = 0;
  await f.speaker.speak("Read the lesson.", { onDone: () => done++ });
  assert.equal(f.lastState().status, "error");
  assert.match(f.lastState().message, /read the lesson/);
  assert.equal(done, 1);
});

test("replay reuses only the matching voice/text Blob and still releases each playback URL", async () => {
  const f = fixture();
  await f.speaker.speak("Same preview.");
  f.audio[0].onended();
  await f.speaker.speak("Same preview.");
  assert.equal(f.requests.length, 1);
  f.audio[1].onended();
  assert.deepEqual(f.revokedUrls, ["blob:voice-1", "blob:voice-2"]);
  await f.speaker.speak("Same preview.", { voice: "storyteller" });
  assert.equal(f.requests.length, 2);
});

test("dispose suppresses late callbacks, fallback and future speak calls", async () => {
  const waiting = deferred();
  const f = fixture({ fetch: () => waiting.promise });
  let done = 0;
  const setup = f.speaker.speak("Late opening.", { onDone: () => done++ });
  f.speaker.dispose();
  const events = f.states.length;
  waiting.reject(new TypeError("Late network failure"));
  await setup;
  await f.speaker.speak("Stale chat reply.");
  await f.speaker.resume();
  assert.equal(f.requests.length, 1);
  assert.equal(f.utterances.length, 0);
  assert.equal(f.states.length, events);
  assert.equal(done, 0);
});

test("a consumer canceling on loading prevents generation and does not advance the lesson", async () => {
  const f = fixture({ onState: (state, speaker) => { if (state.status === "loading") speaker.cancel(); } });
  let done = 0;
  await f.speaker.speak("Canceled immediately.", { onDone: () => done++ });
  assert.equal(f.requests.length, 0);
  assert.equal(done, 0);
  assert.equal(f.lastState().status, "idle");
});
