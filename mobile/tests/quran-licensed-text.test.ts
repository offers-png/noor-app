import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import { commitTanzilText, installedTanzilText, parseTanzilRows, prepareTanzilText, readTanzilText, removeTanzilText, stageTanzilText, TANZIL_EDITIONS, TANZIL_MAX_BYTES } from '../src/services/quran/QuranLicensedText';
import { QuranRepository } from '../src/services/quran/QuranRepository';
import { SEEDED_AYAHS } from '../src/services/quran/FixtureQuranProvider';
import { isEnglishTafsir, tafsirCoverage } from '../src/services/quran/QuranTafsir';
import { sourceTextParagraphs } from '../src/services/quran/presentation';
import type { ResourceSnapshot } from '../src/types/quran';

const arabicBytes = readFileSync(new URL('./fixtures/tanzil/quran-uthmani-1.1.txt', import.meta.url));
const transliterationBytes = readFileSync(new URL('./fixtures/tanzil/en.transliteration.txt', import.meta.url));
const consent = { unchangedUseConfirmed: true, noncommercialUseConfirmed: true };
function database() {
  const native = new DatabaseSync(':memory:');
  const db: Database = {
    execAsync: async sql => { native.exec(sql); },
    runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; },
    getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null,
    getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[],
    withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } },
  };
  return { db, close: () => native.close() };
}

test('both verified publisher files contain the complete unchanged editions and original notices', () => {
  for (const [kind, bytes] of [['arabic', arabicBytes], ['transliteration', transliterationBytes]] as const) {
    const staged = stageTanzilText(kind, bytes);
    assert.equal(staged.sha256, TANZIL_EDITIONS[kind].sha256);
    assert.equal(staged.bytes, TANZIL_EDITIONS[kind].bytes);
    assert.equal(staged.verses.length, 6236);
    assert.equal(staged.verses[0].key, '1:1');
    assert.equal(staged.verses.at(-1)?.key, '114:6');
    assert.deepEqual(utf8ToBytes(staged.originalText), new Uint8Array(bytes));
    const originalRows = staged.originalText.split(/\r?\n/).filter(line => /^\d+\|/.test(line));
    for (const [index, verse] of staged.verses.entries()) assert.equal(originalRows[index], `${verse.surahNumber}|${verse.ayahNumber}|${verse.text}`);
    assert.match(staged.notice, /Tanzil/);
  }
  assert.match(stageTanzilText('transliteration', transliterationBytes).verses.at(-1)!.text, /<b>m<\/b>$/);
  assert.match(stageTanzilText('arabic', arabicBytes).notice, /CHANGING IT IS NOT ALLOWED/);
});

test('parser rejects partial, duplicate, reordered and invalid reference files; changed source strings fail byte identity', () => {
  const original = transliterationBytes.toString('utf8');
  assert.throws(() => parseTanzilRows(original.replace(/^1\|1\|.*\n/, '')), /complete/);
  assert.throws(() => parseTanzilRows(original.replace('1|2|', '1|1|')), /duplicate/);
  assert.throws(() => parseTanzilRows(original.replace('114|6|', '114|7|')), /invalid/);
  const rows = original.split('\n'); [rows[0], rows[1]] = [rows[1], rows[0]];
  assert.throws(() => parseTanzilRows(rows.join('\n')), /reordered/);
  assert.throws(() => stageTanzilText('transliteration', utf8ToBytes(original.replace('Bismi', 'bismi'))), /changed|damaged/);
  assert.throws(() => stageTanzilText('transliteration', new Uint8Array([0xc3, 0x28])), /UTF-8/);
});

test('parent network and publisher permissions are checked before any download', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return new Response(transliterationBytes); };
  const options = { proxyUrl: 'https://content.example/content', networkAllowed: () => true, consent, fetcher };
  await assert.rejects(prepareTanzilText('transliteration', { ...options, networkAllowed: () => false }), /network/);
  await assert.rejects(prepareTanzilText('transliteration', { ...options, consent: { unchangedUseConfirmed: true } }), /noncommercial/);
  await assert.rejects(prepareTanzilText('arabic', { ...options, consent: { unchangedUseConfirmed: false } }), /publisher attribution/);
  assert.equal(requests, 0);
});

test('same-origin proxy download stages exact bytes and refuses oversized or revoked responses', async () => {
  let requested = '';
  const staged = await prepareTanzilText('transliteration', { proxyUrl: 'https://content.example/content/', networkAllowed: () => true, consent, fetcher: async input => { requested = String(input); return new Response(transliterationBytes); } });
  assert.equal(requested, 'https://content.example/content/api/resources/tanzil-transliteration');
  assert.equal(staged.sha256, TANZIL_EDITIONS.transliteration.sha256);
  await assert.rejects(prepareTanzilText('arabic', { proxyUrl: 'https://content.example', networkAllowed: () => true, consent, fetcher: async () => new Response('bad', { headers: { 'content-length': String(TANZIL_MAX_BYTES + 1) } }) }), /size/);
  let allowed = true;
  await assert.rejects(prepareTanzilText('arabic', { proxyUrl: 'https://content.example', networkAllowed: () => allowed, consent, fetcher: async () => { allowed = false; return new Response(arabicBytes); } }), /network/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(prepareTanzilText('arabic', { proxyUrl: 'https://content.example', networkAllowed: () => true, consent, signal: cancelled.signal, fetcher: async () => new Response(arabicBytes) }), /cancelled/);
});

test('atomic install re-verifies source text and permission revocation rolls back without replacing previous content', async () => {
  const { db, close } = database();
  try {
    await db.execAsync(schema);
    const staged = stageTanzilText('transliteration', transliterationBytes);
    await commitTanzilText(db, staged, consent, () => true);
    const before = await installedTanzilText(db, 'transliteration');
    const forged = { ...staged, verses: [{ key: '1:1', surahNumber: 1, ayahNumber: 1, text: 'tampered' }], source: { ...staged.source, license: 'forged commercial permission' } };
    await commitTanzilText(db, forged, consent, () => true);
    assert.equal((await readTanzilText(db, 'transliteration'))?.staged.verses.length, 6236);
    assert.match((await installedTanzilText(db, 'transliteration'))!.source.license, /noncommercial/);
    const previous = (await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM quran_resources WHERE resource=?', 'licensed:tanzil:transliteration'))!.payload_json;
    let allowed = true;
    const originalRun = db.runAsync;
    db.runAsync = async (...args) => { const result = await originalRun(...args); allowed = false; return result; };
    await assert.rejects(commitTanzilText(db, staged, consent, () => allowed), /network/);
    db.runAsync = originalRun;
    assert.equal((await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM quran_resources WHERE resource=?', 'licensed:tanzil:transliteration'))!.payload_json, previous);
    assert.equal(before?.verseCount, 6236);
    await assert.rejects(commitTanzilText(db, { ...staged, originalText: staged.originalText.replace('Bismi', 'bismi') }, consent, () => true), /changed|damaged/);
  } finally { close(); }
});

test('both installed editions unlock all 114 offline surahs while original 29 Arabic/audio and old database layers survive', async () => {
  const { db, close } = database();
  try {
    await db.execAsync(schema);
    const repo = new QuranRepository(async () => db);
    assert.equal((await repo.chapters()).filter(chapter => chapter.availableOffline).length, 5);
    await commitTanzilText(db, stageTanzilText('arabic', arabicBytes), { unchangedUseConfirmed: true }, () => true);
    await commitTanzilText(db, stageTanzilText('transliteration', transliterationBytes), consent, () => true);
    const offline = new QuranRepository(async () => db);
    assert.equal((await offline.chapters()).filter(chapter => chapter.availableOffline).length, 114);
    const wholeChapter = await offline.verses(2);
    assert.equal(wholeChapter.length, 286);
    assert.equal(wholeChapter[285].key, '2:286');
    assert.equal(wholeChapter[0].canonicalText, stageTanzilText('arabic', arabicBytes).verses[7].text);
    assert.equal(wholeChapter[285].transliteration?.source.version, 'September 6, 2010');
    assert.equal(wholeChapter[0].tafsir, undefined);
    for (const chapter of [1, 107, 112, 113, 114]) for (const ayah of await offline.verses(chapter)) {
      const original = SEEDED_AYAHS.find(item => item.key === ayah.key)!;
      assert.equal(ayah.canonicalText, original.canonicalText);
      assert.equal(ayah.audio?.url, original.audio?.url);
      assert.equal(ayah.translation?.text, original.translation?.text);
    }
    await removeTanzilText(db, 'arabic');
    assert.equal((await offline.chapters()).filter(chapter => chapter.availableOffline).length, 5);
    assert.equal((await offline.verses(2)).length, 0);
    assert.equal((await installedTanzilText(db, 'transliteration'))?.verseCount, 6236);
    await db.runAsync('UPDATE quran_resources SET payload_json=? WHERE resource=?', JSON.stringify({ originalText: 'damaged', installedAt: '2026-10-08', consent }), 'licensed:tanzil:transliteration');
    assert.equal(await installedTanzilText(db, 'transliteration'), null);
  } finally { close(); }
});

test('tafsir requires explicitly English publisher metadata and coverage counts actual valid nonempty passages', () => {
  const resource: ResourceSnapshot = { resource_group: 'tafsirs', resource_id: 999, resource_content_id: null, schema_version: 1, sync_sequence: 2, attribution: { name: 'Publisher test resource', reference: 'test', url: 'https://publisher.example', license: 'test', version: 'test', verifiedAt: 'test', language: 'English' }, records: [{ text: 'test passage', start_verse_id: 1, end_verse_id: 7 }, { text: 'overlapping test passage', verse_key: '1:2' }, { text: 'test passage', group_verse_key_from: '2:1', group_verse_key_to: '2:2' }, { text: '', start_verse_id: 1, end_verse_id: 6236 }, { text: 'invalid', start_verse_id: 0, end_verse_id: 6236 }] };
  assert.equal(isEnglishTafsir(resource), true);
  assert.equal(isEnglishTafsir({ ...resource, attribution: { ...resource.attribution!, language: 'Arabic' } }), false);
  assert.equal(isEnglishTafsir({ ...resource, attribution: undefined }), false);
  assert.equal(isEnglishTafsir({ ...resource, resource_group: 'translations' }), false);
  assert.deepEqual(tafsirCoverage(resource), { verseCount: 9, totalVerseCount: 6236, passageCount: 3, complete: false });
});

test('safe native tafsir formatting preserves wording, entities and paragraph breaks without executing publisher markup', () => {
  const paragraphs = sourceTextParagraphs('<h2>Publisher heading</h2><p>First <strong>exact &amp; quoted</strong> sentence.<br>Next &#65;&#x42;.</p><p><span class="arabic">Second</span> <a href="javascript:danger()">publisher link text</a>.</p>');
  assert.equal(paragraphs.length, 3);
  assert.equal(paragraphs[0].heading, true);
  assert.deepEqual(paragraphs.map(paragraph => paragraph.runs.map(run => run.text).join('')), ['Publisher heading', 'First exact & quoted sentence.\nNext AB.', 'Second publisher link text.']);
  assert.equal(paragraphs[1].runs.find(run => run.text === 'exact & quoted')?.bold, true);
  assert.ok(!JSON.stringify(paragraphs).includes('javascript:'));
});
