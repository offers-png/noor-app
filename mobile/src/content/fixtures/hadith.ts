import type { HadithRecord } from '../../types/lessons';
import { sunnahSource } from '../lessons/sources';

/** Selected excerpts, copied verbatim from the cited primary source. Not full narrations. */
export const hadithFixtures: readonly HadithRecord[] = Object.freeze([
  Object.freeze({ id: 'bukhari:1:excerpt', collection: 'bukhari', hadithNumber: '1',
    canonicalText: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', translation: 'The reward of deeds depends upon the intentions',
    narrator: "Umar bin Al-Khattab", grades: [], source: sunnahSource('Sahih al-Bukhari 1 (excerpt)', 'bukhari:1'),
    textScope: 'excerpt' as const, sourceFormat: 'plain-text' as const, developmentOnly: true }),
  Object.freeze({ id: 'bukhari:6018:excerpt', collection: 'bukhari', hadithNumber: '6018',
    canonicalText: 'فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', translation: 'should talk what is good or keep quiet.',
    narrator: 'Abu Huraira', grades: [], source: sunnahSource('Sahih al-Bukhari 6018 (excerpt)', 'bukhari:6018'),
    textScope: 'excerpt' as const, sourceFormat: 'plain-text' as const, developmentOnly: true }),
  Object.freeze({ id: 'bukhari:13:excerpt', collection: 'bukhari', hadithNumber: '13',
    canonicalText: 'حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', translation: 'till he wishes for his (Muslim) brother what he likes for himself.',
    narrator: 'Anas', grades: [], source: sunnahSource('Sahih al-Bukhari 13 (excerpt)', 'bukhari:13'),
    textScope: 'excerpt' as const, sourceFormat: 'plain-text' as const, developmentOnly: true }),
]);
