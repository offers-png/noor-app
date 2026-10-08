import type { ContentReview, LessonSource } from '../../types/lessons';

export const SOURCE_CHECK_DATE = '2026-10-07';
export function sunnahSource(reference: string, path: string, translationName = 'English translation displayed by Sunnah.com'): LessonSource {
  return Object.freeze({ sourceName: 'Sunnah.com', sourceReference: reference, sourceUrl: `https://sunnah.com/${path}`,
    translationName, translator: null, contentVersion: 'teaching-excerpts-2026-10-07', verifiedAt: SOURCE_CHECK_DATE,
    license: 'Individual hadith/selections permitted for teaching; no scraping or mass collection reproduction.',
    licenseUrl: 'https://sunnah.com/about#reproduction' });
}
export function quranReference(reference: string, path: string): LessonSource {
  return Object.freeze({ sourceName: "Qur'an source reference", sourceReference: reference, sourceUrl: `https://quran.com/${path}`,
    translationName: null, translator: null, contentVersion: 'source-reference-2026-10-07', verifiedAt: SOURCE_CHECK_DATE,
    license: 'Reference only. No Quran.com translation or assets bundled in this lesson.', licenseUrl: 'https://quran.com/about-us' });
}
export function reviewDraft(): ContentReview {
  return { status: 'needs_review', reviewer: null, approvedAt: null, approvedVersion: null, version: '1', developmentOnly: true };
}
