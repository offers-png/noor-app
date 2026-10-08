import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import { AYAH_COUNTS, createContentHandler } from '../server/proxy.mjs';
import { transferQuranAudio, verifiedAudioPath, type AudioDownloadRuntime } from '../src/services/quran/QuranAudioDownloadEngine';
import { estimateAudioDownloads } from '../src/services/quran/QuranAudioDownloads';
import { commitTanzilText, prepareTanzilText } from '../src/services/quran/QuranLicensedText';
import { fetchPublisherAudio, publisherAudioIsFresh, publisherAudioPlan, publisherAudioStatus, readPublisherAudio, removePublisherAudio, savePublisherAudio, validatePublisherAudio } from '../src/services/quran/QuranPublisherAudio';
import { QuranRepository } from '../src/services/quran/QuranRepository';

function database() {
  const native = new DatabaseSync(':memory:'); native.exec(schema);
  const db: Database = { execAsync: async sql => { native.exec(sql); }, runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; }, getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null, getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[], withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } } };
  return { db, close: () => native.close() };
}
/** Same shape as api.alquran.cloud/v1/surah/:n/ar.alafasy (publisher text omitted). */
function publisherSurah(surah: number) {
  const offset = AYAH_COUNTS.slice(0, surah - 1).reduce((sum: number, count: number) => sum + count, 0);
  return { code: 200, status: 'OK', data: { number: surah, edition: { identifier: 'ar.alafasy', format: 'audio' }, ayahs: Array.from({ length: AYAH_COUNTS[surah - 1] }, (_, index) => ({ number: offset + index + 1, numberInSurah: index + 1, audio: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${offset + index + 1}.mp3` })) } };
}
const arabicBytes = readFileSync(new URL('./fixtures/tanzil/quran-uthmani-1.1.txt', import.meta.url));
/** The phone talks to the real shared proxy handler; only the two publishers are simulated. */
function proxyFetch(log: string[] = []): typeof fetch {
  const handler = createContentHandler({ env: {}, fetcher: async input => {
    const url = String(input); log.push(url);
    if (url.startsWith('https://api.alquran.cloud/v1/surah/')) return Response.json(publisherSurah(Number(url.split('/')[5])));
    if (url.startsWith('https://tanzil.net/')) return new Response(arabicBytes);
    return new Response('not found', { status: 404 });
  } });
  return (async (input: string | URL | Request) => handler(new Request(String(input)))) as typeof fetch;
}
function runtime() {
  const local = new Map<string, number>(); const requested: string[] = [];
  const api: AudioDownloadRuntime = { inspect: uri => ({ exists: local.has(uri), size: local.get(uri) ?? 0 }), availableBytes: () => 1024 * 1024 * 1024,
    create: (file, _signal, progress) => { requested.push(file.verseKey); const uri = `file:///quran-audio/${file.verseKey.replace(':', '-')}.mp3`; return { download: async () => { progress(file.bytes!); local.set(uri, file.bytes!); return { uri, size: file.bytes! }; }, remove: () => { local.delete(uri); }, release: () => undefined }; } };
  return { api, local, requested };
}
/** CDN that omits Content-Length on HEAD, forcing the one-byte range fallback. */
const cdn = (async (input: string | URL | Request, init?: RequestInit) => {
  const number = Number(/\/(\d+)\.mp3$/.exec(String(input))![1]);
  if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  return new Response('x', { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': `bytes 0-0/${10000 + number}` } });
}) as typeof fetch;

test('Al-Baqarah recitation: proxy list → stored metadata → size check → confirmed download → offline reader playback', async () => {
  const { db, close } = database(); const log: string[] = []; const fetcher = proxyFetch(log);
  try {
    // Surah 2 is not bundled: install the verified Tanzil Arabic through the same proxy first.
    const consent = { unchangedUseConfirmed: true };
    await commitTanzilText(db, await prepareTanzilText('arabic', { proxyUrl: 'https://site.example/content', networkAllowed: () => true, consent, fetcher }), consent, () => true);
    const repository = new QuranRepository(async () => db);
    assert.equal((await repository.verses(2)).every(ayah => !ayah.audio), true, 'No recitation is advertised before the list is fetched');

    const metadata = await fetchPublisherAudio('https://site.example/content/', 2, () => true, fetcher);
    assert.ok(log.includes('https://api.alquran.cloud/v1/surah/2/ar.alafasy'));
    assert.equal(metadata.ayahs.length, 286); assert.equal(metadata.ayahs[0].url, 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/8.mp3');
    await savePublisherAudio(db, metadata, () => true);
    assert.deepEqual(await readPublisherAudio(db, 2), metadata);
    assert.equal(publisherAudioIsFresh(metadata), true);

    const streaming = await repository.verses(2);
    assert.equal(streaming[0].audio?.url, 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/8.mp3');
    assert.equal(streaming[0].audio?.reciter, 'Mishary Rashid Alafasy'); assert.equal(streaming[0].audio?.localUri, undefined);

    const estimate = await estimateAudioDownloads(publisherAudioPlan(metadata), () => true, cdn);
    assert.equal(estimate.files.length, 286); assert.equal(estimate.files[0].bytes, 10008);
    assert.equal(estimate.totalBytes, estimate.files.reduce((sum, file) => sum + file.bytes!, 0));

    const native = runtime();
    await transferQuranAudio(db, estimate.files, () => true, native.api, () => undefined);
    assert.equal(native.requested.length, 286);
    assert.equal((await publisherAudioStatus(db)).get(2), 286);
    assert.equal(await verifiedAudioPath(db, estimate.files[285].id, native.api), 'file:///quran-audio/2-286.mp3');
    // Retrying a finished surah transfers nothing.
    await transferQuranAudio(db, estimate.files, () => true, native.api, () => undefined);
    assert.equal(native.requested.length, 286);

    const removed: string[] = [];
    assert.equal(await removePublisherAudio(db, 2, uri => removed.push(uri)), 286);
    assert.equal(removed.length, 286); assert.equal((await publisherAudioStatus(db)).get(2), undefined);
  } finally { close(); }
});

test('bundled surah recordings are never replaced by the downloadable list', async () => {
  const { db, close } = database();
  try {
    await savePublisherAudio(db, await fetchPublisherAudio('https://site.example/content', 112, () => true, proxyFetch()), () => true);
    const ayahs = await new QuranRepository(async () => db).verses(112);
    assert.equal(ayahs.length, 4);
    for (const ayah of ayahs) { assert.equal(ayah.audio?.downloadId, undefined); assert.match(ayah.audio!.url!, /cdn\.islamic\.network/); }
  } finally { close(); }
});

test('removing one surah leaves other surahs untouched', async () => {
  const { db, close } = database();
  try {
    for (const surah of [1, 11]) {
      const metadata = await fetchPublisherAudio('https://site.example/content', surah, () => true, proxyFetch());
      await transferQuranAudio(db, (await estimateAudioDownloads(publisherAudioPlan(metadata), () => true, cdn)).files, () => true, runtime().api, () => undefined);
    }
    assert.equal(await removePublisherAudio(db, 1, () => undefined), 7);
    assert.equal((await publisherAudioStatus(db)).get(11), 123);
  } finally { close(); }
});

test('audio list validation, consent and failure messages', async () => {
  const good = { surah: 113, source: { edition: 'ar.alafasy' }, ayahs: [6226, 6227, 6228, 6229, 6230].map((number, index) => ({ key: `113:${index + 1}`, number, url: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${number}.mp3` })) };
  assert.equal(validatePublisherAudio(good, 113).ayahs.length, 5);
  assert.throws(() => validatePublisherAudio({ ...good, ayahs: good.ayahs.slice(1) }, 113), /could not be verified/);
  assert.throws(() => validatePublisherAudio({ ...good, ayahs: good.ayahs.map((a, i) => i ? a : { ...a, url: 'https://evil.example/6226.mp3' }) }, 113), /could not be verified/);
  assert.throws(() => validatePublisherAudio({ ...good, ayahs: good.ayahs.map((a, i) => i ? a : { ...a, number: 1 }) }, 113), /could not be verified/);
  assert.throws(() => validatePublisherAudio({ ...good, source: { edition: 'ar.other' } }, 113), /could not be verified/);
  assert.equal(publisherAudioIsFresh({ ...validatePublisherAudio(good, 113), syncedAt: '2020-01-01T00:00:00Z' }), false);

  let calls = 0; const counting = (async () => { calls++; return Response.json({}); }) as typeof fetch;
  await assert.rejects(fetchPublisherAudio('https://x.example', 1, () => false, counting), /network access/); assert.equal(calls, 0);
  await assert.rejects(fetchPublisherAudio('https://x.example', 115, () => true, counting), /1 to 114/);
  await assert.rejects(fetchPublisherAudio('https://x.example', 1, () => true, (async () => Response.json({ message: 'Route not found.' }, { status: 404 })) as typeof fetch), /does not support recitation downloads/);
  await assert.rejects(fetchPublisherAudio('https://x.example', 1, () => true, (async () => { throw new TypeError('private socket detail'); }) as typeof fetch), (error: Error) => /could not be reached/.test(error.message) && !error.message.includes('private'));
  await assert.rejects(fetchPublisherAudio('https://x.example', 1, () => true, (async () => new Response('<html>', { status: 200 })) as typeof fetch), /unreadable/);

  const { db, close } = database();
  try {
    await db.runAsync('INSERT INTO quran_resources(resource,resource_id,version,payload_json) VALUES (?,?,?,?)', 'publisher-audio:ar.alafasy', '113', 'x', '{"surah":113,"ayahs":[]}');
    assert.equal(await readPublisherAudio(db, 113), null, 'Damaged stored lists are ignored, not played');
    await assert.rejects(savePublisherAudio(db, validatePublisherAudio(good, 113), () => false), /permission changed/);
  } finally { close(); }
});

test('size check uses Content-Length when present and rejects HTML error pages', async () => {
  const plan = publisherAudioPlan(validatePublisherAudio({ surah: 112, source: { edition: 'ar.alafasy' }, ayahs: [6222, 6223, 6224, 6225].map((number, index) => ({ key: `112:${index + 1}`, number, url: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${number}.mp3` })) }, 112));
  const methods: string[] = [];
  const head = (async (_input: unknown, init?: RequestInit) => { methods.push(init?.method ?? 'GET'); return new Response(null, { headers: { 'content-length': '5000', 'content-type': 'audio/mpeg' } }); }) as typeof fetch;
  assert.equal((await estimateAudioDownloads(plan, () => true, head)).totalBytes, 20000);
  assert.deepEqual(methods, ['HEAD', 'HEAD', 'HEAD', 'HEAD']);
  const html = (async (_input: unknown, init?: RequestInit) => init?.method === 'HEAD' ? new Response(null) : new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
  await assert.rejects(estimateAudioDownloads(plan, () => true, html), /reliable size/);
});
