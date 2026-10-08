import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryVideosHandler, durationSeconds, parseChannelSource } from './storyVideos.mjs';

const SITE = 'https://classroom.example';
const CHANNEL = 'UC' + 'a'.repeat(22);
const OTHER_CHANNEL = 'UC' + 'b'.repeat(22);
const VIDEO = 'Abc_123-xyz';
const OTHER_VIDEO = 'Other123xyz';
const NOW = Date.UTC(2026, 9, 8, 18, 30);
const KEY = 'test-key-do-not-return';
function request(body, { origin = SITE, method = 'POST', type = 'application/json', headers = {} } = {}) {
  return new Request(`${SITE}/.netlify/functions/story-videos`, {
    method, headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': type, ...headers },
    ...(method !== 'GET' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}
function video(id = VIDEO, changes = {}) {
  return {
    id,
    snippet: { title: 'Original & unmodified title', channelTitle: 'Original channel', channelId: CHANNEL, liveBroadcastContent: 'none' },
    status: { privacyStatus: 'public', embeddable: true, madeForKids: true },
    contentDetails: { duration: 'PT5M2S' },
    paidProductPlacementDetails: { hasPaidProductPlacement: false },
    ...changes,
  };
}
function handler(fetcher, extraEnv = {}) {
  return createStoryVideosHandler({ env: { YOUTUBE_API_KEY: KEY, ...extraEnv }, fetcher, now: () => NOW });
}
const ok = items => Response.json({ items });

test('search uses fixed official URLs, bounded topic query and strict channel filters; metadata is minimized', async () => {
  const calls = [];
  const run = handler(async (url, init) => {
    calls.push({ url: new URL(url), init });
    return calls.length === 1 ? ok([{ id: { kind: 'youtube#video', videoId: VIDEO } }]) : ok([video()]);
  });
  const response = await run(request({ action: 'search', topic: 'nuh', channelId: CHANNEL, q: 'untrusted override' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { videos: [{
    id: VIDEO, title: 'Original & unmodified title', channelTitle: 'Original channel', channelId: CHANNEL,
    durationSeconds: 302, checkedAt: new Date(NOW).toISOString(),
  }] });
  assert.equal(calls.length, 2);
  const search = calls[0].url;
  assert.equal(search.origin, 'https://www.googleapis.com');
  assert.equal(search.pathname, '/youtube/v3/search');
  for (const [key, value] of Object.entries({ type: 'video', safeSearch: 'strict', videoEmbeddable: 'true', videoSyndicated: 'true', maxResults: '10', channelId: CHANNEL, relevanceLanguage: 'en' })) {
    assert.equal(search.searchParams.get(key), value);
  }
  assert.equal(search.searchParams.get('q'), 'Prophet Nuh Noah animated Islamic story for children');
  assert.equal(search.searchParams.has('key'), false);
  assert.equal(calls[0].init.headers['x-goog-api-key'], KEY);
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(calls[1].url.pathname, '/youtube/v3/videos');
  assert.equal(calls[1].url.searchParams.get('part'), 'snippet,status,contentDetails,paidProductPlacementDetails');
  assert.equal(calls[1].url.searchParams.get('id'), VIDEO);
  assert.equal(calls[1].url.searchParams.has('maxResults'), false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.has('Access-Control-Allow-Origin'), false);
});

test('missing key disables search and revalidation without contacting YouTube', async () => {
  let calls = 0;
  const run = createStoryVideosHandler({ env: {}, fetcher: async () => { calls++; throw new Error('Not expected'); } });
  for (const body of [{ action: 'search', topic: 'nuh', channelId: CHANNEL }, { action: 'validate', ids: [VIDEO] }]) {
    const response = await run(request(body));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /YOUTUBE_API_KEY/);
  }
  assert.equal(calls, 0);
});

test('same-origin POST JSON gate rejects foreign, absent or null origins before upstream access', async () => {
  const run = handler(async () => { assert.fail('No upstream call expected'); });
  for (const origin of ['https://attacker.example', undefined, 'null', `${SITE}/`, 'https://classroom.example.attacker.example']) {
    // Passing an empty string deliberately removes the header in request().
    const response = await run(request({ action: 'validate', ids: [VIDEO] }, { origin: origin ?? '' }));
    assert.equal(response.status, 403);
  }
  assert.equal((await run(request({}, { method: 'GET' }))).status, 405);
  assert.equal((await run(request({}, { type: 'text/plain' }))).status, 415);
  assert.equal((await run(request('{not json'))).status, 400);
  assert.equal((await run(request('[]'))).status, 400);
});

test('bounded body rejects both a declared excess and an oversized chunked request', async () => {
  const run = handler(async () => { assert.fail('No upstream call expected'); });
  assert.equal((await run(request({}, { headers: { 'Content-Length': '9999' } }))).status, 413);
  assert.equal((await run(request(JSON.stringify({ action: 'validate', ids: [VIDEO], extra: 'a'.repeat(9000) })))).status, 413);
});

test('invalid inputs cannot become arbitrary YouTube searches or upstream paths', async () => {
  const run = handler(async () => { assert.fail('No upstream call expected'); });
  for (const body of [
    { action: 'search', topic: '__proto__', channelId: CHANNEL },
    { action: 'search', topic: 'child name here', channelId: CHANNEL },
    { action: 'search', topic: 'nuh', channelId: 'https://youtube.com/watch?v=' + VIDEO },
    { action: 'search', topic: 'nuh', channelId: CHANNEL + 'x' },
    { action: 'validate', ids: [] },
    { action: 'validate', ids: ['https://youtube.com/watch?v=' + VIDEO] },
    { action: 'validate', ids: [null] },
    { action: 'validate', ids: Array(11).fill(VIDEO) },
    { action: 'upload', ids: [VIDEO] },
  ]) assert.equal((await run(request(body))).status, 400);
});

test('only public, embeddable, known Made-for-Kids ordinary videos of up to 20 minutes pass', async () => {
  const base = video();
  const excluded = [
    { status: { ...base.status, madeForKids: false } },
    { status: { ...base.status, madeForKids: undefined } },
    { status: { ...base.status, embeddable: false } },
    { status: { ...base.status, privacyStatus: 'unlisted' } },
    { snippet: { ...base.snippet, liveBroadcastContent: 'live' } },
    { snippet: { ...base.snippet, liveBroadcastContent: 'upcoming' } },
    { contentDetails: { duration: 'PT5M', contentRating: { ytRating: 'ytAgeRestricted' } } },
    { contentDetails: { duration: 'PT5M', regionRestriction: { allowed: ['US'] } } },
    { contentDetails: { duration: 'PT20M1S' } },
    { contentDetails: { duration: 'PT0S' } },
    { contentDetails: { duration: 'P1D' } },
    { contentDetails: { duration: 'broken' } },
    { paidProductPlacementDetails: { hasPaidProductPlacement: true } },
    { paidProductPlacementDetails: { hasPaidProductPlacement: 'false' } },
  ];
  for (const change of excluded) {
    const response = await handler(async () => ok([video(VIDEO, change)]))(request({ action: 'validate', ids: [VIDEO] }));
    assert.deepEqual(await response.json(), { videos: [] }, JSON.stringify(change));
  }
  const boundary = await handler(async () => ok([video(VIDEO, { contentDetails: { duration: 'PT20M' } })]))(request({ action: 'validate', ids: [VIDEO] }));
  assert.equal((await boundary.json()).videos[0].durationSeconds, 1200);
});

test('configured channel allowlist applies to search and arbitrary pasted video IDs', async () => {
  let calls = 0;
  const run = handler(async () => { calls++; return ok([video(VIDEO, { snippet: { ...video().snippet, channelId: OTHER_CHANNEL } })]); }, { YOUTUBE_ALLOWED_CHANNEL_IDS: CHANNEL });
  assert.equal((await run(request({ action: 'search', topic: 'musa', channelId: OTHER_CHANNEL }))).status, 403);
  assert.equal(calls, 0);
  assert.deepEqual(await (await run(request({ action: 'validate', ids: [VIDEO] }))).json(), { videos: [] });
  assert.equal(calls, 1);
  const broken = handler(async () => { assert.fail('No upstream call expected'); }, { YOUTUBE_ALLOWED_CHANNEL_IDS: 'invalid channel' });
  assert.equal((await broken(request({ action: 'validate', ids: [VIDEO] }))).status, 503);
});

test('search metadata cannot escape the parent-selected channel even without an environment allowlist', async () => {
  let calls = 0;
  const run = handler(async () => ++calls === 1
    ? ok([{ id: { kind: 'youtube#video', videoId: VIDEO } }])
    : ok([video(VIDEO, { snippet: { ...video().snippet, channelId: OTHER_CHANNEL } })]));
  assert.deepEqual(await (await run(request({ action: 'search', topic: 'yunus', channelId: CHANNEL }))).json(), { videos: [] });
});

test('validation is freshly fetched each time and excludes removed or unrequested IDs', async () => {
  let calls = 0;
  const run = handler(async () => ++calls === 1 ? ok([video(), video(OTHER_VIDEO)]) : ok([]));
  const first = await run(request({ action: 'validate', ids: [VIDEO, VIDEO] }));
  assert.deepEqual((await first.json()).videos.map(item => item.id), [VIDEO]);
  const next = await run(request({ action: 'validate', ids: [VIDEO] }));
  assert.deepEqual(await next.json(), { videos: [] });
  assert.equal(calls, 2);
});

test('upstream auth, quota, timeout and malformed responses never leak their details or key', async () => {
  for (const fetcher of [
    async () => Response.json({ error: { message: KEY } }, { status: 403 }),
    async () => { throw new DOMException(`Timeout ${KEY}`, 'TimeoutError'); },
    async () => Response.json({ invalid: KEY }),
    async () => new Response('invalid JSON ' + KEY),
  ]) {
    const response = await handler(fetcher)(request({ action: 'validate', ids: [VIDEO] }));
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes(KEY), false);
  }
});

test('empty search does not perform metadata fetch; nonvideo and malformed IDs are ignored', async () => {
  let calls = 0;
  const run = handler(async () => { calls++; return ok([{ id: { kind: 'youtube#channel', channelId: CHANNEL } }, { id: { kind: 'youtube#video', videoId: '../bad' } }]); });
  assert.deepEqual(await (await run(request({ action: 'search', topic: 'kindness', channelId: CHANNEL }))).json(), { videos: [] });
  assert.equal(calls, 1);
});

test('duration parsing supports YouTube clock durations and rejects unknown or empty values', () => {
  assert.equal(durationSeconds('PT1H2M3.5S'), 3723.5);
  assert.equal(durationSeconds('PT20M'), 1200);
  assert.equal(durationSeconds('PT0S'), 0);
  for (const value of ['PT', 'P1D', 'PT-2M', 'PTNaNS', undefined, 42]) assert.equal(durationSeconds(value), null);
});

test('channel input accepts IDs, ASCII handles and basic official channel links', () => {
  assert.deepEqual(parseChannelSource(CHANNEL), { id: CHANNEL });
  for (const handle of ['@KidsStories', '@a_b.c-9', '@abc', '@' + 'a'.repeat(30)]) {
    assert.deepEqual(parseChannelSource(handle), { handle });
    assert.deepEqual(parseChannelSource(`https://www.youtube.com/${handle}`), { handle });
    assert.deepEqual(parseChannelSource(` https://youtube.com/${handle}/ `), { handle });
  }
  for (const host of ['youtube.com', 'www.youtube.com']) {
    assert.deepEqual(parseChannelSource(`https://${host}/channel/${CHANNEL}`), { id: CHANNEL });
    assert.deepEqual(parseChannelSource(`https://${host}/channel/${CHANNEL}/`), { id: CHANNEL });
  }
});

test('handle resolution uses only channels.list then searches and reviews its exact resolved ID', async () => {
  const calls = [];
  const run = handler(async (url, init) => {
    calls.push({ url: new URL(url), init });
    if (calls.length === 1) return ok([{ id: CHANNEL }]);
    if (calls.length === 2) return ok([{ id: { kind: 'youtube#video', videoId: VIDEO } }]);
    return ok([video()]);
  });
  const response = await run(request({ action: 'search', topic: 'ibrahim', channelId: 'https://www.youtube.com/@KidsStories' }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).videos.map(item => item.channelId), [CHANNEL]);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url.href, 'https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=%40KidsStories');
  assert.equal(calls[1].url.searchParams.get('channelId'), CHANNEL);
  assert.equal(calls[1].url.searchParams.get('q'), 'Prophet Ibrahim Abraham animated Islamic story for children');
  assert.equal(calls[2].url.pathname, '/youtube/v3/videos');
  for (const call of calls) {
    assert.equal(call.url.origin, 'https://www.googleapis.com');
    assert.equal(call.init.headers['x-goog-api-key'], KEY);
    assert.equal(call.init.signal, calls[0].init.signal);
  }
});

test('a channel ID URL does not spend quota on a handle lookup', async () => {
  const paths = [];
  const run = handler(async url => { paths.push(new URL(url).pathname); return ok([]); });
  const response = await run(request({ action: 'search', topic: 'yusuf', channelId: `https://www.youtube.com/channel/${CHANNEL}` }));
  assert.deepEqual(await response.json(), { videos: [] });
  assert.deepEqual(paths, ['/youtube/v3/search']);
});

test('resolved handles must pass the configured allowlist before search consumes quota', async () => {
  const calls = [];
  const run = handler(async url => { calls.push(new URL(url)); return ok([{ id: OTHER_CHANNEL }]); }, { YOUTUBE_ALLOWED_CHANNEL_IDS: CHANNEL });
  const response = await run(request({ action: 'search', topic: 'nuh', channelId: '@UnapprovedChannel' }));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/youtube/v3/channels');
});

test('unknown or malformed handle resolution cannot fall through to an unrestricted search', async () => {
  for (const [items, status] of [[[], 404], [[{ id: '../bad' }], 502], [[{ id: CHANNEL }, { id: OTHER_CHANNEL }], 502]]) {
    let calls = 0;
    const run = handler(async () => { calls++; return ok(items); });
    const response = await run(request({ action: 'search', topic: 'nuh', channelId: '@MissingChannel' }));
    assert.equal(response.status, status);
    assert.equal(calls, 1);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('arbitrary URLs, URL tricks and unsupported handles are rejected before any upstream request', async () => {
  const run = handler(async () => { assert.fail('A submitted URL must never be fetched'); });
  for (const channelId of [
    'http://www.youtube.com/@KidsStories', 'https://127.0.0.1/@KidsStories',
    'https://youtube.com.attacker.example/@KidsStories', 'https://attacker.example/@KidsStories',
    'https://youtube.com@attacker.example/@KidsStories', 'https://attacker.example@youtube.com/@KidsStories',
    'https://www.youtube.com:443/@KidsStories', 'https://www.youtube.com/%40KidsStories',
    'https://www.youtube.com/other/../@KidsStories', 'https://www.youtube.com/@KidsStories/videos',
    'https://www.youtube.com/@KidsStories?redirect=https://attacker.example', 'https://www.youtube.com/@KidsStories#fragment',
    'https://www.youtube.com\\@KidsStories', 'https://www.youtube.com/@KidsStories\n',
    'https://www.youtube.com/c/KidsStories', 'file:///etc/passwd', '@ab', '@' + 'a'.repeat(31),
    '@_KidsStories', '@KidsStories-', '@قناة_أطفال', 'a'.repeat(151), null,
  ]) {
    const response = await run(request({ action: 'search', topic: 'nuh', channelId }));
    assert.equal(response.status, 400, String(channelId));
  }
});
