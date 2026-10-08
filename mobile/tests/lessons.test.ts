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
import { canParentPublishLesson, canShowReviewedContent, publishReviewedLesson, validAgeRange, visibleLessons } from '../src/content/lessons/approval';
import { quizReviewLines } from '../src/content/lessons/quizReview';
import { agePracticeGuidance } from '../src/content/lessons/ageGuidance';
import { reviewContentHash } from '../src/content/lessons/reviewContent';
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

test('review approval requires an exact reviewer attestation and separate explicit family publication', () => {
  assert.equal(visibleLessons(allLessons, false).length, 0);
  assert.equal(visibleLessons(allLessons, true).length, 22);
  const review = { ...allLessons[0].review, status: 'published' as const, reviewer: 'Reviewer named by parent', approvedAt: '2026-10-07', approvedVersion: '1', reviewedContentHash: reviewContentHash(allLessons[0]),
    attestation: { kind: 'parent-entered' as const, qualificationConfirmed: true as const, recordedAt: '2026-10-07' },
    publication: { kind: 'parent-local' as const, version: '1', publishedAt: '2026-10-08', parentSuitabilityConfirmed: true as const, sourcePermissionConfirmed: true as const } };
  assert.equal(canShowReviewedContent(review, false), true);
  assert.equal(canShowReviewedContent({ ...review, version: '2' }, false), false);
  assert.equal(canShowReviewedContent({ ...review, reviewer: null }, false), false);
  assert.equal(canShowReviewedContent({ ...review, status: 'approved' }, false), false);
  assert.equal(canShowReviewedContent({ ...review, publication: undefined }, false), false);
  assert.equal(canShowReviewedContent({ ...review, attestation: undefined }, false), false);
  assert.equal(canShowReviewedContent({ ...review, publication: { ...review.publication, version: '2' } }, false), false);
  assert.throws(() => publishReviewedLesson(allLessons[0]), /qualified-reviewer attestation/);
  assert.throws(() => publishReviewedLesson({ ...allLessons[0], review: { ...review, status: 'approved' } }), /Confirm parent/);
  assert.equal(publishReviewedLesson({ ...allLessons[0], review: { ...review, status: 'approved' } }, { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }).review.status, 'published');
});

test('religious fixtures carry provenance, excerpt scope, separate original commentary and review status', () => {
  assert.equal(hadithFixtures.length, 3); assert.equal(duaFixtures.length, 9);
  for (const record of [...hadithFixtures, ...duaFixtures.filter(dua => !dua.verseKey)]) {
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
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM lessons'))?.count, 22);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM duas'))?.count, 9);
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

test('bundled draft review is persisted and requires separate parent permission and suitability before publication', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); const review = new LessonReviewRepository(db, () => true); await review.list();
    await assert.rejects(review.approve('hadith-1', '1', '', true), /name/);
    await assert.rejects(review.approve('hadith-1', '1', 'Reviewer', false), /confirm/);
    const approved = await review.approve('hadith-1', '1', 'Entered reviewer', true);
    assert.equal(approved.review.status, 'approved'); assert.equal(approved.review.attestation?.kind, 'parent-entered');
    await assert.rejects(review.publish('hadith-1', '1'), /Confirm parent/);
    await assert.rejects(review.publish('hadith-1', '1', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: false }), /Confirm parent/);
    const published = await review.publish('hadith-1', '1', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true });
    assert.equal(published.review.status, 'published'); assert.equal(published.review.developmentOnly, true);
    assert.equal(published.review.publication?.kind, 'parent-local');
    assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 1);
    const requested = await review.requestReview('hadith-1', '1');
    assert.equal(requested.review.status, 'needs_review'); assert.equal(requested.review.reviewer, null);
    assert.equal(requested.review.publication, undefined); assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 0);
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
    await assert.rejects(review.publish(production.id, '1'), /attestation/);
    await review.approve(production.id, '1', 'Entered qualified reviewer', true);
    const published = await review.publish(production.id, '1', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }); assert.equal(published.review.status, 'published');
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

test('age changes withdraw published teaching and its attestation, preserve source records, and require review of the new version', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); const repository = new LessonReviewRepository(db, () => true);
    const original = (await repository.list()).find(lesson => lesson.id === 'hadith-1')!;
    const sourceBefore = await db.getFirstAsync('SELECT canonical_text,source_json,payload_json FROM hadiths WHERE id=?', original.hadithId!);
    const version2 = await repository.edit(original.id, '1', { sections: original.sections, discussion: original.discussion, ageRange: { min: 8, max: 11 } });
    assert.equal(version2.review.version, '2'); assert.equal(version2.review.status, 'draft');
    await repository.requestReview(original.id, '2');
    await repository.approve(original.id, '2', 'Reviewer supplied by parent', true);
    await assert.rejects(repository.publish(original.id, '2', { parentSuitabilityConfirmed: false, sourcePermissionConfirmed: true }), /Confirm parent/);
    const published = await repository.publish(original.id, '2', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true });
    assert.equal(visibleLessons([published], false, 9).length, 1);
    assert.equal(visibleLessons([published], false, 7).length, 0);
    assert.equal(visibleLessons([published], false, 12).length, 0);
    assert.equal(visibleLessons([published], false, null).length, 1);
    const version3 = await repository.edit(original.id, '2', { sections: published.sections, discussion: published.discussion, ageRange: { min: 12, max: 15 } });
    assert.equal(version3.review.version, '3'); assert.equal(version3.review.publication, undefined);
    assert.equal(version3.review.attestation, undefined); assert.equal(version3.review.reviewer, null);
    assert.equal(visibleLessons(await loadStoredLessons(db), false, 13).length, 0);
    assert.deepEqual(await db.getFirstAsync('SELECT canonical_text,source_json,payload_json FROM hadiths WHERE id=?', original.hadithId!), sourceBefore);
    await assert.rejects(repository.approve(original.id, '2', 'Old reviewer', true), /changed/);
    await assert.rejects(repository.publish(original.id, '3', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }), /attestation/);
    await assert.rejects(repository.edit(original.id, '3', { sections: published.sections, discussion: '', ageRange: { min: 15, max: 8 } }), /age range/);
  } finally { close(); }
});

test('existing installed drafts without age metadata stay private until ages are saved and newly reviewed', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); await seedReviewLessons(db);
    const legacy = { ...allLessons[0], ageRange: undefined };
    await db.runAsync('UPDATE lessons SET payload_json=? WHERE id=?', JSON.stringify(legacy), legacy.id);
    const review = new LessonReviewRepository(db, () => true);
    assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 0);
    await assert.rejects(review.approve(legacy.id, '1', 'Named reviewer', true), /age range/);
    const edited = await review.edit(legacy.id, '1', { sections: legacy.sections, discussion: legacy.discussion, ageRange: { min: 5, max: 7 } });
    assert.equal(edited.review.version, '2');
    await review.requestReview(legacy.id, '2'); await review.approve(legacy.id, '2', 'Named reviewer', true);
    const published = await review.publish(legacy.id, '2', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true });
    assert.equal(canShowReviewedContent(published.review, false), true);
  } finally { close(); }
});

test('unknown restricted development packs cannot gain publication rights through an attestation', () => {
  const lesson = { ...allLessons[0], id: 'restricted-unlicensed-import' };
  assert.equal(canParentPublishLesson(lesson), false);
  assert.throws(() => publishReviewedLesson(lesson, { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }), /restricted content pack/);
  assert.equal(validAgeRange({ min: 5, max: 15 }), true);
  for (const range of [{ min: 4, max: 15 }, { min: 5, max: 16 }, { min: 8.5, max: 12 }, { min: 12, max: 8 }]) assert.equal(validAgeRange(range), false);
});

test('the parent quiz preview exposes actual choices, matching keys, and ordering keys', () => {
  const choice = allLessons[0].quiz[0];
  assert.ok(quizReviewLines(choice).some(line => line === 'Answer: The reason for an action'));
  const order = allLessons.find(lesson => lesson.id === 'islam-wudu')!.quiz[0];
  assert.deepEqual(quizReviewLines(order), ['1. Hands', '2. Head', '3. Feet']);
  assert.deepEqual(quizReviewLines({ id: 'truth', type: 'true-false', prompt: 'Practice prompt', answer: false }), ['Answer: False']);
  assert.deepEqual(quizReviewLines({ id: 'match', type: 'match', prompt: 'Practice prompt', pairs: [{ id: 'a', left: 'A', right: 'B' }] }), ['A → B']);
});

test('age guidance gives short supported practice to younger children without adding religious facts', () => {
  assert.ok(agePracticeGuidance(5).includes('one small step'));
  assert.ok(agePracticeGuidance(9).includes('tell them what you learned'));
  assert.ok(agePracticeGuidance(14).includes('ask your teacher'));
  assert.ok(agePracticeGuidance(null).includes('with your adult'));
});

test('review fingerprints reject changed teaching or ages even if a stale import keeps its version and attestation', async () => {
  const { db, close } = localDb();
  try {
    await db.execAsync(schema); const repository = new LessonReviewRepository(db, () => true); await repository.list();
    const approved = await repository.approve('islam-salah', '1', 'Reviewer supplied by parent', true);
    assert.equal(approved.review.reviewedContentHash, reviewContentHash(approved));
    const published = await repository.publish('islam-salah', '1', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true });
    const imported = { ...published, ageRange: { min: 12, max: 15 }, discussion: 'Changed teaching without a version update.' };
    assert.notEqual(reviewContentHash(imported), published.review.reviewedContentHash);
    assert.equal(visibleLessons([imported], false).length, 0);
    await db.runAsync('UPDATE lessons SET payload_json=? WHERE id=?', JSON.stringify(imported), imported.id);
    assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 0);
    assert.throws(() => publishReviewedLesson({ ...imported, review: { ...imported.review, status: 'approved' } }, { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }), /changed after review/);
    const reordered = { ...published, source: Object.fromEntries(Object.entries(published.source).reverse()) as typeof published.source };
    assert.equal(reviewContentHash(reordered), published.review.reviewedContentHash);
  } finally { close(); }
});

test('parent authorization revoked during awaited writes rolls back approval and publication', async () => {
  for (const action of ['approve', 'publish'] as const) {
    const { db, close } = localDb();
    let authorized = true;
    let expireDuringWrite = false;
    const guarded: Database = { ...db, withTransactionAsync: work => db.withTransactionAsync(async transaction => {
      await work({ ...transaction, runAsync: async (sql, ...params) => {
        const result = await transaction.runAsync(sql, ...params);
        if (expireDuringWrite && sql.startsWith('UPDATE hadith_lessons')) {
          await Promise.resolve();
          authorized = false;
        }
        return result;
      } });
    }) };
    try {
      await db.execAsync(schema);
      const repository = new LessonReviewRepository(guarded, () => authorized);
      await repository.list();
      if (action === 'publish') await repository.approve('hadith-1', '1', 'Reviewer named by parent', true);
      const before = await db.getFirstAsync('SELECT status,payload_json FROM lessons WHERE id=?', 'hadith-1');
      const hadithBefore = await db.getFirstAsync('SELECT status,payload_json FROM hadith_lessons WHERE id=?', 'hadith-1');
      expireDuringWrite = true;
      await assert.rejects(action === 'approve'
        ? repository.approve('hadith-1', '1', 'Reviewer named by parent', true)
        : repository.publish('hadith-1', '1', { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }), /Unlock Parent Mode/);
      assert.equal(authorized, false);
      assert.deepEqual(await db.getFirstAsync('SELECT status,payload_json FROM lessons WHERE id=?', 'hadith-1'), before);
      assert.deepEqual(await db.getFirstAsync('SELECT status,payload_json FROM hadith_lessons WHERE id=?', 'hadith-1'), hadithBefore);
      assert.equal(visibleLessons(await loadStoredLessons(db), false).length, 0);
    } finally { close(); }
  }
});
