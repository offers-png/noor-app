import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import { shouldHoldScreen } from '../src/services/parent/lockPolicy';
import { createContentHandler } from '../server/proxy.mjs';
import { allowPlayerNavigation, playerHtml, searchStoryVideos, stillPermitted, StoryVideoLibrary, STORY_TOPICS } from '../src/services/videos/StoryVideos';

test('the screen is held only when the parent turned the lock on, a child is selected, and it is not paused', () => {
  assert.equal(shouldHoldScreen({ enabled: true, childSelected: true, suspendedByParent: false }), true);
  assert.equal(shouldHoldScreen({ enabled: false, childSelected: true, suspendedByParent: false }), false);
  assert.equal(shouldHoldScreen({ enabled: true, childSelected: false, suspendedByParent: false }), false);
  assert.equal(shouldHoldScreen({ enabled: true, childSelected: true, suspendedByParent: true }), false);
});

test('the native lock module is autolinkable and declares only an inactive device-admin receiver', () => {
  const config = JSON.parse(readFileSync(new URL('../modules/kids-lock/expo-module.config.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.android.modules, ['expo.modules.kidslock.KidsLockModule']);
  const manifest = readFileSync(new URL('../modules/kids-lock/android/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android:permission="android.permission.BIND_DEVICE_ADMIN"/);
  assert.doesNotMatch(manifest, /uses-permission/, 'no extra Android permissions');
  const kotlin = readFileSync(new URL('../modules/kids-lock/android/src/main/java/expo/modules/kidslock/KidsLockModule.kt', import.meta.url), 'utf8');
  for (const name of ['getState', 'isDeviceOwner', 'start', 'stop', 'releaseDeviceOwner']) assert.match(kotlin, new RegExp(`Function\\("${name}"\\)`));
  assert.match(kotlin, /startLockTask\(\)/); assert.match(kotlin, /setLockTaskPackages/);
});

const CHANNEL = 'UC' + 'a'.repeat(22);
const KIDS = 'Abc_123-xyz'; const NOT_KIDS = 'Other123xyz';
function youtubeVideo(id: string, madeForKids: boolean) {
  return { id, snippet: { title: `Story ${id}`, channelTitle: 'Trusted channel', channelId: CHANNEL, liveBroadcastContent: 'none' },
    status: { privacyStatus: 'public', embeddable: true, madeForKids }, contentDetails: { duration: 'PT6M' }, paidProductPlacementDetails: { hasPaidProductPlacement: false } };
}
function phone(env: Record<string, string>, calls: { url: string; key?: string }[] = []): typeof fetch {
  const handler = createContentHandler({ env, fetcher: async (input, init) => {
    const url = new URL(String(input)); calls.push({ url: url.toString(), key: (init?.headers as Record<string, string>)?.['x-goog-api-key'] });
    if (url.pathname.endsWith('/search')) return Response.json({ items: [{ id: { kind: 'youtube#video', videoId: KIDS } }, { id: { kind: 'youtube#video', videoId: NOT_KIDS } }] });
    return Response.json({ items: [youtubeVideo(KIDS, true), youtubeVideo(NOT_KIDS, false)].filter(item => url.searchParams.get('id')!.split(',').includes(item.id)) });
  } });
  return (async (input: string | URL | Request) => handler(new Request(String(input)))) as typeof fetch;
}

test('the phone searches through the content server: only Made for Kids videos come back and the YouTube key stays on the server', async () => {
  const calls: { url: string; key?: string }[] = [];
  const videos = await searchStoryVideos('https://site.example/content', 'adam', CHANNEL, () => true, phone({ YOUTUBE_API_KEY: 'server-key' }, calls));
  assert.deepEqual(videos.map(video => video.id), [KIDS]);
  assert.match(calls[0].url, /q=Prophet\+Adam\+creation\+story/); assert.equal(calls[0].key, 'server-key');
  assert.equal(JSON.stringify(videos).includes('server-key'), false);
  assert.equal(await stillPermitted('https://site.example/content', KIDS, () => true, phone({ YOUTUBE_API_KEY: 'k' })), true);
  assert.equal(await stillPermitted('https://site.example/content', NOT_KIDS, () => true, phone({ YOUTUBE_API_KEY: 'k' })), false);
  assert.ok('creation' in STORY_TOPICS && 'adam' in STORY_TOPICS);
});

test('clear messages without a key, without network, or for channels outside the allow-list', async () => {
  await assert.rejects(searchStoryVideos('https://site.example/content', 'nuh', CHANNEL, () => true, phone({})), /YOUTUBE_API_KEY/);
  await assert.rejects(searchStoryVideos('https://site.example/content', 'nuh', CHANNEL, () => false, phone({ YOUTUBE_API_KEY: 'k' })), /network access/);
  await assert.rejects(searchStoryVideos('https://site.example/content', 'nuh', CHANNEL, () => true, phone({ YOUTUBE_API_KEY: 'k', YOUTUBE_ALLOWED_CHANNEL_IDS: 'UC' + 'b'.repeat(22) })), /approved channel list/);
  const handler = createContentHandler({ env: { YOUTUBE_API_KEY: 'k' } });
  assert.equal((await handler(new Request('https://site.example/content/api/videos?action=delete'))).status, 400);
});

test('only a parent approves videos, after watching; the player cannot navigate out of the app', async () => {
  const native = new DatabaseSync(':memory:'); native.exec(schema);
  const db: Database = { execAsync: async sql => { native.exec(sql); }, runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; }, getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null, getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[], withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } } };
  try {
    const [video] = await searchStoryVideos('https://site.example/content', 'creation', CHANNEL, () => true, phone({ YOUTUBE_API_KEY: 'k' }));
    const library = new StoryVideoLibrary(db);
    await assert.rejects(library.approve(video, 'creation', { watchedAndSuitable: true }, () => false), /PIN/);
    await assert.rejects(library.approve(video, 'creation', { watchedAndSuitable: false }, () => true), /Watch/);
    await library.approve(video, 'creation', { watchedAndSuitable: true }, () => true);
    assert.deepEqual((await library.list()).map(item => [item.id, item.topic]), [[KIDS, 'creation']]);
    await assert.rejects(library.remove(KIDS, () => false), /PIN/);
    await library.remove(KIDS, () => true); assert.deepEqual(await library.list(), []);
  } finally { native.close(); }
  assert.match(playerHtml(KIDS), /youtube-nocookie\.com\/embed\/Abc_123-xyz\?playsinline=1&rel=0/);
  assert.throws(() => playerHtml('"><script>'), /Invalid/);
  const base = 'https://issa-uzair.netlify.app/';
  assert.equal(allowPlayerNavigation({ url: base, isTopFrame: true }, base), true);
  assert.equal(allowPlayerNavigation({ url: 'https://www.youtube.com/watch?v=x', isTopFrame: true }, base), false, 'tapping the YouTube logo does not leave the app');
  assert.equal(allowPlayerNavigation({ url: 'https://www.youtube-nocookie.com/embed/x', isTopFrame: false }, base), true);
});
