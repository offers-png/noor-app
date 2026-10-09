import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import { FamilyRepository } from '../src/database/repositories/FamilyRepository';
import { allLessons } from '../src/content/lessons/catalog';
import { visibleLessons } from '../src/content/lessons/approval';
import { hadithFixtures } from '../src/content/fixtures/hadith';
import { duaFixtures } from '../src/content/lessons/duas';
import { sourcePracticeId, sourceReadingCatalog, sourceReadings } from '../src/content/lessons/sourceReadings';
import { loadStoredLessons, seedReviewLessons } from '../src/content/lessons/storage';
import { hasAvailableEditorialLessons, SourceReadingRepository } from '../src/features/lessons/sourceReadingRepository';
import { HadithRepository } from '../src/services/hadith/HadithRepository';
import { DevelopmentHadithProvider } from '../src/services/hadith/DevelopmentHadithProvider';

function localDb() {
  const sqlite = new DatabaseSync(':memory:');
  const db: Database = {
    execAsync: async sql => { sqlite.exec(sql); },
    runAsync: async (sql, ...params: SqlValue[]) => { const result = sqlite.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; },
    getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => (sqlite.prepare(sql).get(...params) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => sqlite.prepare(sql).all(...params) as T[],
    withTransactionAsync: async work => { sqlite.exec('BEGIN'); try { await work(db); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
  return { db, close: () => sqlite.close() };
}

test('normal mode has eight offline source readings while unapproved explanations and quizzes remain hidden', () => {
  assert.equal(sourceReadings('hadith').length, 3);
  assert.equal(sourceReadings('duas').length, 5);
  assert.equal(visibleLessons(allLessons, false).length, 0);
  assert.equal(visibleLessons(allLessons, true).length, 24);
  for (const record of sourceReadingCatalog) {
    assert.equal('sections' in record, false); assert.equal('quiz' in record, false);
    assert.equal('review' in record, false); assert.equal('discussion' in record, false);
    assert.equal(record.publication.kind, 'permitted-teaching-selection');
    assert.equal(record.publication.sourceCheckedAt, '2026-10-08');
    assert.equal(record.publication.permissionUrl, 'https://sunnah.com/about#reproduction');
    assert.ok(Object.isFrozen(record));
  }
  assert.ok(allLessons.every(lesson => lesson.review.status === 'needs_review' && lesson.review.developmentOnly && lesson.review.reviewer === null));
});

test('the editorial entry stays hidden normally and parent opt-in seeds and exposes a fresh review pack', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema);
    assert.equal(await hasAvailableEditorialLessons(db, 'hadith', false), false);
    assert.equal(await hasAvailableEditorialLessons(db, 'duas', false), false);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM lessons'))?.count, 0);
    assert.equal(await hasAvailableEditorialLessons(db, 'hadith', true), true);
    assert.equal(await hasAvailableEditorialLessons(db, 'duas', true), true);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM lessons'))?.count, 24);
    assert.equal(await hasAvailableEditorialLessons(db, 'hadith', false), false);
  } finally { close(); }
});

test('the published source catalog preserves the individually checked Arabic, English and primary references', () => {
  // Pin the checked selections, rather than accept arbitrary fixture text as published.
  const checked = [
    ['bukhari:1:excerpt', 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', 'The reward of deeds depends upon the intentions', 'https://sunnah.com/bukhari:1'],
    ['bukhari:6018:excerpt', 'فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', 'should talk what is good or keep quiet.', 'https://sunnah.com/bukhari:6018'],
    ['bukhari:13:excerpt', 'حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', 'till he wishes for his (Muslim) brother what he likes for himself.', 'https://sunnah.com/bukhari:13'],
    ['dua-before-eating', 'بِسْمِ اللَّهِ', 'With the Name of Allah.', 'https://sunnah.com/hisn:178'],
    ['dua-forgiveness', 'رَبِّ اغْفرْ لي', 'My Lord, forgive me.', 'https://sunnah.com/hisn:2'],
    ['dua-knowledge', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً نَافِعاً', 'O Allah, I ask You for knowledge that is of benefit,', 'https://sunnah.com/hisn:95'],
    ['dua-masjid-entry', 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ', 'O Allah, open to me the gates of thy mercy.', 'https://sunnah.com/abudawud:465'],
    ['dua-masjid-exit', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ', 'O Allah! I beg of Thee Thy Grace.', 'https://sunnah.com/muslim:713a'],
  ];
  assert.deepEqual(sourceReadingCatalog.map(record => [record.id, record.canonicalText, record.translation, record.source.sourceUrl]), checked);
  for (const record of sourceReadingCatalog) {
    const original = [...hadithFixtures, ...duaFixtures].find(item => item.id === record.id)!;
    assert.deepEqual(record.source, original.source);
    assert.ok(record.source.license.includes('teaching'));
  }
});

test('dua reading uses exact attributed published transliteration, without approving original Latin aids', () => {
  const readings = sourceReadings('duas');
  assert.deepEqual(readings.map(record => [record.transliteration?.text, record.transliteration?.source.sourceUrl]), [
    ['Bismillāh.', 'https://sunnah.com/hisn:178'],
    ['rabbighfir lī.', 'https://sunnah.com/hisn:2'],
    ["Allāhumma innī as'aluka `ilman nāfi`a,", 'https://sunnah.com/hisn:95'],
    ["Allāhummaftaḥ lī 'abwāba raḥmatik.", 'https://sunnah.com/hisn:20'],
    ["Allāhumma 'innī 'as'aluka min faḍlika,", 'https://sunnah.com/hisn:21'],
  ]);
  assert.notEqual(readings[2].transliteration?.text, duaFixtures[2].transliteration);
  assert.equal(readings[3].source.sourceUrl, 'https://sunnah.com/abudawud:465');
  assert.equal(readings[4].source.sourceUrl, 'https://sunnah.com/muslim:713a');
  assert.ok(duaFixtures.every(record => record.review.status === 'needs_review' && record.review.developmentOnly && record.review.approvedAt === null));
});

test('an upgraded local review pack and existing Hadith bookmarks work in the normal source catalog', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema);
    const child = await new FamilyRepository(db).addChild('Amina', '🌙');
    await seedReviewLessons(db);
    const before = await db.getAllAsync('SELECT id,status,payload_json,source_json FROM lessons ORDER BY id');
    await new HadithRepository(db, new DevelopmentHadithProvider()).save(child, 'bukhari:1:excerpt');
    const readings = new SourceReadingRepository(db);
    assert.deepEqual(await readings.savedIds(child, 'hadith'), ['bukhari:1:excerpt']);
    assert.equal(sourceReadings('hadith').length, 3); assert.equal(sourceReadings('duas').length, 5);
    assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 0);
    await readings.setSaved(child, 'dua-before-eating', true);
    assert.deepEqual(await readings.savedIds(child, 'duas'), ['dua-before-eating']);
    assert.deepEqual(await db.getAllAsync('SELECT id,status,payload_json,source_json FROM lessons ORDER BY id'), before);
  } finally { close(); }
});

test('reading saves and memory progress are isolated per child and separate from editorial completion', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema);
    const family = new FamilyRepository(db);
    const a = await family.addChild('Yusuf', '⭐'); const b = await family.addChild('Maryam', '🌙');
    const repo = new SourceReadingRepository(db);
    await repo.setSaved(a, 'dua-before-eating', true); await repo.setSaved(a, 'dua-before-eating', true);
    assert.deepEqual(await repo.savedIds(a, 'duas'), ['dua-before-eating']); assert.deepEqual(await repo.savedIds(b, 'duas'), []);
    await repo.setSaved(a, 'dua-before-eating', false); assert.deepEqual(await repo.savedIds(a, 'duas'), []);
    await repo.markMemorized(a, 'dua-before-eating');
    const memory = await db.getFirstAsync<{ level: string; rating: string }>('SELECT level,rating FROM memorization_progress WHERE child_id=? AND verse_key=?', a, 'dua-before-eating');
    assert.deepEqual({ ...memory }, { level: 'COMPLETE', rating: 'self-marked' });
    assert.equal(await db.getFirstAsync('SELECT verse_key FROM memorization_progress WHERE child_id=?', b), null);
    for (const reading of sourceReadingCatalog) {
      assert.ok(!allLessons.some(lesson => lesson.id === sourcePracticeId(reading)));
      await family.saveProgress(a, sourcePracticeId(reading));
    }
    assert.equal((await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM quiz_attempts'))?.total, 0);
    await assert.rejects(repo.setSaved(0, 'dua-before-eating', true), /Choose a child/);
    await assert.rejects(repo.setSaved(a, 'hadith-1', true), /published source catalog/);
    await assert.rejects(repo.markMemorized(a, 'bukhari:1:excerpt'), /Choose a dua/);
  } finally { close(); }
});

test('edited stored source or education payloads cannot alter the compiled source reading text', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); await seedReviewLessons(db);
    const before = JSON.stringify(sourceReadingCatalog);
    await db.runAsync('UPDATE hadiths SET canonical_text=?,payload_json=? WHERE id=?', 'Changed Arabic', '{}', 'bukhari:1:excerpt');
    const original = allLessons[0];
    const tampered = { ...original, source: { ...original.source, sourceReference: 'Changed reference' } };
    await db.runAsync('UPDATE lessons SET payload_json=? WHERE id=?', JSON.stringify(tampered), original.id);
    await assert.rejects(loadStoredLessons(db), /integrity checks/);
    assert.equal(JSON.stringify(sourceReadingCatalog), before);
    assert.equal(sourceReadings('hadith')[0].canonicalText, 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ');
  } finally { close(); }
});
