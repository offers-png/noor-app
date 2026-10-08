import type { LessonSource, SourceReadingRecord } from '../../types/lessons';
import { hadithFixtures } from '../fixtures/hadith';
import { duaFixtures } from './duas';
import { sunnahSource } from './sources';

/**
 * Individually checked selections, not an automatic publication of fixture packs.
 * Sunnah.com's reproduction permission permits individual teaching selections:
 * https://sunnah.com/about#reproduction (checked 2026-10-08).
 * Each existing Arabic/English phrase was checked against its cited page again.
 * Original explanations, quizzes and transliteration aids keep their own review gate.
 */
const publication = Object.freeze({ kind: 'permitted-teaching-selection' as const,
  sourceCheckedAt: '2026-10-08', permissionCheckedAt: '2026-10-08',
  permissionUrl: 'https://sunnah.com/about#reproduction' });

function publishedTransliteration(text: string, reference: string, path: string) {
  const source: LessonSource = Object.freeze({
    ...sunnahSource(reference, path, 'Transliteration displayed by Sunnah.com'),
    contentVersion: 'published-transliteration-excerpts-2026-10-08', verifiedAt: '2026-10-08',
  });
  return Object.freeze({ text, source });
}

// Exact short Latin selections from the referenced Hisn pages, including punctuation.
// Mosque selections have their own provenance; Arabic/English retain their original
// Abu Dawud / Muslim provenance. These are never substituted for canonical Arabic.
const latin = Object.freeze({
  'dua-before-eating': publishedTransliteration('Bismillāh.', 'Hisn al-Muslim 178 (transliteration selection)', 'hisn:178'),
  'dua-forgiveness': publishedTransliteration('rabbighfir lī.', 'Hisn al-Muslim 2 (transliteration selection)', 'hisn:2'),
  'dua-knowledge': publishedTransliteration("Allāhumma innī as'aluka `ilman nāfi`a,", 'Hisn al-Muslim 95 (transliteration selection)', 'hisn:95'),
  'dua-masjid-entry': publishedTransliteration("Allāhummaftaḥ lī 'abwāba raḥmatik.", 'Hisn al-Muslim 20 (transliteration selection)', 'hisn:20'),
  'dua-masjid-exit': publishedTransliteration("Allāhumma 'innī 'as'aluka min faḍlika,", 'Hisn al-Muslim 21 (transliteration selection)', 'hisn:21'),
});

const checkedHadith = [
  { id: 'bukhari:1:excerpt', title: 'Intentions', topic: 'Sahih al-Bukhari' },
  { id: 'bukhari:6018:excerpt', title: 'Good words', topic: 'Sahih al-Bukhari' },
  { id: 'bukhari:13:excerpt', title: 'Wishing good for others', topic: 'Sahih al-Bukhari' },
] as const;
const checkedDuas = ['dua-before-eating', 'dua-forgiveness', 'dua-knowledge', 'dua-masjid-entry', 'dua-masjid-exit'] as const;

/** No stored editorial override or arbitrary new fixture can enter this catalog. */
export const sourceReadingCatalog: readonly SourceReadingRecord[] = Object.freeze([
  ...checkedHadith.map(selection => {
    const record = hadithFixtures.find(item => item.id === selection.id)!;
    return Object.freeze({ id: record.id, category: 'hadith' as const, title: selection.title, topic: selection.topic,
      canonicalText: record.canonicalText, translation: record.translation, source: record.source,
      textScope: 'excerpt' as const, narrator: record.narrator, audioUri: null, transliteration: null, publication });
  }),
  ...checkedDuas.map(id => {
    const record = duaFixtures.find(item => item.id === id)!;
    return Object.freeze({ id: record.id, category: 'duas' as const, title: record.title, topic: record.category,
      canonicalText: record.canonicalText, translation: record.translation, source: record.source,
      textScope: record.textScope, narrator: null, audioUri: record.audioUri,
      transliteration: latin[id], publication });
  }),
]);

export const sourceReadingSourceRegistry: readonly LessonSource[] = Object.freeze([
  ...new Map(sourceReadingCatalog.flatMap(record => [record.source, ...(record.transliteration ? [record.transliteration.source] : [])])
    .map(source => [source.sourceReference, source])).values(),
]);

export function sourceReadings(category: 'hadith' | 'duas'): SourceReadingRecord[] {
  return sourceReadingCatalog.filter(record => record.category === category);
}

/** Reading practice never completes an editorial lesson or fabricates a quiz score. */
export function sourcePracticeId(record: SourceReadingRecord): string {
  return `${record.category === 'hadith' ? 'hadith' : 'dua'}-reading:${record.id}`;
}
