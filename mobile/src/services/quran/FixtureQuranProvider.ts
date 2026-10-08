import chapterData from '../../content/fixtures/quran-chapters.json';
import seed from '../../content/fixtures/quran-seed.json';
import audioManifest from '../../content/fixtures/quran-audio-manifest.json';
import { bundledTransliteration } from '../../content/fixtures/QuranTransliteration';
import { bundledPublishedMeaning } from '../../content/fixtures/QuranMeaning';
import type { Ayah, QuranSource, Surah } from '../../types/quran';
import type { QuranProvider } from './QuranProvider';

export const TANZIL_SOURCE: QuranSource = Object.freeze({ name: 'Tanzil Project', reference: 'Uthmani Quran text, version 1.1', url: 'https://tanzil.net/', license: 'CC BY 3.0; verbatim text only', version: seed.version, verifiedAt: seed.verifiedAt });
export const CLEARQURAN_SOURCE: QuranSource = Object.freeze({ name: 'ClearQuran (Allah Edition)', translator: 'Talal Itani', reference: 'Translation by Talal Itani, ClearQuran.com', url: 'https://clearquran.com/', license: 'CC BY-ND 4.0 with additional formatting permission', version: 'download-2026-10-07', verifiedAt: '2026-10-07' });
export const AUDIO_SOURCE:QuranSource=Object.freeze({name:audioManifest.source,reference:'Mishary Rashid Alafasy, ar.alafasy, original publisher 128 kbps ayah recordings',url:'https://alquran.cloud/',license:'Publisher allows personal/educational download and commercial product bundling; reciter retains copyright',version:'ar.alafasy-2026-10-07',verifiedAt:'2026-10-07'});

// Source text is copied without normalization, joining, diacritic changes, or AI generation.
export const SEEDED_AYAHS: readonly Ayah[] = Object.freeze(seed.verses.map(v => {const clip=audioManifest.clips.find(a=>a.key===v.key);const published=bundledPublishedMeaning(v.key);return Object.freeze({ key: v.key, surahNumber: v.surahNumber, ayahNumber: v.ayahNumber, canonicalText: v.canonicalText, source: TANZIL_SOURCE, translation: Object.freeze({ text: v.translation.text, source: CLEARQURAN_SOURCE }),transliteration:bundledTransliteration(v.key),publishedMeaning:published?.meaning,publisherNotes:published?.notes,audio:clip?Object.freeze({url:clip.url,reciter:clip.reciter,source:AUDIO_SOURCE}):undefined });}));
export const ALL_SURAHS: readonly Surah[] = Object.freeze(chapterData.map(s => Object.freeze({ ...s, source: TANZIL_SOURCE })));

export class FixtureQuranProvider implements QuranProvider {
  readonly id = 'tanzil-clearquran-seed';
  async chapters(): Promise<Surah[]> { return [...ALL_SURAHS]; }
  async verses(surahNumber: number): Promise<Ayah[]> { return SEEDED_AYAHS.filter(a => a.surahNumber === surahNumber); }
  async verse(key: string): Promise<Ayah | null> { return SEEDED_AYAHS.find(a => a.key === key) ?? null; }
}
