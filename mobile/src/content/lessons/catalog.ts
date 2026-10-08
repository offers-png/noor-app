import type { EducationLesson, LessonSection } from '../../types/lessons';
import type { QuizQuestion } from '../../types/quiz';
import { hadithFixtures } from '../fixtures/hadith';
import { duaFixtures } from './duas';
import { quranReference, reviewDraft, sunnahSource } from './sources';

const question = (id: string, prompt: string, correct: string, alternatives: string[], sourceReference: string): QuizQuestion => ({
  id, type: 'multiple-choice', prompt,
  options: [alternatives[0], correct, ...alternatives.slice(1)].map((label, index) => ({ id: String(index), label })),
  correctOptionId: '1', explanation: correct, sourceReference,
});
const hadithDetails = [
  { title: 'Good intentions', topic: 'Intentions', explanation: 'An intention is why we choose to do something. Before helping, pause and think about your purpose.',
    lessons: ['Think about why you help.', 'Choose a good purpose before you act.', 'Practice kindness even when nobody praises you.'],
    example: 'Practice example: you tidy a shared table so everyone can use it.', discussion: 'What is a good reason to help someone?',
    questions: [question('intention-1', 'What is an intention?', 'The reason for an action', ['A toy', 'A color'], 'Sahih al-Bukhari 1'),
      question('intention-2', 'Before you help, what can you think about?', 'Why I am helping', ['How many prizes I get', 'How to avoid all work'], 'Sahih al-Bukhari 1'),
      question('intention-3', 'Which is a thoughtful reason to tidy a shared table?', 'So everyone can use it', ['To hide someone’s books', 'To make a mess'], 'Sahih al-Bukhari 1')] },
  { title: 'Choose kind words', topic: 'Kindness', explanation: 'Words can help people. We can pause before speaking and choose words that are helpful and kind.',
    lessons: ['Speak with care.', 'Pause when a word might hurt someone.', 'Use helpful words.'],
    example: 'Practice example: a friend makes a mistake. You offer calm help.', discussion: 'What could you say to encourage a friend?',
    questions: [question('words-1', 'Which words help a friend?', 'Let’s try together', ['You are terrible', 'Go away'], 'Sahih al-Bukhari 6018'),
      question('words-2', 'What can you do before saying something hurtful?', 'Pause and choose kind words', ['Shout louder', 'Repeat it many times'], 'Sahih al-Bukhari 6018'),
      question('words-3', 'Which action matches this lesson?', 'Offering calm help', ['Making fun of a mistake', 'Calling someone names'], 'Sahih al-Bukhari 6018')] },
  { title: 'Wish good for others', topic: 'Manners', explanation: 'Think about the good things you wish for yourself. Practice wishing good for others too.',
    lessons: ['Notice what makes others happy.', 'Practice fairness when sharing.', 'Wish good for someone else.'],
    example: 'Practice example: you share space at the table so another child can join.', discussion: 'How could you help someone feel included today?',
    questions: [question('others-1', 'What can we wish for others?', 'Good things', ['Only problems', 'Nothing kind'], 'Sahih al-Bukhari 13'),
      question('others-2', 'Which choice includes someone?', 'Making room at the table', ['Hiding their chair', 'Ignoring them'], 'Sahih al-Bukhari 13'),
      question('others-3', 'What can you practice while sharing?', 'Fairness', ['Taking everything', 'Making someone sad'], 'Sahih al-Bukhari 13')] },
];
export const hadithLessons: EducationLesson[] = hadithFixtures.map((record, index) => {
  const detail = hadithDetails[index];
  return { id: `hadith-${record.hadithNumber}`, category: 'hadith', title: detail.title, subtitle: 'Read • Reflect • Practice', topic: detail.topic,
    source: record.source, hadithId: record.id, review: reviewDraft(),
    sections: [{ title: 'What can we learn?', body: detail.explanation, kind: 'explanation' },
      ...detail.lessons.map((body, i) => ({ title: `Learning idea ${i + 1}`, body, kind: 'explanation' as const })),
      { title: 'Real-life example', body: detail.example, kind: 'activity' }], discussion: detail.discussion, quiz: detail.questions };
});

const pillarsSource = sunnahSource('Sahih al-Bukhari 8', 'bukhari:8');
const wuduSource = sunnahSource('Sahih al-Bukhari 159', 'bukhari:159');
const salahSource = sunnahSource('Sahih Muslim 498; Sahih al-Bukhari 757', 'muslim:498');
const prayerTimesSource = sunnahSource('Sahih Muslim 612a', 'muslim:612a');
const postureSource = sunnahSource('Sahih al-Bukhari 757', 'bukhari:757');
const qiblahSource = quranReference("Qur'an 2:144", '2/144');

const wuduSteps: LessonSection[] = [
  { title: 'Wash hands', body: 'Wash both hands. This narration describes washing them three times.', kind: 'source_fact', illustration: 'hands' },
  { title: 'Rinse mouth and nose', body: 'Rinse the mouth, then clean the nose gently with water. Ask an adult to show you.', kind: 'source_fact', illustration: 'mouth' },
  { title: 'Wash face', body: 'Wash the face. The narration describes three washes.', kind: 'source_fact', illustration: 'face' },
  { title: 'Wash arms', body: 'Wash hands and forearms up to the elbows. The narration describes three washes.', kind: 'source_fact', illustration: 'arms' },
  { title: 'Wipe head', body: 'Pass wet hands over the head.', kind: 'source_fact', illustration: 'head' },
  { title: 'Wash feet', body: 'Wash feet up to the ankles. The narration describes three washes.', kind: 'source_fact', illustration: 'feet' },
].map(section => ({ ...section, sourceReference: wuduSource.sourceReference } as LessonSection));

export const islamLessons: EducationLesson[] = [
  { id: 'islam-five-pillars', category: 'islam', title: 'Meet the Five Pillars', subtitle: 'Five important parts of Muslim life', topic: 'Five Pillars', source: pillarsSource, review: reviewDraft(),
    sections: [
      { title: 'Shahadah', body: 'The testimony of faith: worship Allah and recognize Muhammad ﷺ as His messenger.', kind: 'source_fact' },
      { title: 'Salah', body: 'The daily prayers.', kind: 'source_fact' },
      { title: 'Zakah', body: 'The required giving of charity.', kind: 'source_fact' },
      { title: 'Sawm', body: 'Fasting in Ramadan.', kind: 'source_fact' },
      { title: 'Hajj', body: 'Pilgrimage to Makkah.', kind: 'source_fact' },
      { title: 'Learn with your family', body: 'Ask your parent or teacher how your family learns about these pillars. Details of duties need qualified teaching.', kind: 'activity' },
    ], discussion: 'Which pillar have you learned about with your family?', quiz: [
      question('pillars-1', 'How many pillars are in this introduction?', 'Five', ['Two', 'Ten'], pillarsSource.sourceReference),
      question('pillars-2', 'Which pillar names daily prayers?', 'Salah', ['Hajj', 'Zakah'], pillarsSource.sourceReference)] },
  { id: 'islam-wudu', category: 'islam', title: 'Learn Wudu', subtitle: 'A visual practice guide with your adult', topic: 'Wudu', source: wuduSource, review: reviewDraft(), stepByStep: true,
    sections: wuduSteps, discussion: 'Practice with a parent or qualified teacher. This guide follows one narration; it is not a ruling on every detail.', quiz: [
      { id: 'wudu-order', type: 'order', prompt: 'Put these stages of the guide in order.', items: [{ id: 'hands', label: 'Hands' }, { id: 'head', label: 'Head' }, { id: 'feet', label: 'Feet' }], correctOrder: ['hands', 'head', 'feet'], explanation: 'In this guide, hands come before the head and feet.', sourceReference: wuduSource.sourceReference }] },
  { id: 'islam-salah', category: 'islam', title: 'Meet Salah', subtitle: 'Prayer names • Preparation • Calm movements', topic: 'Salah', source: salahSource, review: reviewDraft(), stepByStep: true,
    sections: [
      { title: 'Five daily prayers', body: 'Fajr, Dhuhr (Zuhr), Asr, Maghrib, and Isha are the five daily prayers. Each has its own time.', kind: 'source_fact', sourceReference: prayerTimesSource.sourceReference, illustration: 'mosque' },
      { title: 'Prepare with your adult', body: 'Learn wudu with your parent or teacher. Ask them about clean clothing and your family’s prayer space.', kind: 'activity', illustration: 'hands' },
      { title: 'Qiblah', body: 'Qiblah is the direction faced for prayer, toward the Sacred Mosque in Makkah. Ask an adult to help find it.', kind: 'source_fact', sourceReference: qiblahSource.sourceReference, illustration: 'mosque' },
      { title: 'Begin and stand', body: 'Prayer begins with takbir. Recitation takes place while standing. Learn the words with a qualified teacher.', kind: 'source_fact', sourceReference: postureSource.sourceReference, illustration: 'standing' },
      { title: 'Ruku', body: 'Ruku is bowing. Move calmly and learn the position with your teacher.', kind: 'source_fact', sourceReference: postureSource.sourceReference, illustration: 'bowing' },
      { title: 'Stand again', body: 'Return to an upright standing position after bowing.', kind: 'source_fact', sourceReference: postureSource.sourceReference, illustration: 'standing' },
      { title: 'Sujud', body: 'Sujud is prostration. Take your time and ask your teacher to demonstrate.', kind: 'source_fact', sourceReference: postureSource.sourceReference, illustration: 'prostration' },
      { title: 'Sit calmly', body: 'There is a sitting position between prostrations. Learn calmly with your teacher.', kind: 'source_fact', sourceReference: postureSource.sourceReference, illustration: 'sitting' },
      { title: 'Tasleem', body: 'Prayer ends with tasleem, a greeting of peace. Ask your teacher to teach the words and movements.', kind: 'source_fact', sourceReference: 'Sahih Muslim 498', illustration: 'sitting' },
    ], discussion: 'This learning guide helps you recognize parts of prayer. Your teacher can explain the full sequence and supplications.', quiz: [
      question('salah-1', 'What is ruku?', 'Bowing', ['Running', 'Eating'], postureSource.sourceReference)] },
  { id: 'islam-story-nuh', category: 'islam', title: 'Prophet Nuh: the Ark', subtitle: 'A source-based story lesson', topic: 'Prophets', source: quranReference("Qur'an 11:42–44", '11/42'), review: reviewDraft(),
    sections: [{ title: 'Source-based fact • original summary', body: 'The Ark carried Nuh and those with him through powerful waves.', kind: 'source_fact', sourceReference: "Qur'an 11:42", illustration: 'boat' },
      { title: 'Educational reflection', body: 'We can reflect on seeking Allah’s help. Read the passage with a parent or qualified teacher to learn the full story.', kind: 'explanation' },
      { title: 'Together activity', body: 'Draw a boat and write the passage reference next to it. The drawing is your learning activity, not a picture of the Prophet.', kind: 'activity' }],
    discussion: 'What can help you stay calm when something feels difficult?', quiz: [] },
  { id: 'islam-story-yunus', category: 'islam', title: 'Prophet Yunus: asking Allah', subtitle: 'A source-based story lesson', topic: 'Prophets', source: quranReference("Qur'an 21:87–88", '21/87'), review: reviewDraft(),
    sections: [{ title: 'Source-based fact • original summary', body: 'Yunus called to Allah in distress. The next verse tells of Allah answering and rescuing him.', kind: 'source_fact', sourceReference: "Qur'an 21:87–88", illustration: 'ocean' },
      { title: 'Educational reflection', body: 'We can ask Allah for help and forgiveness. Learn the passage with an adult.', kind: 'explanation' },
      { title: 'Together activity', body: 'Tell your parent one way you can ask for help when you make a mistake.', kind: 'activity' }],
    discussion: 'Who can you ask for help when you feel worried?', quiz: [] },
  { id: 'islam-prayer-times', category: 'islam', title: 'Five prayers through the day', subtitle: 'From dawn to night', topic: 'Salah', source: prayerTimesSource, review: reviewDraft(), stepByStep: true,
    sections: [
      { title: 'Fajr', body: 'Fajr is prayed at dawn, after the first light of morning and before the sun rises.', kind: 'source_fact', sourceReference: prayerTimesSource.sourceReference, illustration: 'mosque' },
      { title: 'Dhuhr', body: 'Dhuhr is prayed after midday, once the sun has passed its highest point.', kind: 'source_fact', sourceReference: prayerTimesSource.sourceReference, illustration: 'mosque' },
      { title: 'Asr', body: 'Asr is prayed in the afternoon.', kind: 'source_fact', sourceReference: prayerTimesSource.sourceReference, illustration: 'mosque' },
      { title: 'Maghrib', body: 'Maghrib is prayed just after the sun sets.', kind: 'source_fact', sourceReference: prayerTimesSource.sourceReference, illustration: 'mosque' },
      { title: 'Isha', body: 'Isha is prayed at night, after the evening twilight has gone.', kind: 'source_fact', sourceReference: prayerTimesSource.sourceReference, illustration: 'mosque' },
      { title: 'Make a prayer chart', body: 'With your adult, find today’s prayer times for your town from your local masjid. Draw the sun moving across the sky and mark each prayer on it.', kind: 'activity' },
    ], discussion: 'Which prayer is closest to when you wake up? Which is closest to bedtime?', quiz: [
      { id: 'prayer-times-order', type: 'order', prompt: 'Put the five prayers in order, starting at dawn.', items: [{ id: 'fajr', label: 'Fajr' }, { id: 'dhuhr', label: 'Dhuhr' }, { id: 'asr', label: 'Asr' }, { id: 'maghrib', label: 'Maghrib' }, { id: 'isha', label: 'Isha' }], correctOrder: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], explanation: 'Fajr, Dhuhr, Asr, Maghrib, then Isha.', sourceReference: prayerTimesSource.sourceReference },
      question('prayer-times-maghrib', 'Which prayer comes just after sunset?', 'Maghrib', ['Fajr', 'Dhuhr'], prayerTimesSource.sourceReference)] },
  { id: 'islam-prayer-ready', category: 'islam', title: 'Getting ready to pray', subtitle: 'Wudu • Qiblah • A calm start', topic: 'Salah', source: quranReference("Qur'an 5:6", '5/6'), review: reviewDraft(), stepByStep: true,
    sections: [
      { title: 'Wudu first', body: 'Allah tells the believers to wash for prayer. This washing is called wudu.', kind: 'source_fact', sourceReference: "Qur'an 5:6", illustration: 'hands' },
      { title: 'Face the Qiblah', body: 'Muslims face the Sacred Mosque in Makkah when they pray. This direction is called the Qiblah.', kind: 'source_fact', sourceReference: qiblahSource.sourceReference, illustration: 'mosque' },
      { title: 'Pray calmly', body: 'The Prophet ﷺ taught a man to pray calmly and not rush, staying still in each position.', kind: 'source_fact', sourceReference: postureSource.sourceReference, illustration: 'standing' },
      { title: 'Get ready together', body: 'Ask your adult to show you your family’s prayer space and how you get your clothes and place ready.', kind: 'activity', illustration: 'standing' },
    ], discussion: 'What helps you feel calm before you start to pray?', quiz: [
      question('prayer-ready-wudu', 'What washing do we do before prayer?', 'Wudu', ['Bathing the dog', 'Washing the car'], "Qur'an 5:6"),
      question('prayer-ready-qiblah', 'What is the Qiblah?', 'The direction of the Sacred Mosque in Makkah', ['A kind of food', 'A prayer time'], qiblahSource.sourceReference)] },
  { id: 'islam-six-beliefs', category: 'islam', title: 'Six things we believe in', subtitle: 'The pillars of faith (iman)', topic: 'Allah', source: sunnahSource('Sahih Muslim 8', 'muslim:8'), review: reviewDraft(),
    sections: [
      { title: 'What is iman?', body: 'In a famous hadith, the angel Jibril asked the Prophet ﷺ about iman (faith). The answer named six things to believe in.', kind: 'source_fact', sourceReference: 'Sahih Muslim 8' },
      { title: 'The six', body: 'Believe in Allah, His angels, His books, His messengers, the Last Day, and in Allah’s decree (qadar), the good and the bad.', kind: 'source_fact', sourceReference: 'Sahih Muslim 8' },
      { title: 'Learn one at a time', body: 'Choose one of the six with your adult this week and learn something about it together, such as the books Allah sent.', kind: 'activity' },
    ], discussion: 'Which of the six would you like to learn more about first?', quiz: [
      question('iman-count', 'How many pillars of faith are named in this hadith?', 'Six', ['Two', 'Ten'], 'Sahih Muslim 8'),
      question('iman-angels', 'Which of these is one of the six?', 'Belief in Allah’s angels', ['Belief in lucky charms', 'Belief in fortune tellers'], 'Sahih Muslim 8')] },
  { id: 'islam-salam', category: 'islam', title: 'Greeting with Salam', subtitle: 'Spreading peace with our words', topic: 'Islamic Manners', source: quranReference("Qur'an 4:86", '4/86'), review: reviewDraft(),
    sections: [
      { title: 'The greeting', body: 'Muslims greet each other with “As-salamu alaykum”, which means “peace be upon you”.', kind: 'explanation' },
      { title: 'The reply', body: 'The reply is “Wa alaykum as-salam”, which means “and upon you be peace”.', kind: 'explanation' },
      { title: 'Reply in a good way', body: 'Allah tells us that when we are greeted, we should reply with a better greeting or at least the same.', kind: 'source_fact', sourceReference: "Qur'an 4:86" },
      { title: 'Try it today', body: 'Greet each person in your family with salam today, and reply when they greet you.', kind: 'activity' },
    ], discussion: 'How do you feel when someone greets you kindly?', quiz: [
      question('salam-reply', 'Someone says “As-salamu alaykum”. What can you reply?', 'Wa alaykum as-salam', ['Go away', 'Nothing at all'], "Qur'an 4:86")] },
  { id: 'islam-parents', category: 'islam', title: 'Kindness to parents', subtitle: 'Gentle words and helpful hands', topic: 'Parents', source: quranReference("Qur'an 17:23–24", '17/23'), review: reviewDraft(),
    sections: [
      { title: 'A command from Allah', body: 'Allah commands us to be good to our parents.', kind: 'source_fact', sourceReference: "Qur'an 17:23" },
      { title: 'Gentle words', body: 'We speak to our parents with respect, and do not even say “uff” to show we are annoyed.', kind: 'source_fact', sourceReference: "Qur'an 17:23" },
      { title: 'Pray for them', body: 'The next ayah teaches us to ask Allah to have mercy on our parents, as they cared for us when we were small. You can learn this dua in Duas.', kind: 'source_fact', sourceReference: "Qur'an 17:24" },
      { title: 'Helping hands', body: 'Choose one helpful thing to do at home today without being asked.', kind: 'activity' },
    ], discussion: 'What is one kind thing your parents do for you? How can you thank them?', quiz: [
      question('parents-words', 'How should we speak to our parents?', 'Gently and with respect', ['Rudely', 'By shouting'], "Qur'an 17:23")] },
];

export const duaLessons: EducationLesson[] = duaFixtures.map(dua => ({ id: dua.id, category: 'duas', title: dua.title,
  subtitle: `${dua.category} • Read and memorize`, topic: dua.category, source: dua.source, review: dua.review, duaId: dua.id,
  sections: [{ title: 'Learn together', body: 'Read the Arabic with a parent or teacher. Transliteration is a reading aid and does not replace learning pronunciation.', kind: 'activity' },
    ...(dua.verseKey ? [{ title: 'Find it in the Qur’an', body: `This supplication is in the Qur’an at ${dua.verseKey}. Read the whole ayah and a published translation together in the Qur’an reader.`, kind: 'activity' as const, sourceReference: `Qur'an ${dua.verseKey}` }] : [])],
  discussion: 'Choose one short phrase to practice together today.', quiz: [] }));

export const allLessons: EducationLesson[] = [...hadithLessons, ...islamLessons, ...duaLessons]
  .map(lesson => ({ ...lesson, ageRange: { min: 5, max: 15 } }));
export const lessonSourceRegistry = [...new Map([
  ...allLessons.map(lesson => lesson.source), prayerTimesSource, qiblahSource, postureSource,
].map(source => [source.sourceReference, source])).values()];

/** New stories have a source-fact/explanation split and require an approved production pack. */
export const prophetCatalog = ['Adam', 'Nuh', 'Ibrahim', 'Ismail', 'Ishaq', 'Yaqub', 'Yusuf', 'Musa', 'Harun', 'Dawud', 'Sulayman', 'Yunus', 'Zakariya', 'Yahya', 'Isa', 'Muhammad ﷺ'] as const;
export const islamTopics = ['Five Pillars', 'Wudu', 'Salah', 'Allah', 'Prophet Muhammad ﷺ', 'Prophets', 'Sahabah', 'Angels', 'Islamic Manners', 'Parents', 'Neighbors', 'Charity', 'Honesty', 'Kindness', 'Masjid', 'Ramadan', 'Eid', 'Hajj', 'Islamic History'] as const;
export const duaCategories = ['Morning', 'Evening', 'Before Eating', 'After Eating', 'Before Sleeping', 'Waking Up', 'Entering Home', 'Leaving Home', 'Entering Masjid', 'Leaving Masjid', 'Travel', 'Parents', 'Knowledge'] as const;
