import type { ResourceSnapshot } from '../../types/quran';
import { verseIdForReference } from './QuranNavigation';

/** English labels in a localized catalog are not evidence of the resource's language. */
export function isEnglishTafsir(resource: ResourceSnapshot | undefined): resource is ResourceSnapshot {
  return resource?.resource_group === 'tafsirs' && ['english', 'en'].includes(resource.attribution?.language?.trim().toLowerCase() ?? '') && !!resource.attribution?.name?.trim();
}

export function tafsirVerseRange(row: Record<string, unknown>): { start: number; end: number } | null {
  if (typeof row.text !== 'string' || !row.text.trim()) return null;
  const start = typeof row.start_verse_id === 'number' ? row.start_verse_id : typeof row.group_verse_key_from === 'string' ? verseIdForReference(row.group_verse_key_from) : typeof row.verse_key === 'string' ? verseIdForReference(row.verse_key) : null;
  const end = typeof row.end_verse_id === 'number' ? row.end_verse_id : typeof row.group_verse_key_to === 'string' ? verseIdForReference(row.group_verse_key_to) : start;
  return typeof start === 'number' && typeof end === 'number' && Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 1 && end <= 6236 && start <= end ? { start, end } : null;
}

/** Count actual published coverage, rather than assuming a tafsir contains every ayah. */
export function tafsirCoverage(resource: ResourceSnapshot): { verseCount: number; totalVerseCount: 6236; passageCount: number; complete: boolean } {
  const covered = new Set<number>();
  let passageCount = 0;
  for (const row of resource.records) {
    const range = tafsirVerseRange(row);
    if (!range) continue;
    passageCount++;
    for (let id = range.start; id <= range.end; id++) covered.add(id);
  }
  return { verseCount: covered.size, totalVerseCount: 6236, passageCount, complete: covered.size === 6236 };
}
