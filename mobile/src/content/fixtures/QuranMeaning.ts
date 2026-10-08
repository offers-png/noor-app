import fixture from './quran-meaning.json';
import type { QuranSource, QuranTextLayer } from '../../types/quran';

/** Published meaning and notes are distinct from both canonical Arabic and app teaching drafts. */
export const PUBLISHED_MEANING_SOURCE: QuranSource = Object.freeze(fixture.source);

const layers = new Map(fixture.verses.map(verse => {
  const source = Object.freeze({ ...PUBLISHED_MEANING_SOURCE, reference: `${PUBLISHED_MEANING_SOURCE.reference}; ayah ${verse.key}` });
  const meaning: QuranTextLayer = Object.freeze({ text: verse.text, source });
  const notes: QuranTextLayer | undefined = verse.notes ? Object.freeze({ text: verse.notes, source }) : undefined;
  return [verse.key, Object.freeze({ meaning, notes })] as const;
}));

/** Strings are copied directly from the edition's official API, without joining or rewriting. */
export function bundledPublishedMeaning(key: string): { meaning: QuranTextLayer; notes?: QuranTextLayer } | undefined {
  return layers.get(key);
}
