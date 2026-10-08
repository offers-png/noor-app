import type { Database } from '../../services/database/types';
import { hadithFixtures } from '../fixtures/hadith';
import { allLessons, lessonSourceRegistry } from './catalog';
import { duaFixtures } from './duas';
import type { EducationLesson, LessonSource } from '../../types/lessons';

function equalSource(left: LessonSource, right: LessonSource): boolean {
  const fields = Object.keys(left).sort();
  return JSON.stringify(fields) === JSON.stringify(Object.keys(right).sort())
    && JSON.stringify(left, fields) === JSON.stringify(right, fields);
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
    if (original && (!equalSource(lesson.source, original.source) || lesson.review.developmentOnly !== original.review.developmentOnly
      || lesson.hadithId !== original.hadithId || lesson.duaId !== original.duaId || JSON.stringify(lesson.quiz) !== JSON.stringify(original.quiz)
      || lesson.sections.length !== original.sections.length || lesson.sections.some((section, index) => {
        const base = original.sections[index];
        return section.kind !== base.kind || section.sourceReference !== base.sourceReference || section.illustration !== base.illustration || section.audioUri !== base.audioUri;
      }))) throw new Error('An education override tried to change immutable content or source fields.');
    overrides.set(lesson.id, lesson);
  }
  return [...allLessons.map(lesson => overrides.get(lesson.id) ?? lesson), ...[...overrides.values()].filter(lesson => !allLessons.some(original => original.id === lesson.id))];
}

export async function seedReviewLessons(db: Database): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const source of lessonSourceRegistry) await db.runAsync('INSERT OR IGNORE INTO content_sources(id,payload_json) VALUES (?,?)', source.sourceReference, JSON.stringify(source));
    for (const hadith of hadithFixtures) await db.runAsync('INSERT OR IGNORE INTO hadiths(id,canonical_text,source_json,payload_json) VALUES (?,?,?,?)', hadith.id, hadith.canonicalText, JSON.stringify(hadith.source), JSON.stringify(hadith));
    for (const dua of duaFixtures) await db.runAsync('INSERT OR IGNORE INTO duas(id,payload_json,source_json) VALUES (?,?,?)', dua.id, JSON.stringify(dua), JSON.stringify(dua.source));
    for (const lesson of allLessons) {
      await db.runAsync('INSERT OR IGNORE INTO lessons(id,category,status,payload_json,source_json) VALUES (?,?,?,?,?)', lesson.id, lesson.category, lesson.review.status, JSON.stringify(lesson), JSON.stringify(lesson.source));
      if (lesson.hadithId) await db.runAsync('INSERT OR IGNORE INTO hadith_lessons(id,hadith_id,status,payload_json) VALUES (?,?,?,?)', lesson.id, lesson.hadithId, lesson.review.status, JSON.stringify(lesson));
      for (const quiz of lesson.quiz) await db.runAsync('INSERT OR IGNORE INTO quiz_questions(id,lesson_id,payload_json) VALUES (?,?,?)', quiz.id, lesson.id, JSON.stringify(quiz));
    }
  });
}
