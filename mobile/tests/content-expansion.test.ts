import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quranicDuaFixtures } from '../src/content/lessons/quranicDuas';
import { allLessons } from '../src/content/lessons/catalog';
import { canParentPublishLesson, isPublishedForFamily, publishReviewedLesson, visibleLessons } from '../src/content/lessons/approval';
import { reviewContentHash } from '../src/content/lessons/reviewContent';
import { sourceTextRuns } from '../src/services/quran/presentation';
import { arabicNumbers, numberQuestions, simpleWords } from '../src/features/arabic/content';

function rows(file: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readFileSync(new URL(`./fixtures/tanzil/${file}`, import.meta.url), 'utf8').split('\n')) {
    const parts = line.split('|'); if (parts.length >= 3 && /^\d+$/.test(parts[0])) map.set(`${parts[0]}:${parts[1]}`, parts.slice(2).join('|'));
  }
  return map;
}
const arabic = rows('quran-uthmani-1.1.txt');
const transliteration = rows('en.transliteration.txt');
const newLessonIds = ['islam-prayer-times', 'islam-prayer-ready', 'islam-six-beliefs', 'islam-salam', 'islam-parents', ...quranicDuaFixtures.map(dua => dua.id)];

test('Qur’anic duas are exact Tanzil excerpts ending at the end of their ayah', () => {
  assert.equal(quranicDuaFixtures.length, 4);
  for (const dua of quranicDuaFixtures) {
    const sourceArabic = arabic.get(dua.verseKey!)!; const sourceTransliteration = transliteration.get(dua.verseKey!)!;
    assert.ok(sourceArabic.endsWith(dua.canonicalText) && sourceArabic.split(' ').length > dua.canonicalText.split(' ').length || sourceArabic === dua.canonicalText, `${dua.id} Arabic must be an unchanged ayah excerpt`);
    assert.ok(sourceArabic.endsWith(` ${dua.canonicalText}`), `${dua.id} excerpt starts on a word boundary`);
    assert.ok(sourceTransliteration.endsWith(` ${dua.transliteration}`), `${dua.id} transliteration must be an unchanged excerpt`);
    assert.equal(dua.canonicalText.split(' ').length, dua.transliteration.split(' ').length, `${dua.id} Arabic and transliteration cover the same words`);
    assert.equal(sourceTextRuns(dua.transliteration).map(run => run.text).join('').includes('<'), false, 'publisher markup is formatted, not shown');
    assert.equal(dua.translationKind, 'learning-summary'); assert.match(dua.source.translationName!, /not a published translation/);
    assert.match(dua.source.license, /noncommercial/); assert.equal(dua.review.status, 'needs_review'); assert.equal(dua.review.developmentOnly, true);
  }
});

test('new prayer, belief, manners and dua lessons ship unpublished and stay hidden from children until reviewed', () => {
  const lessons = allLessons.filter(lesson => newLessonIds.includes(lesson.id));
  assert.equal(lessons.length, newLessonIds.length);
  for (const lesson of lessons) {
    assert.equal(lesson.review.status, 'needs_review'); assert.equal(lesson.review.approvedAt, null); assert.equal(isPublishedForFamily(lesson), false);
    assert.equal(canParentPublishLesson(lesson), true, `${lesson.id} has a parent publication path`);
    assert.ok(lesson.source.sourceReference && lesson.source.sourceUrl.startsWith('https://'));
    for (const section of lesson.sections) if (section.kind === 'source_fact') assert.ok(section.sourceReference, `${lesson.id}/${section.title} cites its source`);
  }
  assert.equal(visibleLessons(lessons, false).length, 0, 'Normal Kids Mode never shows unreviewed drafts');
  assert.equal(visibleLessons(lessons, true).length, lessons.length, 'The parent-enabled review pack previews them');
});

test('a reviewed Qur’anic dua lesson can be published only after attestation of the exact version', () => {
  const lesson = allLessons.find(item => item.id === 'dua-quran-knowledge')!;
  assert.throws(() => publishReviewedLesson(lesson, { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true }), /attestation/);
  const approvedAt = '2026-10-08T10:00:00.000Z';
  const approved = { ...lesson, review: { ...lesson.review, status: 'approved' as const, reviewer: 'Named teacher', approvedAt, approvedVersion: lesson.review.version, reviewedContentHash: reviewContentHash(lesson), attestation: { kind: 'parent-entered' as const, qualificationConfirmed: true as const, recordedAt: approvedAt } } };
  const published = publishReviewedLesson(approved, { parentSuitabilityConfirmed: true, sourcePermissionConfirmed: true });
  assert.equal(isPublishedForFamily(published), true);
  assert.equal(visibleLessons([published], false, 8).length, 1);
  const edited = { ...published, sections: published.sections.map((section, index) => index ? section : { ...section, body: `${section.body} Changed.` }) };
  assert.equal(isPublishedForFamily(edited), false, 'Changing reviewed teaching withdraws it');
});

test('Arabic numbers and words are complete and quiz answers are valid', () => {
  assert.deepEqual(arabicNumbers.map(number => number.value), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(arabicNumbers.map(number => number.digit)).size, 10);
  assert.ok(simpleWords.length >= 8);
  for (const question of numberQuestions) {
    if ('options' in question && question.options) assert.ok(question.options.some(option => option.id === question.correctOptionId));
  }
});
