import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import { schemaV2 } from '../src/database/migrations/002';
import type { Database, SqlValue } from '../src/services/database/types';
import { createContentHandler } from '../server/proxy.mjs';
import { SunnahProvider } from '../src/services/hadith/SunnahProvider';
import { ImportedLibrary, sourceQuiz, SUGGESTED_HADITH, HADITH_CATEGORIES } from '../src/services/hadith/ImportedLibrary';
import { hadithFixtures } from '../src/content/fixtures/hadith';

function database() {
  const native = new DatabaseSync(':memory:'); native.exec(schema); native.exec(schemaV2);
  const db: Database = { execAsync: async sql => { native.exec(sql); }, runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; }, getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null, getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[], withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } } };
  return { db, close: () => native.close() };
}
// Shape of the Sunnah.com v1 hadith response. Test strings are placeholders, not hadith text.
const sourceResponse = { collection: 'bukhari', hadithNumber: '5971', hadith: [
  { lang: 'en', body: '<p>[English source text placeholder]</p>', grades: [{ grade: 'Sahih', graded_by: 'Test grader' }] },
  { lang: 'ar', body: '<p>[Arabic source text placeholder]</p>' }] };
function phoneThroughProxy(env: Record<string, string>, calls: string[] = []): typeof fetch {
  const handler = createContentHandler({ env, fetcher: async (input, init) => { calls.push(`${String(input)} key=${(init?.headers as Record<string, string>)?.['X-API-Key']}`); return Response.json(sourceResponse); } });
  return (async (input: string | URL | Request) => handler(new Request(String(input)))) as typeof fetch;
}

test('records come unchanged from Sunnah.com through the content server; the API key stays on the server', async () => {
  const calls: string[] = [];
  const provider = new SunnahProvider('https://site.example/content', { networkAllowed: true, fetcher: phoneThroughProxy({ SUNNAH_API_KEY: 'server-only-key' }, calls) });
  const record = await provider.getHadith('bukhari', '5971');
  assert.deepEqual(calls, ['https://api.sunnah.com/v1/collections/bukhari/hadiths/5971 key=server-only-key']);
  assert.equal(record.canonicalText, sourceResponse.hadith[1].body); assert.equal(record.translation, sourceResponse.hadith[0].body);
  assert.deepEqual(record.grades, [{ grade: 'Sahih', gradedBy: 'Test grader' }]); assert.equal(record.textScope, 'complete-source-record');
  assert.equal(JSON.stringify(record).includes('server-only-key'), false);
});

test('without a server Sunnah.com key the lookup fails clearly and nothing is added', async () => {
  const provider = new SunnahProvider('https://site.example/content', { networkAllowed: true, fetcher: phoneThroughProxy({}) });
  await assert.rejects(provider.getHadith('bukhari', '5971'), /unavailable/);
  await assert.rejects(new SunnahProvider('https://site.example/content', { networkAllowed: false }).getHadith('bukhari', '1'), /network/);
});

test('only a parent can add or remove readings, after confirming they read the source text', async () => {
  const { db, close } = database();
  try {
    const record = await new SunnahProvider('https://site.example/content', { networkAllowed: true, fetcher: phoneThroughProxy({ SUNNAH_API_KEY: 'k' }) }).getHadith('bukhari', '5971');
    const library = new ImportedLibrary(db);
    await assert.rejects(library.add(record, 'hadith', 'Respect for mothers', { parentReadSource: true }, () => false), /PIN/);
    await assert.rejects(library.add(record, 'hadith', 'Respect for mothers', { parentReadSource: false }, () => true), /read the source/);
    await assert.rejects(library.add(record, 'hadith', 'Not a category', { parentReadSource: true }, () => true), /category/);
    await assert.rejects(library.add(hadithFixtures[0], 'hadith', 'Kindness', { parentReadSource: true }, () => true), /Only complete records/, 'bundled excerpts are not re-labelled as full source records');
    const added = await library.add(record, 'hadith', 'Respect for mothers', { parentReadSource: true }, () => true);
    assert.equal(added.id, 'hadith:bukhari:5971');
    const [stored] = await library.list('hadith');
    assert.equal(stored.record.canonicalText, record.canonicalText, 'stored unchanged for offline use');
    assert.deepEqual(await library.list('dua'), []);
    await assert.rejects(library.remove(added.id, () => false), /PIN/);
    await library.remove(added.id, () => true);
    assert.deepEqual(await library.list('hadith'), []);
  } finally { close(); }
});

test('the reading quiz is built from source metadata only', async () => {
  const { db, close } = database();
  try {
    const provider = new SunnahProvider('https://site.example/content', { networkAllowed: true, fetcher: phoneThroughProxy({ SUNNAH_API_KEY: 'k' }) });
    const library = new ImportedLibrary(db);
    const one = await library.add(await provider.getHadith('bukhari', '5971'), 'hadith', 'Respect for mothers', { parentReadSource: true }, () => true);
    const quiz = sourceQuiz(one, [one]);
    assert.equal(quiz.length, 1);
    const question = quiz[0]; assert.equal(question.type, 'multiple-choice');
    if (question.type === 'multiple-choice') assert.equal(question.options.find(option => option.id === question.correctOptionId)?.label, 'Sahih al-Bukhari');
    for (const item of SUGGESTED_HADITH) assert.ok((HADITH_CATEGORIES as readonly string[]).includes(item.category));
  } finally { close(); }
});
