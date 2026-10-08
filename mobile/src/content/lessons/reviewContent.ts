import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { EducationLesson } from '../../types/lessons';
import { hadithFixtures } from '../fixtures/hadith';
import { duaFixtures } from './duas';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().filter(key => record[key] !== undefined).map(key => [key, ordered(record[key])]));
  }
  return value;
}

/** Binds an attestation to rendered content; it does not authenticate the reviewer. */
export function reviewContentHash(lesson: EducationLesson): string {
  const dua = duaFixtures.find(record => record.id === lesson.duaId);
  const hadith = hadithFixtures.find(record => record.id === lesson.hadithId);
  const content = { id: lesson.id, category: lesson.category, title: lesson.title, subtitle: lesson.subtitle,
    topic: lesson.topic, source: lesson.source, sections: lesson.sections, discussion: lesson.discussion,
    quiz: lesson.quiz, ageRange: lesson.ageRange, stepByStep: lesson.stepByStep,
    hadithId: lesson.hadithId, duaId: lesson.duaId, hadith,
    dua: dua ? { canonicalText: dua.canonicalText, translation: dua.translation, transliteration: dua.transliteration,
      source: dua.source, textScope: dua.textScope, audioUri: dua.audioUri } : undefined };
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(ordered(content)))));
}
