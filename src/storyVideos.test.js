import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { STORY_STORAGE_KEY, PIN_ITERATIONS, emptyStorySettings, detectStoryTopic, createStoryPin, verifyStoryPin, recordPinAttempt, loadStorySettings, saveStorySettings, resetStorySettings, approveStoryVideo, approvedVideoForLesson, createStoryEmbedUrl, fetchStoryVideos, validateApprovedPlayback, isChannelSource, isChannelId } from "./storyVideos.js";

const channelId = `UC${"a".repeat(22)}`;
const id = "abcdefghijk";
const metadata = () => ({ id, title: "A parent-reviewed story", channelTitle: "Reviewed channel", channelId, durationSeconds: 180, checkedAt: new Date().toISOString() });
const pinRecord = { salt: "a".repeat(32), hash: "b".repeat(64), iterations: PIN_ITERATIONS };
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
test("story matching recognizes only supported names, whole words, Arabic, and rejects ambiguous lessons", () => {
  assert.equal(detectStoryTopic("The story of Prophet Nuh teaches us kindness."), "nuh");
  assert.equal(detectStoryTopic("نبي الله نُوح"), "nuh");
  assert.equal(detectStoryTopic("Today we learn about Moses"), "musa");
  assert.equal(detectStoryTopic("Being kind and helping others"), "kindness");
  assert.equal(detectStoryTopic("Nuh and Musa are Prophets"), null);
  assert.equal(detectStoryTopic("Josephine will write alif"), null);
  assert.equal(detectStoryTopic("Unkindness is a longer word"), null);
  assert.equal(detectStoryTopic("Arabic letters"), null);
  assert.equal(detectStoryTopic(null), null);
});
test("video PIN uses fresh random salts and PBKDF2, verifies actual digits, rejects short PINs", async () => {
  const first = await createStoryPin("123456", webcrypto);
  const second = await createStoryPin("123456", webcrypto);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(first.iterations, PIN_ITERATIONS);
  assert.equal(await verifyStoryPin("123456", first, webcrypto), true);
  assert.equal(await verifyStoryPin("654321", first, webcrypto), false);
  assert.equal(await verifyStoryPin("123456", { ...first, iterations: 1 }, webcrypto), false);
  await assert.rejects(createStoryPin("12345", webcrypto), /6–32 digits/);
});
test("PIN lockout counts failed attempts and cannot be removed by submitting during lockout", () => {
  let state = { ...emptyStorySettings(), pin: pinRecord };
  for (let count = 0; count < 5; count++) state = recordPinAttempt(state, false, 100);
  assert.equal(state.lock.until, 60100);
  assert.throws(() => recordPinAttempt(state, true, 101), /one minute/);
  assert.deepEqual(recordPinAttempt(state, true, 60101).lock, { fails: 0, until: 0 });
});
test("approval needs explicit adult review, stores no API title/duration/metadata, and matches only approved topic", () => {
  const state = { ...emptyStorySettings(), pin: pinRecord };
  assert.throws(() => approveStoryVideo(state, "nuh", metadata(), false), /adult must review/);
  assert.throws(() => approveStoryVideo(emptyStorySettings(), "nuh", metadata(), true), /adult must review/);
  const approved = approveStoryVideo(state, "nuh", metadata(), true);
  assert.deepEqual(Object.keys(approved.approvals[0]).sort(), ["channelId", "id", "reviewedAt", "topic"]);
  assert.equal(approvedVideoForLesson(approved, "Prophet Noah")?.id, id);
  assert.equal(approvedVideoForLesson(approved, "Prophet Yusuf"), null);
  const replaced = approveStoryVideo(approved, "nuh", { ...metadata(), id: "zyxwvutsrqp" }, true);
  assert.equal(replaced.approvals.length, 1);
  assert.equal(replaced.approvals[0].id, "zyxwvutsrqp");
});
test("local approvals survive reload, reject malformed/raw embeds, and reset requires explicit confirmation", () => {
  const storage = memoryStorage();
  const approved = approveStoryVideo({ ...emptyStorySettings(), pin: pinRecord }, "nuh", metadata(), true);
  saveStorySettings(approved, storage);
  assert.deepEqual(loadStorySettings(storage), approved);
  assert.equal(storage.getItem(STORY_STORAGE_KEY).includes("checkedAt"), false);
  assert.throws(() => resetStorySettings(false, storage), /Confirm removal/);
  assert.equal(loadStorySettings(storage).approvals.length, 1);
  resetStorySettings(true, storage);
  assert.deepEqual(loadStorySettings(storage), emptyStorySettings());
  storage.setItem(STORY_STORAGE_KEY, JSON.stringify({ ...approved, approvals: [{ ...approved.approvals[0], id: "https://youtube.com/embed/anything" }] }));
  assert.throws(() => loadStorySettings(storage), /could not be read/);
});
test("embed URL accepts an exact ID, uses privacy-enhanced origin and leaves official controls visible", () => {
  const url = new URL(createStoryEmbedUrl(id));
  assert.equal(url.origin, "https://www.youtube-nocookie.com");
  assert.equal(url.searchParams.get("autoplay"), "0");
  assert.equal(url.searchParams.get("controls"), "1");
  assert.throws(() => createStoryEmbedUrl("x?autoplay=1"), /Invalid/);
});
test("channel search accepts handles, basic YouTube links, or canonical IDs while metadata IDs remain strict", () => {
  for (const source of [channelId, "@YourTrustedChannel", " @YourTrustedChannel ", "https://youtube.com/@YourTrustedChannel", "https://www.youtube.com/@YourTrustedChannel/", `https://www.youtube.com/channel/${channelId}`]) assert.equal(isChannelSource(source), true, source);
  for (const source of ["someone", "@ab", "@.channel", "@channel_", "https://evil.example/@YourTrustedChannel", "https://youtube.com.evil.example/@YourTrustedChannel", "https://youtube.com:443/@YourTrustedChannel", "https://youtube.com/watch?v=abcdefghijk", "https://youtube.com/@YourTrustedChannel/videos", "https://youtube.com/@YourTrustedChannel?si=token", "https://youtube.com/%40YourTrustedChannel", "https://youtube.com\\@YourTrustedChannel", "\n@YourTrustedChannel", "@" + "a".repeat(31)]) assert.equal(isChannelSource(source), false, source);
  assert.equal(isChannelId("@YourTrustedChannel"), false);
  assert.equal(isChannelId(channelId), true);
});
test("search only reaches same-origin POST with an explicit topic and channel source; invalid requests never fetch", async () => {
  let calls = 0;
  const requestedSources = [];
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, "/.netlify/functions/story-videos"); assert.equal(options.method, "POST");
    assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "same-origin");
    assert.equal(JSON.parse(options.body).action, "search");
    assert.equal(JSON.parse(options.body).topic, "nuh");
    requestedSources.push(JSON.parse(options.body).channelId);
    return Response.json({ videos: [metadata()] });
  };
  await assert.rejects(fetchStoryVideos({ action: "search", topic: "nuh", channelId: "https://evil.example/@a-channel" }, { fetcher }), /YouTube @handle/);
  assert.equal(calls, 0);
  assert.equal((await fetchStoryVideos({ action: "search", topic: "nuh", channelId }, { fetcher }))[0].id, id);
  assert.equal((await fetchStoryVideos({ action: "search", topic: "nuh", channelId: "@YourTrustedChannel" }, { fetcher }))[0].channelId, channelId);
  assert.equal((await fetchStoryVideos({ action: "search", topic: "nuh", channelId: "https://www.youtube.com/@YourTrustedChannel" }, { fetcher }))[0].channelId, channelId);
  assert.equal(calls, 3);
  assert.deepEqual(requestedSources, [channelId, "@YourTrustedChannel", "https://www.youtube.com/@YourTrustedChannel"]);
});
test("a missing channel provides a useful correction without falling back to an embed", async () => {
  await assert.rejects(fetchStoryVideos({ action: "search", topic: "nuh", channelId: "@YourTrustedChannel" }, { fetcher: async () => Response.json({ error: "not found" }, { status: 404 }) }), /Check its @handle/);
});
test("every playback revalidates metadata and prevents changed channels, removed videos, and unconfigured API fallback", async () => {
  const approval = { id, topic: "nuh", channelId, reviewedAt: new Date().toISOString() };
  let calls = 0;
  const fetcher = async (_url, options) => { calls++; assert.deepEqual(JSON.parse(options.body), { action: "validate", ids: [id] }); return Response.json({ videos: [metadata()] }); };
  await validateApprovedPlayback(approval, { fetcher }); await validateApprovedPlayback(approval, { fetcher });
  assert.equal(calls, 2);
  await assert.rejects(validateApprovedPlayback(approval, { fetcher: async () => Response.json({ videos: [] }) }), /no longer available/);
  await assert.rejects(validateApprovedPlayback(approval, { fetcher: async () => Response.json({ videos: [{ ...metadata(), channelId: `UC${"b".repeat(22)}` }] }) }), /no longer available/);
  await assert.rejects(validateApprovedPlayback(approval, { fetcher: async () => Response.json({ error: "not configured" }, { status: 503 }) }), /configure the YouTube API key/);
});
test("malformed metadata or network failures cannot produce a playable record", async () => {
  for (const invalid of [{ ...metadata(), durationSeconds: 0 }, { ...metadata(), durationSeconds: 1201 }, { ...metadata(), checkedAt: "invalid" }]) {
    await assert.rejects(fetchStoryVideos({ action: "validate", ids: [id] }, { fetcher: async () => Response.json({ videos: [invalid] }) }), /information was incomplete/);
  }
  await assert.rejects(fetchStoryVideos({ action: "validate", ids: [id] }, { fetcher: async () => { throw new TypeError("offline"); } }), /internet connection/);
});
