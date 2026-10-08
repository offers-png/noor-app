import type { DuaRecord, LessonSource } from '../../types/lessons';
import { reviewDraft } from './sources';

/**
 * Supplications from the Qur'an. Arabic and transliteration are exact excerpts (from the start of the
 * supplication to the end of the ayah) of the Tanzil Uthmani 1.1 and Tanzil English Transliteration
 * editions; tests compare them with the original publisher files. The English line is an original
 * simple-meaning summary, not a Qur'an translation, and ships unapproved for qualified review.
 */
const TANZIL_LICENSE = 'Arabic: Tanzil Uthmani 1.1, CC BY 3.0, text unchanged. Transliteration: Tanzil English Transliteration, noncommercial use only.';
function quranicSource(verseKey: string): LessonSource {
  const [surah, ayah] = verseKey.split(':');
  return Object.freeze({ sourceName: 'Tanzil Project', sourceReference: `Qur'an ${verseKey} (supplication from the ayah)`, sourceUrl: `https://tanzil.net/#${surah}:${ayah}`,
    translationName: 'Simple meaning in our own words (not a published translation)', translator: null, contentVersion: 'tanzil-uthmani-1.1+en.transliteration-2010-09-06',
    verifiedAt: '2026-10-08', license: TANZIL_LICENSE, licenseUrl: 'https://tanzil.net/docs/Text_License' });
}
const records = [
  { id: 'dua-quran-good-both-worlds', category: 'Everyday', title: 'Good in this life and the next', verseKey: '2:201',
    canonicalText: "رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةً وَفِى ٱلْـَٔاخِرَةِ حَسَنَةً وَقِنَا عَذَابَ ٱلنَّارِ",
    transliteration: "rabban<u>a</u> <u>a</u>tin<u>a</u> fee a<b>l</b>dduny<u>a</u> <u>h</u>asanatan wafee al<u>a</u>khirati <u>h</u>asanatan waqin<u>a</u> AAa<u>tha</u>ba a<b>l</b>nn<u>a</u>r<b>i</b>",
    translation: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire." },
  { id: 'dua-quran-parents', category: 'Parents', title: 'Mercy for my parents', verseKey: '17:24',
    canonicalText: "رَّبِّ ٱرْحَمْهُمَا كَمَا رَبَّيَانِى صَغِيرًا",
    transliteration: "rabbi ir<u>h</u>amhum<u>a</u> kam<u>a</u> rabbay<u>a</u>nee <u>s</u>agheer<u>a</u><b>n</b>",
    translation: "My Lord, have mercy on my parents, as they cared for me when I was small." },
  { id: 'dua-quran-knowledge', category: 'Knowledge', title: 'More knowledge', verseKey: '20:114',
    canonicalText: "رَّبِّ زِدْنِى عِلْمًا",
    transliteration: "rabbi zidnee AAilm<u>a</u><b>n</b>",
    translation: "My Lord, increase me in knowledge." },
  { id: 'dua-quran-family', category: 'Family', title: 'A family that brings joy', verseKey: '25:74',
    canonicalText: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَٰجِنَا وَذُرِّيَّٰتِنَا قُرَّةَ أَعْيُنٍ وَٱجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا",
    transliteration: "rabban<u>a</u> hab lan<u>a</u> min azw<u>a</u>jin<u>a</u> wa<u>th</u>urriyy<u>a</u>tin<u>a</u> qurrata aAAyunin wa<b>i</b>jAAaln<u>a</u> lilmuttaqeena im<u>a</u>m<u>a</u><b>n</b>",
    translation: "Our Lord, give us joy in our families and children, and make us good examples for people who are mindful of You." },
] as const;

export const quranicDuaFixtures: readonly DuaRecord[] = Object.freeze(records.map(record => Object.freeze({
  id: record.id, category: record.category, title: record.title, canonicalText: record.canonicalText,
  transliteration: record.transliteration, translation: record.translation, source: quranicSource(record.verseKey),
  textScope: 'excerpt' as const, audioUri: null, review: reviewDraft(), verseKey: record.verseKey,
  transliterationFormat: 'tanzil-markup' as const, translationKind: 'learning-summary' as const,
})));
