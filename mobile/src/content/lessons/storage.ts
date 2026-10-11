import type { Database } from '../../services/database/types';
import { hadithFixtures } from '../fixtures/hadith';
import { allLessons, lessonSourceRegistry } from './catalog';
import { duaFixtures } from './duas';
import type { EducationLesson, LessonSource } from '../../types/lessons';
import { validAgeRange } from './approval';
import { reviewContentHash } from './reviewContent';

function equalSource(left: LessonSource, right: LessonSource): boolean {
  const fields = Object.keys(left).sort();
  return JSON.stringify(fields) === JSON.stringify(Object.keys(right).sort())
    && JSON.stringify(left, fields) === JSON.stringify(right, fields);
}

/** Identifies the bundled content of a catalog lesson, independent of the ages a parent chose. */
export function catalogHash(lesson: EducationLesson): string {
  return reviewContentHash({ ...lesson, ageRange: undefined });
}
function immutableFieldsMatch(lesson: EducationLesson, original: EducationLesson): boolean {
  return equalSource(lesson.source, original.source) && lesson.review.developmentOnly === original.review.developmentOnly
    && lesson.hadithId === original.hadithId && lesson.duaId === original.duaId && JSON.stringify(lesson.quiz) === JSON.stringify(original.quiz)
    && lesson.sections.length === original.sections.length && lesson.sections.every((section, index) => {
      const base = original.sections[index];
      return section.kind === base.kind && section.sourceReference === base.sourceReference && section.illustration === base.illustration
        && section.audioUri === base.audioUri && section.arabic === base.arabic;
    });
}
/**
 * A stored copy is stale when the app now bundles different content for that lesson. Copies made before
 * catalog hashes existed are stale unless they still match the bundle, or a parent edited them and the edit still fits it.
 */
export function isStaleCopy(lesson: EducationLesson, original: EducationLesson): boolean {
  if (lesson.catalogHash) return lesson.catalogHash !== catalogHash(original);
  if (catalogHash({ ...lesson, catalogHash: undefined, review: original.review }) === catalogHash(original)) return false;
  return lesson.review.version === original.review.version || !immutableFieldsMatch(lesson, original);
}
function freshCopy(original: EducationLesson, stored?: EducationLesson): EducationLesson {
  return { ...original, ageRange: stored?.ageRange ?? original.ageRange, catalogHash: catalogHash(original) };
}

/** Loads education overrides; religious source/canonical rows are never changed here. */
export async function loadStoredLessons(db: Database): Promise<EducationLesson[]> {
  const rows = await db.getAllAsync<{ id: string; category: string; status: string; payload_json: string; source_json: string }>('SELECT id,category,status,payload_json,source_json FROM lessons');
  const overrides = new Map<string, EducationLesson>();
  for (const row of rows) {
    // Other learning engines share the lessons table; they have their own adapters.
    if (!['hadith', 'islam', 'duas'].includes(row.category)) continue;
    const lesson = JSON.parse(row.payload_json) as EducationLesson;
    if (!lesson || lesson.id !== row.id || lesson.category !== row.category || !lesson.review || lesson.review.status !== row.status
      || !['draft', 'needs_review', 'approved', 'published'].includes(lesson.review.status)
      || typeof lesson.review.version !== 'string' || !lesson.review.version.trim() || typeof lesson.review.developmentOnly !== 'boolean'
      || (lesson.review.reviewer !== null && typeof lesson.review.reviewer !== 'string')
      || (lesson.review.approvedAt !== null && typeof lesson.review.approvedAt !== 'string')
      || (lesson.review.approvedVersion !== null && typeof lesson.review.approvedVersion !== 'string')
      || (lesson.review.reviewedContentHash !== undefined && (typeof lesson.review.reviewedContentHash !== 'string' || !/^[a-f0-9]{64}$/.test(lesson.review.reviewedContentHash)))
      || (lesson.ageRange !== undefined && !validAgeRange(lesson.ageRange))
      || (lesson.review.attestation !== undefined && (lesson.review.attestation?.kind !== 'parent-entered'
        || lesson.review.attestation.qualificationConfirmed !== true || typeof lesson.review.attestation.recordedAt !== 'string'
        || !Number.isFinite(Date.parse(lesson.review.attestation.recordedAt))))
      || (lesson.review.publication !== undefined && (lesson.review.publication?.kind !== 'parent-local'
        || lesson.review.publication.version !== lesson.review.version || lesson.review.publication.parentSuitabilityConfirmed !== true
        || lesson.review.publication.sourcePermissionConfirmed !== true || typeof lesson.review.publication.publishedAt !== 'string'
        || !Number.isFinite(Date.parse(lesson.review.publication.publishedAt))))
      || typeof lesson.title !== 'string' || typeof lesson.discussion !== 'string' || !Array.isArray(lesson.sections) || !Array.isArray(lesson.quiz)
      || !lesson.source || typeof lesson.source.sourceName !== 'string' || typeof lesson.source.sourceReference !== 'string'
      || typeof lesson.source.sourceUrl !== 'string' || typeof lesson.source.contentVersion !== 'string' || typeof lesson.source.verifiedAt !== 'string'
      || typeof lesson.source.license !== 'string' || typeof lesson.source.licenseUrl !== 'string'
      || (lesson.source.translator !== null && typeof lesson.source.translator !== 'string')
      || (lesson.source.translationName !== null && typeof lesson.source.translationName !== 'string')
      || !equalSource(lesson.source, JSON.parse(row.source_json))
      || lesson.sections.some(section => !section || typeof section.title !== 'string' || typeof section.body !== 'string')) {
      throw new Error('Stored lesson data failed integrity checks.');
    }
    const original = allLessons.find(item => item.id === lesson.id);
    // An outdated bundled copy is not shown; the next seed replaces it and it needs a new parent approval.
    if (original && isStaleCopy(lesson, original)) continue;
    if (original && !immutableFieldsMatch(lesson, original)) throw new Error('An education override tried to change immutable content or source fields.');
    overrides.set(lesson.id, lesson);
  }
  return [...allLessons.map(lesson => overrides.get(lesson.id) ?? lesson), ...[...overrides.values()].filter(lesson => !allLessons.some(original => original.id === lesson.id))];
}

export async function seedReviewLessons(db: Database): Promise<void> {
  await db.withTransactionAsync(async tx => {
    for (const source of lessonSourceRegistry) await tx.runAsync('INSERT OR IGNORE INTO content_sources(id,payload_json) VALUES (?,?)', source.sourceReference, JSON.stringify(source));
    for (const hadith of hadithFixtures) await tx.runAsync('INSERT OR IGNORE INTO hadiths(id,canonical_text,source_json,payload_json) VALUES (?,?,?,?)', hadith.id, hadith.canonicalText, JSON.stringify(hadith.source), JSON.stringify(hadith));
    for (const dua of duaFixtures) await tx.runAsync('INSERT OR IGNORE INTO duas(id,payload_json,source_json) VALUES (?,?,?)', dua.id, JSON.stringify(dua), JSON.stringify(dua.source));
    for (const original of allLessons) {
      const row = await tx.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM lessons WHERE id=?', original.id);
      const stored = row ? JSON.parse(row.payload_json) as EducationLesson : undefined;
      let lesson = stored;
      if (!stored || stored.id !== original.id || isStaleCopy(stored, original)) lesson = freshCopy(original, stored?.id === original.id ? stored : undefined);
      else if (!stored.catalogHash) lesson = { ...stored, catalogHash: catalogHash(original) };
      if (lesson !== stored) {
        await tx.runAsync('INSERT OR REPLACE INTO lessons(id,category,status,payload_json,source_json) VALUES (?,?,?,?,?)', lesson!.id, lesson!.category, lesson!.review.status, JSON.stringify(lesson), JSON.stringify(lesson!.source));
        if (lesson!.hadithId) await tx.runAsync('INSERT OR REPLACE INTO hadith_lessons(id,hadith_id,status,payload_json) VALUES (?,?,?,?)', lesson!.id, lesson!.hadithId, lesson!.review.status, JSON.stringify(lesson));
      }
      for (const quiz of original.quiz) await tx.runAsync('INSERT OR REPLACE INTO quiz_questions(id,lesson_id,payload_json) VALUES (?,?,?)', quiz.id, original.id, JSON.stringify(quiz));
    }
  });
}
