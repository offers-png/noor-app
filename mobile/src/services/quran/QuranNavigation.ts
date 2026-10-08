import chapters from '../../content/fixtures/quran-chapters.json';

export interface AyahReference { key: string; surahNumber: number; ayahNumber: number }

/** Only the search query is converted; canonical Quran text never passes through this helper. */
export function parseAyahReference(query: string): AyahReference | null {
  const normalized = query.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, digit => String(digit.charCodeAt(0) - (digit >= '\u06F0' ? 0x06F0 : 0x0660)));
  const match = /^\s*(\d{1,3})\s*[:：]\s*(\d{1,3})\s*$/.exec(normalized);
  if (!match) return null;
  const surahNumber = Number(match[1]);
  const ayahNumber = Number(match[2]);
  const chapter = chapters.find(row => row.number === surahNumber);
  if (!chapter || ayahNumber < 1 || ayahNumber > chapter.ayahCount) return null;
  return {key: `${surahNumber}:${ayahNumber}`, surahNumber, ayahNumber};
}

/** Canonical verse IDs follow the source's chapter and ayah sequence. */
export function verseIdForReference(key: string): number | undefined {
  const reference = parseAyahReference(key);
  if (!reference) return undefined;
  return chapters.filter(chapter => chapter.number < reference.surahNumber).reduce((count, chapter) => count + chapter.ayahCount, 0) + reference.ayahNumber;
}
