import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import meaningFixture from '../src/content/fixtures/quran-meaning.json';
import { bundledPublishedMeaning, PUBLISHED_MEANING_SOURCE } from '../src/content/fixtures/QuranMeaning';
import { bundledTransliteration } from '../src/content/fixtures/QuranTransliteration';
import { QURAN_SOURCE_REGISTRY } from '../src/content/fixtures/QuranSources';
import { SEEDED_AYAHS } from '../src/services/quran/FixtureQuranProvider';
import { QuranRepository, SQLiteQuranSyncStore } from '../src/services/quran/QuranRepository';
import { sourceTextRuns } from '../src/services/quran/presentation';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import type { ResourceSnapshot } from '../src/types/quran';

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

test('all 29 published meanings and supplied notes match official response bytes and current edition metadata', () => {
  const fixtureDirectory = new URL('../src/content/fixtures/quran-meaning-source/', import.meta.url);
  const keys = new Set<string>();
  let notes = 0;
  for (const file of meaningFixture.sourceFiles) {
    const bytes = readFileSync(new URL(file.file, fixtureDirectory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    const payload = JSON.parse(bytes.toString('utf8')) as { result: { sura: string; aya: string; translation: string; footnotes: string | null }[] };
    for (const row of payload.result) {
      const key = `${row.sura}:${row.aya}`;
      assert.equal(keys.has(key), false, 'Source ayah keys must be unique');
      keys.add(key);
      const fixture = meaningFixture.verses.find(verse => verse.key === key)!;
      const published = bundledPublishedMeaning(key)!;
      assert.equal(fixture.surahNumber, Number(row.sura));
      assert.equal(fixture.ayahNumber, Number(row.aya));
      assert.equal(fixture.text, row.translation);
      assert.equal(fixture.notes, row.footnotes);
      assert.equal(published.meaning.text, row.translation);
      assert.equal(published.notes?.text, row.footnotes || undefined);
      assert.equal(published.meaning.source.version, meaningFixture.publisherMetadata.version);
      assert.match(published.meaning.source.reference, new RegExp(`ayah ${key}$`));
      if (row.footnotes) notes++;
    }
  }
  assert.deepEqual([...keys].sort(), SEEDED_AYAHS.map(verse => verse.key).sort());
  assert.equal(keys.size, 29);
  assert.equal(notes, 12);
  const catalog = readFileSync(new URL('catalog-en.json', fixtureDirectory));
  assert.equal(createHash('sha256').update(catalog).digest('hex'), meaningFixture.catalogSha256);
  const edition = JSON.parse(catalog.toString('utf8')).translations.find((entry: { key: string }) => entry.key === 'english_rwwad');
  assert.deepEqual(meaningFixture.publisherMetadata, edition);
  assert.equal(PUBLISHED_MEANING_SOURCE.version, '1.0.19');
  assert.equal(PUBLISHED_MEANING_SOURCE.translator, 'Rowwad Translation Center');
  const terms = readFileSync(new URL('publisher-terms.html', fixtureDirectory));
  assert.equal(createHash('sha256').update(terms).digest('hex'), meaningFixture.termsSha256);
  assert.match(terms.toString('utf8'), /Contents of the translations can be downloaded and re-published/);
  assert.match(terms.toString('utf8'), /Mentioning the version number/);
  assert.equal(bundledPublishedMeaning('2:1'), undefined);
  assert.ok(QURAN_SOURCE_REGISTRY.some(source => source.sourceName === PUBLISHED_MEANING_SOURCE.name && source.sourceReference.includes('1.0.19')));
});

test('an existing APK database gets current bundled source layers without changing stored canonical text', async () => {
  const { db, close } = database();
  try {
    await db.execAsync(schema);
    for (const ayah of SEEDED_AYAHS) {
      const old = { ...ayah };
      delete old.transliteration;
      delete old.publishedMeaning;
      delete old.publisherNotes;
      await db.runAsync('INSERT INTO ayahs(verse_key,surah_number,ayah_number,canonical_text,source_json,payload_json) VALUES (?,?,?,?,?,?)', old.key, old.surahNumber, old.ayahNumber, old.canonicalText, JSON.stringify(old.source), JSON.stringify(old));
    }
    const repository = new QuranRepository(async () => db);
    for (const surahNumber of [1, 107, 112, 113, 114]) {
      const ayahs = await repository.verses(surahNumber);
      for (const ayah of ayahs) {
        assert.equal(ayah.canonicalText, SEEDED_AYAHS.find(source => source.key === ayah.key)!.canonicalText);
        assert.deepEqual(ayah.transliteration, bundledTransliteration(ayah.key));
        assert.deepEqual(ayah.publishedMeaning, bundledPublishedMeaning(ayah.key)?.meaning);
        assert.deepEqual(ayah.publisherNotes, bundledPublishedMeaning(ayah.key)?.notes);
        const original = await db.getFirstAsync<{ canonical_text: string; payload_json: string }>('SELECT canonical_text,payload_json FROM ayahs WHERE verse_key=?', ayah.key);
        assert.equal(original?.canonical_text, ayah.canonicalText);
        assert.equal(JSON.parse(original!.payload_json).publishedMeaning, undefined);
      }
    }
  } finally { close(); }
});

test('a synced canonical resource keeps independent bundled meaning and whole-ayah transliteration', async () => {
  const { db, close } = database();
  try {
    await db.execAsync(schema);
    const source = SEEDED_AYAHS.filter(verse => verse.surahNumber === 112);
    const core: ResourceSnapshot = { resource_group: 'quran_core', resource_id: 1, resource_content_id: null, schema_version: 1, sync_sequence: 1, records: source.map(ayah => ({ record_type: 'verse', id: ayah.ayahNumber, chapter_id: 112, verse_number: ayah.ayahNumber, verse_key: ayah.key, text_uthmani: ayah.canonicalText })) };
    await new SQLiteQuranSyncStore(db).commit('production', new Map([['quran_core:1', core]]), { environment: 'production', filter: 'quran_core:1', syncToken: 'test-checkpoint', lastSync: '2026-10-08', status: 'complete' });
    const result = await new QuranRepository(async () => db).verses(112);
    assert.equal(result.length, 4);
    for (const ayah of result) {
      assert.equal(ayah.canonicalText, source.find(verse => verse.key === ayah.key)!.canonicalText);
      assert.deepEqual(ayah.transliteration, bundledTransliteration(ayah.key));
      assert.deepEqual(ayah.publishedMeaning, bundledPublishedMeaning(ayah.key)?.meaning);
      assert.equal(ayah.tafsir, undefined, 'A published translation and notes must not be labeled tafsir');
    }
  } finally { close(); }
});

test('transliteration presentation handles original mixed-case formatting tags without rewriting source or executing markup', () => {
  for (const ayah of SEEDED_AYAHS) {
    const text = ayah.transliteration!.text;
    assert.equal(sourceTextRuns(text).map(run => run.text).join(''), text.replace(/<\/?(?:b|u)>/gi, ''));
    assert.equal(ayah.transliteration?.text, bundledTransliteration(ayah.key)?.text);
  }
  assert.deepEqual(sourceTextRuns('a<u>b</U><b>c</B>d'), [
    { text: 'a', bold: false, underline: false }, { text: 'b', bold: false, underline: true }, { text: 'c', bold: true, underline: false }, { text: 'd', bold: false, underline: false },
  ]);
  const unknown = '<script>untrusted()</script><a href="https://example.invalid">text</a>';
  assert.deepEqual(sourceTextRuns(unknown), [{ text: unknown, bold: false, underline: false }]);
});
