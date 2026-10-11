/**
 * Exact Arabic wording of prayer and wudu phrases, cut from the Arabic hadith text without changes.
 * Source: fawazahmed0/hadith-api (Unlicense, public domain). References use sunnah.com numbering.
 * tests/fixtures/prayer-hadith-sources.json holds the full source texts; tests check every excerpt against them.
 * Generated; do not retype.
 */
export const PRAYER_ARABIC = {
  takbir: { source: "abudawud-874", arabic: ["اللَّهُ أَكْبَرُ"] },
  opening: { source: "abudawud-776", arabic: ["سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ وَلاَ إِلَهَ غَيْرُكَ"] },
  ruku: { source: "muslim-772", arabic: ["سُبْحَانَ رَبِّيَ الْعَظِيمِ"] },
  rising: { source: "muslim-772", arabic: ["سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ", "رَبَّنَا لَكَ الْحَمْدُ"] },
  sujud: { source: "muslim-772", arabic: ["سُبْحَانَ رَبِّيَ الأَعْلَى"] },
  betweenSujud: { source: "ibnmajah-897", arabic: ["رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي"] },
  tashahhud: { source: "bukhari-831", arabic: ["التَّحِيَّاتُ لِلَّهِ، وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلاَمُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلاَمُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ", "أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ اللَّهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ"] },
  salawat: { source: "bukhari-3370", arabic: ["اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ، وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ", "اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ، وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ، وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ"] },
  closingDua: { source: "bukhari-834", arabic: ["اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا وَلاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ، فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ، وَارْحَمْنِي إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ"] },
  taslim: { source: "abudawud-996", arabic: ["السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ"] },
  afterWudu: { source: "muslim-234", arabic: ["أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ اللَّهُ وَأَنَّ مُحَمَّدًا عَبْدُ اللَّهِ وَرَسُولُهُ"] },
} as const satisfies Record<string, { source: string; arabic: readonly string[] }>;
export type PrayerArabicKey = keyof typeof PRAYER_ARABIC;
