import fixture from './quran-transliteration.json';
import type { QuranSource, QuranTextLayer } from '../../types/quran';

/** This edition has noncommercial terms, independently of Tanzil's Arabic text license. */
export const TRANSLITERATION_SOURCE: QuranSource = Object.freeze(fixture.source);

const layers = new Map<string, QuranTextLayer>(fixture.verses.map(verse => [verse.key, Object.freeze({
  // Keep the publisher's strings, including their formatting markup, unchanged.
  text: verse.text,
  source: Object.freeze({ ...TRANSLITERATION_SOURCE, reference: `${TRANSLITERATION_SOURCE.reference}; ayah ${verse.key}` }),
})]));

/** Only the 29 sourced verses in the five offline lessons are present. */
export function bundledTransliteration(key: string): QuranTextLayer | undefined {
  return layers.get(key);
}
