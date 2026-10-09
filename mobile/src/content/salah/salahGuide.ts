import type { LessonSection } from '../../types/lessons';

/**
 * Salah guide data. Qur'an passages point at the bundled, verified Tanzil text and Alafasy audio
 * (surahs 1, 112, 113, 114). Words said outside the Qur'an are shown by name, transliteration and
 * meaning with a hadith reference for the reviewer to check; their Arabic is not included until a
 * verified, licensed source is added. Nothing here is shown to children until a parent publishes
 * the reviewed guide.
 */
export interface Prayer { id: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; name: string; arabicName: string; rakahs: 2 | 3 | 4; time: string }
export const PRAYERS: readonly Prayer[] = Object.freeze([
  { id: 'fajr', name: 'Fajr', arabicName: 'الفجر', rakahs: 2, time: 'Dawn, before sunrise' },
  { id: 'dhuhr', name: 'Dhuhr', arabicName: 'الظهر', rakahs: 4, time: 'After midday' },
  { id: 'asr', name: 'Asr', arabicName: 'العصر', rakahs: 4, time: 'Afternoon' },
  { id: 'maghrib', name: 'Maghrib', arabicName: 'المغرب', rakahs: 3, time: 'Just after sunset' },
  { id: 'isha', name: 'Isha', arabicName: 'العشاء', rakahs: 4, time: 'Night' },
]);

/** A phrase said in prayer. `quranKeys` reference bundled verified ayahs; other phrases carry a reference only. */
export interface Recitation { id: string; name: string; transliteration?: string; meaning: string; reference: string; quranKeys?: string[]; repeat?: string }
export const RECITATIONS: Record<string, Recitation> = {
  takbir: { id: 'takbir', name: 'Takbir', transliteration: 'Allāhu akbar', meaning: 'Allah is the Greatest.', reference: 'Sahih al-Bukhari 757' },
  fatihah: { id: 'fatihah', name: 'Surah Al-Fatihah', meaning: 'The Opening: recited in every rak‘ah.', reference: "Qur'an 1:1–7; Sahih al-Bukhari 756", quranKeys: ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'] },
  extraSurah: { id: 'extraSurah', name: 'A short surah after Al-Fatihah', meaning: 'Recite some Qur’an you know, such as Al-Ikhlas, Al-Falaq or An-Nas.', reference: 'Sahih al-Bukhari 757', quranKeys: ['112:1', '112:2', '112:3', '112:4'] },
  ruku: { id: 'ruku', name: 'Words in ruku', transliteration: 'Subḥāna rabbiyal-‘aẓīm', meaning: 'Glory be to my Lord, the Most Great.', reference: 'Sahih Muslim 772', repeat: 'Often said three times' },
  rising: { id: 'rising', name: 'Rising from ruku', transliteration: 'Sami‘allāhu liman ḥamidah. Rabbanā wa lakal-ḥamd', meaning: 'Allah hears the one who praises Him. Our Lord, to You belongs all praise.', reference: 'Sahih al-Bukhari 789' },
  sujud: { id: 'sujud', name: 'Words in sujud', transliteration: 'Subḥāna rabbiyal-a‘lā', meaning: 'Glory be to my Lord, the Most High.', reference: 'Sahih Muslim 772', repeat: 'Often said three times' },
  betweenSujud: { id: 'betweenSujud', name: 'Sitting between the two sujud', meaning: 'Sit calmly. Your teacher will teach a short supplication for forgiveness said here.', reference: 'Sahih al-Bukhari 757' },
  tashahhud: { id: 'tashahhud', name: 'Tashahhud', meaning: 'Words of greeting and the testimony of faith said while sitting. Learn the exact words with your teacher.', reference: 'Sahih al-Bukhari 831' },
  salawat: { id: 'salawat', name: 'Salawat upon the Prophet ﷺ', meaning: 'Asking Allah to send blessings on the Prophet ﷺ and his family, said in the final sitting. Learn the exact words with your teacher.', reference: 'Sahih al-Bukhari 3370' },
  closingDua: { id: 'closingDua', name: 'Closing supplication', meaning: 'A short supplication before ending the prayer. Your teacher will teach one to learn.', reference: 'Sahih al-Bukhari 832' },
  taslim: { id: 'taslim', name: 'Taslim', transliteration: 'As-salāmu ‘alaykum wa raḥmatullāh', meaning: 'Peace and the mercy of Allah be upon you. Turn the head to the right, then to the left.', reference: 'Sunan Abi Dawud 996' },
};

export interface SalahStep { id: string; title: string; action: string; illustration?: LessonSection['illustration']; recitation?: Recitation; note?: string }
export interface RakahPlan { number: number; steps: SalahStep[] }

export const PREPARATION_STEPS: readonly SalahStep[] = Object.freeze([
  { id: 'wudu', title: 'Be in wudu', action: 'Make wudu before you pray. The Wudu tile shows each step.', illustration: 'hands', note: "Qur'an 5:6" },
  { id: 'clean', title: 'Clean body, clothes and place', action: 'Pray in clean clothes on a clean place. Ask your adult to help you get ready.', illustration: 'standing' },
  { id: 'intention', title: 'Intention (niyyah)', action: 'Know in your heart which prayer you are about to pray.', illustration: 'standing', note: 'Sahih al-Bukhari 1' },
  { id: 'qiblah', title: 'Face the Qiblah', action: 'Stand facing the direction of the Ka‘bah in Makkah.', illustration: 'mosque', note: "Qur'an 2:144" },
]);

function rakahSteps(prayer: Prayer, number: number): SalahStep[] {
  const steps: SalahStep[] = [];
  if (number === 1) steps.push({ id: `r${number}-takbir`, title: 'Opening takbir', action: 'Raise your hands and say the takbir to begin the prayer.', illustration: 'standing', recitation: RECITATIONS.takbir });
  steps.push({ id: `r${number}-qiyam`, title: 'Standing (qiyam)', action: number === 1 ? 'Stand calmly with your eyes looking down to the place of sujud.' : 'Stand up for the next rak‘ah, saying the takbir as you rise.', illustration: 'standing', recitation: number === 1 ? undefined : RECITATIONS.takbir });
  steps.push({ id: `r${number}-fatihah`, title: 'Recite Al-Fatihah', action: 'Recite Surah Al-Fatihah.', illustration: 'standing', recitation: RECITATIONS.fatihah });
  if (number <= 2) steps.push({ id: `r${number}-surah`, title: 'Recite more Qur’an', action: 'In the first two rak‘ahs, recite a short surah after Al-Fatihah.', illustration: 'standing', recitation: RECITATIONS.extraSurah });
  else steps.push({ id: `r${number}-only-fatihah`, title: 'Al-Fatihah only', action: 'In this rak‘ah you recite Al-Fatihah. Your teacher will explain any extra recitation your family follows.', illustration: 'standing' });
  steps.push({ id: `r${number}-ruku`, title: 'Ruku (bowing)', action: 'Say the takbir and bow, hands on knees, back straight. Stay still for a moment.', illustration: 'bowing', recitation: RECITATIONS.ruku });
  steps.push({ id: `r${number}-rise`, title: 'Rise from ruku', action: 'Stand up straight again and be still.', illustration: 'standing', recitation: RECITATIONS.rising });
  steps.push({ id: `r${number}-sujud1`, title: 'First sujud', action: 'Say the takbir and go down into sujud: forehead and nose, both hands, knees and toes on the ground.', illustration: 'prostration', recitation: RECITATIONS.sujud });
  steps.push({ id: `r${number}-sit`, title: 'Sit between the two sujud', action: 'Say the takbir and sit up calmly.', illustration: 'sitting', recitation: RECITATIONS.betweenSujud });
  steps.push({ id: `r${number}-sujud2`, title: 'Second sujud', action: 'Say the takbir and make a second sujud, just like the first.', illustration: 'prostration', recitation: RECITATIONS.sujud });
  const last = number === prayer.rakahs;
  if (number === 2 && !last) steps.push({ id: `r${number}-first-tashahhud`, title: 'First tashahhud', action: `Sit and recite the tashahhud. Then stand up for rak‘ah 3 of ${prayer.rakahs}.`, illustration: 'sitting', recitation: RECITATIONS.tashahhud });
  if (last) {
    steps.push({ id: `r${number}-final-tashahhud`, title: 'Final tashahhud', action: 'Sit and recite the tashahhud.', illustration: 'sitting', recitation: RECITATIONS.tashahhud });
    steps.push({ id: `r${number}-salawat`, title: 'Salawat upon the Prophet ﷺ', action: 'Continue sitting and send blessings on the Prophet ﷺ.', illustration: 'sitting', recitation: RECITATIONS.salawat });
    steps.push({ id: `r${number}-dua`, title: 'Closing supplication', action: 'Make a short supplication.', illustration: 'sitting', recitation: RECITATIONS.closingDua });
    steps.push({ id: `r${number}-taslim`, title: 'Taslim to finish', action: 'Turn your head to the right, then to the left, saying the taslim each time. Your prayer is complete.', illustration: 'sitting', recitation: RECITATIONS.taslim });
  }
  return steps;
}
/** Rak‘ah-by-rak‘ah plan for one obligatory prayer. */
export function rakahPlan(prayer: Prayer): RakahPlan[] {
  return Array.from({ length: prayer.rakahs }, (_, index) => ({ number: index + 1, steps: rakahSteps(prayer, index + 1) }));
}
/** What changes between rak‘ahs, in words a child can follow. */
export function rakahDifferences(prayer: Prayer): string[] {
  const notes = ['Rak‘ah 1 starts with the opening takbir. Every rak‘ah has Al-Fatihah, one ruku and two sujud.', 'Rak‘ahs 1 and 2: Al-Fatihah and then a short surah.'];
  if (prayer.rakahs === 2) notes.push('After rak‘ah 2 you sit for the final tashahhud, salawat and taslim.');
  else notes.push('After rak‘ah 2 you sit for the first tashahhud, then stand up.', `Rak‘ah${prayer.rakahs === 4 ? 's 3 and 4' : ' 3'}: Al-Fatihah only.`, `After rak‘ah ${prayer.rakahs} you sit for the final tashahhud, salawat and taslim.`);
  return notes;
}
/** Topics on which recognised schools differ. Details are taught by the family's chosen teacher; no ruling is stated here. */
export const SCHOOL_DIFFERENCES: readonly string[] = Object.freeze([
  'Where the hands are placed while standing',
  'When the hands are raised during the prayer',
  'Whether some words are said aloud or quietly, and in which prayers',
  'How to sit in the tashahhud',
  'Which opening and closing supplications are taught',
]);
export const SALAH_REFERENCE_NOTE = 'References are listed so your reviewer can check them against the source before publishing.';

/** Wudu steps follow the order in Qur'an 5:6 and the description in Sahih al-Bukhari 159. */
export interface WuduStep { id: string; title: string; action: string; count?: string; illustration?: LessonSection['illustration']; reference?: string }
export const WUDU_STEPS: readonly WuduStep[] = Object.freeze([
  { id: 'intention', title: '1. Intention', action: 'Know in your heart that you are making wudu for Allah.', reference: 'Sahih al-Bukhari 1' },
  { id: 'bismillah', title: '2. Say Bismillah', action: 'Begin with “Bismillah” (in the name of Allah). Scholars agree it is good to say; some hold it is required.', reference: 'Sunan Abi Dawud 101 (its grading is discussed by scholars)' },
  { id: 'hands', title: '3. Wash your hands', action: 'Wash both hands up to the wrists.', count: '3 times', illustration: 'hands', reference: 'Sahih al-Bukhari 159' },
  { id: 'mouth', title: '4. Rinse your mouth', action: 'Take water into your mouth, swirl it and spit it out.', count: '3 times', illustration: 'mouth', reference: 'Sahih al-Bukhari 159' },
  { id: 'nose', title: '5. Clean your nose', action: 'Sniff a little water gently into the nose and blow it out.', count: '3 times', illustration: 'mouth', reference: 'Sahih al-Bukhari 159' },
  { id: 'face', title: '6. Wash your face', action: 'Wash the whole face, from the hairline to the chin and from ear to ear.', count: '3 times', illustration: 'face', reference: "Qur'an 5:6; Sahih al-Bukhari 159" },
  { id: 'arms', title: '7. Wash your arms', action: 'Wash the right arm from fingertips through the elbow, then the left arm.', count: '3 times each', illustration: 'arms', reference: "Qur'an 5:6; Sahih al-Bukhari 159" },
  { id: 'head', title: '8. Wipe your head and ears', action: 'Pass wet hands over the head, then wipe the ears.', count: 'Once', illustration: 'head', reference: "Qur'an 5:6; Sahih al-Bukhari 159" },
  { id: 'feet', title: '9. Wash your feet', action: 'Wash the right foot through the ankle, then the left. Make sure water reaches the heels and between the toes.', count: '3 times each', illustration: 'feet', reference: "Qur'an 5:6; Sahih al-Bukhari 159" },
  { id: 'complete', title: '10. Wudu is complete', action: 'You are ready to pray. A well-known remembrance after wudu is the testimony of faith; learn its words with your teacher.', reference: 'Sahih Muslim 234' },
]);
export const WUDU_TOPICS: readonly { title: string; points: string[]; reference?: string }[] = Object.freeze([
  { title: 'How many times?', points: ['Each washing may be done once, twice or three times. The Prophet ﷺ did each.', 'Wiping the head is done once.'], reference: 'Sahih al-Bukhari 157, 158, 159' },
  { title: 'What breaks wudu', points: ['Using the toilet.', 'Passing wind.', 'Deep sleep. Scholars differ on some other situations; ask your teacher.'], reference: "Qur'an 5:6; Sahih al-Bukhari 135" },
  { title: 'Common mistakes', points: ['Missing the elbows, the ankles or the heels.', 'Changing the order of the steps.', 'Rushing so that some parts stay dry.'], reference: 'Sahih al-Bukhari 163' },
  { title: 'Save water', points: ['Use a small amount of water and turn the tap off while you wash.', 'The Prophet ﷺ made wudu with a small amount of water.'], reference: 'Sahih al-Bukhari 201' },
  { title: 'What is ghusl?', points: ['Ghusl is washing the whole body. Your parents will teach you when it is needed as you grow up.', 'For everyday prayers, wudu is what you need.'], reference: "Qur'an 5:6" },
]);

/** Text form of each guide, used by the parent review workflow so the exact version is attested. */
export function salahReviewSections(): LessonSection[] {
  const words = Object.values(RECITATIONS).map(item => ({ title: item.name, body: `${item.transliteration ? `${item.transliteration} — ` : ''}${item.meaning}${item.repeat ? ` (${item.repeat})` : ''}`, kind: 'source_fact' as const, sourceReference: item.reference }));
  const prayers = PRAYERS.map(prayer => ({ title: `${prayer.name}: ${prayer.rakahs} rak‘ahs`, body: rakahDifferences(prayer).join(' '), kind: 'source_fact' as const, sourceReference: 'Sahih al-Bukhari 757' }));
  return [...PREPARATION_STEPS.map(step => ({ title: step.title, body: step.action, kind: 'source_fact' as const, sourceReference: step.note ?? 'Sahih al-Bukhari 757', illustration: step.illustration })), ...prayers, ...words,
    { title: 'Differences between schools', body: SCHOOL_DIFFERENCES.join('; '), kind: 'explanation' as const }];
}
export function wuduReviewSections(): LessonSection[] {
  return [...WUDU_STEPS.map(step => ({ title: step.title, body: `${step.action}${step.count ? ` (${step.count})` : ''}`, kind: 'source_fact' as const, sourceReference: step.reference ?? 'Sahih al-Bukhari 159', illustration: step.illustration })),
    ...WUDU_TOPICS.map(topic => ({ title: topic.title, body: topic.points.join(' '), kind: 'source_fact' as const, sourceReference: topic.reference ?? 'Sahih al-Bukhari 159' }))];
}
