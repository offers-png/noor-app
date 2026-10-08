import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import type { Database, SqlValue } from '../src/services/database/types';
import { FamilyRepository } from '../src/database/repositories/FamilyRepository';
import { HadithRepository } from '../src/services/hadith/HadithRepository';
import { SunnahProvider } from '../src/services/hadith/SunnahProvider';
import { DevelopmentHadithProvider } from '../src/services/hadith/DevelopmentHadithProvider';
import { HadithProviderError } from '../src/services/hadith/HadithProvider';
import { hadithFixtures } from '../src/content/fixtures/hadith';
import { allLessons, lessonSourceRegistry } from '../src/content/lessons/catalog';
import { duaFixtures } from '../src/content/lessons/duas';
import { canShowReviewedContent, publishReviewedLesson, visibleLessons } from '../src/content/lessons/approval';
import { loadStoredLessons, seedReviewLessons } from '../src/content/lessons/storage';
import { LessonReviewRepository } from '../src/content/lessons/reviewRepository';

const fakeFetch = (payload: unknown, status = 200) => (async () => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
const sourceResponse = (arabic = '  إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ\n') => ({ collection: 'bukhari', hadithNumber: '1', hadith: [
  { lang: 'ar', body: arabic, grades: [] }, { lang: 'en', body: 'Source translation', grades: [{ grade: 'Source-supplied', graded_by: 'Source reviewer' }] },
] });
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

test('Sunnah provider preserves source Arabic, HTML, whitespace, translation and source grades exactly', async () => {
  const original = '<p>  إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ\n</p>';
  const provider = new SunnahProvider('https://content.example', { networkAllowed: true, fetcher: fakeFetch(sourceResponse(original)) });
  const value = await provider.getHadith('bukhari', '1');
  assert.equal(value.canonicalText, original); assert.equal(value.translation, 'Source translation');
  assert.equal(value.sourceFormat, 'source-html'); assert.deepEqual(value.grades, [{ grade: 'Source-supplied', gradedBy: 'Source reviewer' }]);
  assert.equal(value.narrator, null); assert.equal(value.developmentOnly, false);
});

test('optional Hadith network is disabled by default parent choice and no request is made', async () => {
  let requested = false;
  const provider = new SunnahProvider('https://content.example', { networkAllowed: false, fetcher: (async () => { requested = true; throw Error('Unexpected request'); }) as typeof fetch });
  await assert.rejects(provider.getHadith('bukhari', '1'), (e: unknown) => e instanceof HadithProviderError && e.code === 'network_disabled');
  assert.equal(requested, false);
});

test('Sunnah provider maps documented collections and never falls back to development fiction', async () => {
  const provider = new SunnahProvider('https://content.example', { networkAllowed: true, fetcher: fakeFetch({ data: [{ name: 'bukhari', totalAvailableHadith: 5, collection: [{ lang: 'en', title: 'Source title' }, { lang: 'ar', title: 'عنوان' }] }] }) });
  assert.deepEqual(await provider.getCollections(), [{ id: 'bukhari', title: 'Source title', arabicTitle: 'عنوان', available: 5 }]);
  const missing = new SunnahProvider('https://content.example', { networkAllowed: true, fetcher: fakeFetch({ error: 'Missing' }, 404) });
  await assert.rejects(missing.getHadith('bukhari', '1'), (e: unknown) => e instanceof HadithProviderError && e.code === 'not_found');
});

test('Sunnah errors reject wrong references, missing Arabic, insecure production URL, and network failure', async () => {
  for (const payload of [{ ...sourceResponse(), hadithNumber: '2' }, { ...sourceResponse(), hadith: [{ lang: 'en', body: 'Source' }] }]) {
    const provider = new SunnahProvider('https://content.example', { networkAllowed: true, fetcher: fakeFetch(payload) });
    await assert.rejects(provider.getHadith('bukhari', '1'), (e: unknown) => e instanceof HadithProviderError && e.code === 'invalid_response');
  }
  const insecure = new SunnahProvider('http://content.example', { networkAllowed: true, fetcher: fakeFetch(sourceResponse()) });
  await assert.rejects(insecure.getHadith('bukhari', '1'), /HTTPS/);
  const failing = new SunnahProvider('https://content.example', { networkAllowed: true, fetcher: (async () => { throw new Error('Offline'); }) as typeof fetch });
  await assert.rejects(failing.getHadith('bukhari', '1'), (e: unknown) => e instanceof HadithProviderError && e.code === 'network');
});

test('review approval requires publication, reviewer, exact version and production pack', () => {
  assert.equal(visibleLessons(allLessons, false).length, 0);
  assert.equal(visibleLessons(allLessons, true).length, 13);
  const review = { ...allLessons[0].review, developmentOnly: false, status: 'published' as const, reviewer: 'Qualified reviewer', approvedAt: '2026-10-07', approvedVersion: '1' };
  assert.equal(canShowReviewedContent(review, false), true);
  assert.equal(canShowReviewedContent({ ...review, version: '2' }, false), false);
  assert.equal(canShowReviewedContent({ ...review, reviewer: null }, false), false);
  assert.equal(canShowReviewedContent({ ...review, status: 'approved' }, false), false);
  assert.equal(canShowReviewedContent({ ...review, developmentOnly: true }, false), false);
  assert.throws(() => publishReviewedLesson(allLessons[0]), /qualified approval/);
  assert.equal(publishReviewedLesson({ ...allLessons[0], review: { ...review, status: 'approved' } }).review.status, 'published');
});

test('religious fixtures carry provenance, excerpt scope, separate original commentary and review status', () => {
  assert.equal(hadithFixtures.length, 3); assert.equal(duaFixtures.length, 5);
  for (const record of [...hadithFixtures, ...duaFixtures]) {
    assert.ok(record.canonicalText.length); assert.ok(record.source.sourceReference); assert.ok(record.source.sourceUrl.startsWith('https://sunnah.com/'));
    assert.ok(record.source.license.includes('permitted')); assert.equal(record.source.verifiedAt, '2026-10-07');
  }
  assert.ok(allLessons.reduce((sum, lesson) => sum + lesson.quiz.length, 0) >= 13);
  assert.ok(allLessons.every(lesson => !lesson.review.reviewer && lesson.review.status === 'needs_review'));
  assert.ok(lessonSourceRegistry.some(source => source.sourceReference.includes('11:42')));
  assert.ok(allLessons.find(lesson => lesson.id === 'islam-story-nuh')?.sections.some(section => section.kind === 'source_fact'));
  assert.ok(allLessons.find(lesson => lesson.id === 'islam-story-nuh')?.sections.some(section => section.kind === 'explanation'));
});

test('offline Hadith cache does not mutate Arabic and saves are isolated per child across repository instances', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); const family = new FamilyRepository(db);
    const a = await family.addChild('Yusuf', '⭐'); const b = await family.addChild('Maryam', '🌙');
    const repo = new HadithRepository(db, new DevelopmentHadithProvider());
    const record = await repo.get('bukhari', '1');
    await repo.save(a, record.id); await repo.save(a, record.id);
    assert.deepEqual(await repo.savedIds(a), [record.id]); assert.deepEqual(await repo.savedIds(b), []);
    const reopened = new HadithRepository(db, new DevelopmentHadithProvider());
    assert.equal((await reopened.get('bukhari', '1')).canonicalText, hadithFixtures[0].canonicalText);
    assert.equal((await db.getFirstAsync<{ canonical_text: string }>('SELECT canonical_text FROM hadiths WHERE id = ?', record.id))?.canonical_text, record.canonicalText);
    await repo.unsave(a, record.id); assert.deepEqual(await reopened.savedIds(a), []);
    await assert.rejects(repo.save(0, record.id), /Choose a child/);
  } finally { close(); }
});

test('live Hadith and excerpt caches are different; existing source text is never silently replaced', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema);
    await new HadithRepository(db, new DevelopmentHadithProvider()).get('bukhari', '1');
    const canonical = '  إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ\n';
    const live = new HadithRepository(db, new SunnahProvider('https://content.example', { networkAllowed: true, fetcher: fakeFetch(sourceResponse(canonical)) }));
    assert.equal((await live.get('bukhari', '1')).canonicalText, canonical);
    const offline = new HadithRepository(db, new SunnahProvider('https://content.example', { networkAllowed: false }));
    assert.equal((await offline.get('bukhari', '1')).canonicalText, canonical);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM hadiths'))?.count, 2);
  } finally { close(); }
});

test('offline review lesson seeding is idempotent and keeps sourced Arabic separate from commentary', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); await seedReviewLessons(db); await seedReviewLessons(db);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM lessons'))?.count, 13);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM duas'))?.count, 5);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM hadith_lessons'))?.count, 3);
    const source = await db.getFirstAsync<{ canonical_text: string }>('SELECT canonical_text FROM hadiths WHERE id = ?', hadithFixtures[0].id);
    assert.equal(source?.canonical_text, hadithFixtures[0].canonicalText);
    const lesson = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM hadith_lessons WHERE id = ?', 'hadith-1');
    assert.equal(JSON.parse(lesson!.payload_json).sections[0].kind, 'explanation');
    assert.equal(JSON.parse(lesson!.payload_json).canonicalText, undefined);
  } finally { close(); }
});

test('parent teaching edits persist while source Arabic, translations, references, and development restrictions stay unchanged', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); const review = new LessonReviewRepository(db, () => true);
    const original = (await review.list()).find(lesson => lesson.id === 'hadith-1')!;
    const before = await db.getFirstAsync<{ canonical_text: string; payload_json: string; source_json: string }>('SELECT canonical_text,payload_json,source_json FROM hadiths WHERE id=?', original.hadithId!);
    await review.approve(original.id, '1', 'Parent-entered reviewer', true);
    const edited = await review.edit(original.id, '1', { sections: original.sections.map((section, index) => ({ title: section.title, body: index === 0 ? 'A revised original learning explanation.' : section.body })), discussion: 'A revised original discussion question?' });
    assert.equal(edited.review.version, '2'); assert.equal(edited.review.status, 'draft');
    assert.equal(edited.review.reviewer, null); assert.equal(edited.review.approvedAt, null); assert.equal(edited.review.approvedVersion, null); assert.equal(edited.review.attestation, undefined);
    assert.equal(edited.review.developmentOnly, true); assert.deepEqual(edited.source, original.source); assert.deepEqual(edited.quiz, original.quiz);
    const after = await db.getFirstAsync('SELECT canonical_text,payload_json,source_json FROM hadiths WHERE id=?', original.hadithId!);
    assert.deepEqual(after, before);
    const loaded = (await loadStoredLessons(db)).find(lesson => lesson.id === original.id)!;
    assert.equal(loaded.sections[0].body, 'A revised original learning explanation.'); assert.equal(loaded.discussion, 'A revised original discussion question?');
    assert.equal(canShowReviewedContent(loaded.review, false), false); assert.equal(canShowReviewedContent(loaded.review, true), true);
    await assert.rejects(review.edit(original.id, '1', { sections: [], discussion: 'stale' }), /changed/);
  } finally { close(); }
});

test('review status is persisted, approval is parent-attested, and development review packs cannot be published', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); const review = new LessonReviewRepository(db, () => true); await review.list();
    await assert.rejects(review.approve('hadith-1', '1', '', true), /name/);
    await assert.rejects(review.approve('hadith-1', '1', 'Reviewer', false), /confirm/);
    const approved = await review.approve('hadith-1', '1', 'Entered reviewer', true);
    assert.equal(approved.review.status, 'approved'); assert.equal(approved.review.attestation?.kind, 'parent-entered');
    await assert.rejects(review.publish('hadith-1', '1'), /production content pack/);
    const requested = await review.requestReview('hadith-1', '1');
    assert.equal(requested.review.status, 'needs_review'); assert.equal(requested.review.reviewer, null);
    assert.equal((await db.getFirstAsync<{ status: string }>('SELECT status FROM hadith_lessons WHERE id=?', 'hadith-1'))?.status, 'needs_review');
  } finally { close(); }
});

test('published production lesson requires exact reviewed version; subsequent editing removes child visibility', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); await seedReviewLessons(db);
    const production = { ...allLessons.find(lesson => lesson.id === 'islam-five-pillars')!, id: 'licensed-production-pillar-introduction', review: { status: 'needs_review' as const, version: '1', reviewer: null, approvedAt: null, approvedVersion: null, developmentOnly: false } };
    await db.runAsync('INSERT INTO lessons(id,category,status,payload_json,source_json) VALUES(?,?,?,?,?)', production.id, production.category, production.review.status, JSON.stringify(production), JSON.stringify(production.source));
    const review = new LessonReviewRepository(db, () => true);
    await assert.rejects(review.publish(production.id, '1'), /approval/);
    await review.approve(production.id, '1', 'Entered qualified reviewer', true);
    const published = await review.publish(production.id, '1'); assert.equal(published.review.status, 'published');
    assert.ok(visibleLessons(await loadStoredLessons(db), false).some(lesson => lesson.id === production.id));
    const edited = await review.edit(production.id, '1', { sections: production.sections.map(section => ({ title: section.title, body: section.body })), discussion: 'A new discussion?' });
    assert.equal(edited.review.version, '2'); assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 0);
  } finally { close(); }
});

test('review mutations require a current parent unlock and reject tampered source metadata', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); let authorized = true;
    const review = new LessonReviewRepository(db, () => authorized); await review.list(); authorized = false;
    await assert.rejects(review.requestReview('hadith-1', '1'), /Unlock Parent Mode/);
    const original = (await loadStoredLessons(db)).find(lesson => lesson.id === 'hadith-1')!;
    const tampered = { ...original, source: { ...original.source, sourceReference: 'Changed source reference' } };
    await db.runAsync('UPDATE lessons SET payload_json=? WHERE id=?', JSON.stringify(tampered), original.id);
    await assert.rejects(loadStoredLessons(db), /integrity checks/);
  } finally { close(); }
});

test('malformed imported review records cannot bypass production approval gates', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema);
    const malformed = { ...allLessons[0], id: 'unversioned-production-record', review: { status: 'published', reviewer: 'Entered name', approvedAt: '2026-10-07', developmentOnly: false } };
    await db.runAsync('INSERT INTO lessons(id,category,status,payload_json,source_json) VALUES(?,?,?,?,?)', malformed.id, malformed.category, 'published', JSON.stringify(malformed), JSON.stringify(malformed.source));
    await assert.rejects(loadStoredLessons(db), /integrity checks/);
  } finally { close(); }
});
