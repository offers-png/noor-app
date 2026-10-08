import type { DuaRecord } from '../../types/lessons';
import { reviewDraft, sunnahSource } from './sources';
import { quranicDuaFixtures } from './quranicDuas';

/** Arabic/English are exact short selections. Original transliteration aids require review. */
export const duaFixtures: readonly DuaRecord[] = Object.freeze([
  { id: 'dua-before-eating', category: 'Before Eating', title: 'Before eating', canonicalText: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillāh.', translation: 'With the Name of Allah.', source: sunnahSource('Hisn al-Muslim 178 (supplication excerpt)', 'hisn:178'), textScope: 'supplication', audioUri: null, review: reviewDraft() },
  { id: 'dua-forgiveness', category: 'Morning', title: 'Ask for forgiveness', canonicalText: 'رَبِّ اغْفرْ لي',
    transliteration: 'rabbighfir lī.', translation: 'My Lord, forgive me.', source: sunnahSource('Hisn al-Muslim 2 (excerpt)', 'hisn:2'), textScope: 'excerpt', audioUri: null, review: reviewDraft() },
  { id: 'dua-knowledge', category: 'Knowledge', title: 'Ask for useful knowledge', canonicalText: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْماً نَافِعاً',
    transliteration: 'Allāhumma innī as’aluka ‘ilman nāfi‘a.', translation: 'O Allah, I ask You for knowledge that is of benefit,', source: sunnahSource('Hisn al-Muslim 95 (excerpt); Ibn Majah 925', 'hisn:95'), textScope: 'excerpt', audioUri: null, review: reviewDraft() },
  { id: 'dua-masjid-entry', category: 'Entering Masjid', title: 'Entering the masjid', canonicalText: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Allāhumma iftaḥ lī abwāba raḥmatik.', translation: 'O Allah, open to me the gates of thy mercy.', source: sunnahSource('Sunan Abi Dawud 465 (supplication excerpt)', 'abudawud:465'), textScope: 'supplication', audioUri: null, review: reviewDraft() },
  { id: 'dua-masjid-exit', category: 'Leaving Masjid', title: 'Leaving the masjid', canonicalText: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
    transliteration: 'Allāhumma innī as’aluka min faḍlik.', translation: 'O Allah! I beg of Thee Thy Grace.', source: sunnahSource('Sahih Muslim 713a (supplication excerpt)', 'muslim:713a'), textScope: 'supplication', audioUri: null, review: reviewDraft() },
  ...quranicDuaFixtures,
]);
