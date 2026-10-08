export const STORY_TOPICS = Object.freeze({
  nuh: { label: "Prophet Nuh (Noah)", names: ["nuh", "noah", "نوح"] },
  ibrahim: { label: "Prophet Ibrahim (Abraham)", names: ["ibrahim", "abraham", "إبراهيم", "ابراهيم"] },
  musa: { label: "Prophet Musa (Moses)", names: ["musa", "moses", "موسى"] },
  yunus: { label: "Prophet Yunus (Jonah)", names: ["yunus", "younus", "jonah", "يونس"] },
  yusuf: { label: "Prophet Yusuf (Joseph)", names: ["yusuf", "yousuf", "joseph", "يوسف"] },
  kindness: { label: "Kindness", names: ["kindness", "being kind", "helping others", "الرفق", "الإحسان", "الاحسان"] },
});
export const STORY_STORAGE_KEY = "noor-story-videos-v1";
export const PIN_ITERATIONS = 600000;
const videoPattern = /^[A-Za-z0-9_-]{11}$/;
const channelPattern = /^UC[A-Za-z0-9_-]{22}$/;
const isDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
export const isVideoId = id => typeof id === "string" && videoPattern.test(id);
export const isChannelId = id => typeof id === "string" && channelPattern.test(id);
/** Search accepts human-readable channel sources; stored approval metadata stays canonical. */
export function isChannelSource(value) {
  if (typeof value !== "string" || /[^\x20-\x7E]|\\/.test(value)) return false;
  const source = value.trim();
  if (!source || source.length > 150) return false;
  const handle = /^@[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;
  if (isChannelId(source) || handle.test(source)) return true;
  const link = source.match(/^https:\/\/(?:www\.)?youtube\.com\/([^?#%\\]+?)\/?$/i);
  if (!link) return false;
  return handle.test(link[1]) || (link[1].startsWith("channel/") && isChannelId(link[1].slice(8)));
}
export const isStoryTopic = topic => Object.hasOwn(STORY_TOPICS, topic);

/** Conservative local matching; an ambiguous lesson never chooses a random story. */
export function detectStoryTopic(text) {
  if (typeof text !== "string") return null;
  const normalized = text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const containsName = name => {
    const match = name.normalize("NFKD").replace(/\p{M}/gu, "");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${match}($|[^\\p{L}\\p{N}])`, "u").test(normalized);
  };
  const found = Object.entries(STORY_TOPICS).filter(([topic, value]) => topic !== "kindness" && value.names.some(containsName)).map(([topic]) => topic);
  if (found.length > 1) return null;
  if (found.length === 1) return found[0];
  return STORY_TOPICS.kindness.names.some(containsName) ? "kindness" : null;
}

export function emptyStorySettings() { return { version: 1, pin: null, approvals: [], lock: { fails: 0, until: 0 } }; }
function validPinRecord(pin) {
  return pin && /^[a-f0-9]{32}$/.test(pin.salt) && /^[a-f0-9]{64}$/.test(pin.hash) && pin.iterations === PIN_ITERATIONS;
}
function cleanApproval(record) {
  if (!record || !isVideoId(record.id) || !isChannelId(record.channelId) || !isStoryTopic(record.topic) || !isDate(record.reviewedAt)) throw new Error("Stored story approvals are invalid. Reset video settings to remove the approvals and PIN.");
  return { id: record.id, topic: record.topic, channelId: record.channelId, reviewedAt: record.reviewedAt };
}
export function sanitizeStorySettings(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.approvals) || value.approvals.length > 6 || (value.pin !== null && !validPinRecord(value.pin)) || (!value.pin && value.approvals.length)) throw new Error("Stored video settings could not be read. Reset removes all video approvals and the local PIN.");
  const approvals = value.approvals.map(cleanApproval);
  if (new Set(approvals.map(item => item.topic)).size !== approvals.length) throw new Error("Stored video settings contain duplicate topics. Reset the video settings.");
  const lock = value.lock ?? { fails: 0, until: 0 };
  if (!Number.isSafeInteger(lock.fails) || lock.fails < 0 || !Number.isFinite(lock.until) || lock.until < 0) throw new Error("Stored video PIN lock could not be read. Reset the video settings.");
  return { version: 1, pin: value.pin ? { salt: value.pin.salt, hash: value.pin.hash, iterations: PIN_ITERATIONS } : null, approvals, lock: { fails: lock.fails, until: lock.until } };
}
export function loadStorySettings(storage = globalThis.localStorage) {
  const raw = storage.getItem(STORY_STORAGE_KEY);
  if (raw === null) return emptyStorySettings();
  try { return sanitizeStorySettings(JSON.parse(raw)); }
  catch { throw new Error("Stored video settings could not be read. Reset removes all video approvals and the local PIN."); }
}
export function saveStorySettings(settings, storage = globalThis.localStorage) {
  const clean = sanitizeStorySettings(settings);
  storage.setItem(STORY_STORAGE_KEY, JSON.stringify(clean));
  return clean;
}
export function resetStorySettings(confirmed, storage = globalThis.localStorage) {
  if (confirmed !== true) throw new Error("Confirm removal of every video approval and the PIN first.");
  storage.removeItem(STORY_STORAGE_KEY);
  return emptyStorySettings();
}
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
const unhex = text => Uint8Array.from(text.match(/.{2}/g), value => parseInt(value, 16));
async function pinHash(pin, salt, cryptoApi) {
  if (!cryptoApi?.subtle) throw new Error("A secure HTTPS connection is needed to protect the local video PIN.");
  const key = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await cryptoApi.subtle.deriveBits({ name: "PBKDF2", salt: unhex(salt), iterations: PIN_ITERATIONS, hash: "SHA-256" }, key, 256)));
}
export async function createStoryPin(pin, cryptoApi = globalThis.crypto) {
  if (!/^\d{6,32}$/.test(pin)) throw new Error("Choose a PIN with 6–32 digits.");
  if (!cryptoApi?.subtle) throw new Error("Use HTTPS to create the local video PIN.");
  const salt = hex(cryptoApi.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await pinHash(pin, salt, cryptoApi), iterations: PIN_ITERATIONS };
}
export async function verifyStoryPin(pin, record, cryptoApi = globalThis.crypto) {
  if (!validPinRecord(record) || !/^\d{6,32}$/.test(pin)) return false;
  const result = await pinHash(pin, record.salt, cryptoApi);
  let difference = 0;
  for (let index = 0; index < result.length; index++) difference |= result.charCodeAt(index) ^ record.hash.charCodeAt(index);
  return difference === 0;
}
export function recordPinAttempt(settings, successful, now = Date.now()) {
  if (settings.lock.until > now) throw new Error("Too many PIN attempts. Wait one minute before trying again.");
  const fails = successful ? 0 : settings.lock.fails + 1;
  return { ...settings, lock: { fails, until: fails >= 5 ? now + 60000 : 0 } };
}

export function validateVideoMetadata(video) {
  if (!video || !isVideoId(video.id) || !isChannelId(video.channelId) || typeof video.title !== "string" || !video.title.trim() || video.title.length > 500 || typeof video.channelTitle !== "string" || video.channelTitle.length > 200 || !Number.isFinite(video.durationSeconds) || video.durationSeconds <= 0 || video.durationSeconds > 1200 || !isDate(video.checkedAt)) throw new Error("Video information was incomplete. No player was loaded.");
  return { id: video.id, title: video.title, channelTitle: video.channelTitle, channelId: video.channelId, durationSeconds: video.durationSeconds, checkedAt: video.checkedAt };
}
export function approveStoryVideo(settings, topic, video, reviewed, now = new Date().toISOString()) {
  const checked = validateVideoMetadata(video);
  if (!settings.pin || !isStoryTopic(topic) || reviewed !== true || !isDate(now)) throw new Error("An adult must review this recording and confirm its suitability, animation, and religious accuracy before approving it.");
  const approval = { id: checked.id, topic, channelId: checked.channelId, reviewedAt: now };
  return sanitizeStorySettings({ ...settings, approvals: [...settings.approvals.filter(item => item.topic !== topic), approval] });
}
export function approvedVideoForLesson(settings, text) {
  const topic = detectStoryTopic(text);
  return topic ? settings.approvals.find(item => item.topic === topic) ?? null : null;
}
export function createStoryEmbedUrl(id) {
  if (!isVideoId(id)) throw new Error("Invalid approved video ID.");
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&controls=1&playsinline=1&rel=0`;
}
export async function fetchStoryVideos(payload, { fetcher = globalThis.fetch, signal, timeoutMs = 20000 } = {}) {
  if (payload.action === "search") {
    if (!isStoryTopic(payload.topic) || !isChannelSource(payload.channelId)) throw new Error("Choose a story topic and enter a YouTube @handle or basic channel link without /videos or extra parameters.");
  } else if (payload.action !== "validate" || !Array.isArray(payload.ids) || !payload.ids.length || payload.ids.length > 10 || payload.ids.some(id => !isVideoId(id))) throw new Error("Invalid video validation request.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher("/.netlify/functions/story-videos", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify(payload), signal: controller.signal });
    if (response.status === 503) throw new Error("Story video search is not set up yet. The site owner must configure the YouTube API key and allowed channels. No video was loaded.");
    if (response.status === 403) throw new Error("This channel is not enabled for story videos. Ask the site owner to allow the reviewed channel.");
    if (response.status === 404 && payload.action === "search") throw new Error("This YouTube channel was not found. Check its @handle or paste a basic channel link.");
    if (!response.ok) throw new Error("The video service is unavailable. Try again later; no video was loaded.");
    const data = await response.json();
    if (!Array.isArray(data.videos) || data.videos.length > 20) throw new Error("Invalid story video response.");
    return data.videos.map(validateVideoMetadata);
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The video request was cancelled or took too long. Try again.");
    if (error instanceof TypeError) throw new Error("Could not reach story videos. Check your internet connection.");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function validateApprovedPlayback(approval, options) {
  cleanApproval(approval);
  const videos = await fetchStoryVideos({ action: "validate", ids: [approval.id] }, options);
  const video = videos.find(item => item.id === approval.id && item.channelId === approval.channelId);
  if (!video) throw new Error("This video is no longer available or eligible for embedding. Ask a parent to review a replacement. No player was loaded.");
  return video;
}
