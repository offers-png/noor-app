import type { QuizQuestion } from '../../types/quiz';

export interface ArabicLetter {
  id: string;
  arabic: string;
  name: string;
  spokenName: string;
  forms: [string, string, string, string];
  joinsNext: boolean;
  hint: string;
  tracePaths?: string[];
}
const bowl = 'M 249 137 C 255 195 235 211 161 211 C 98 211 72 196 77 150';
const dot = (x: number, y: number) => `M ${x - 5} ${y} L ${x + 5} ${y}`;
const records: [string, string, string, string, string, string, string, boolean][] = [
  ['alif', 'ا', 'Alif', 'ألف', 'ا', 'ـا', 'ـا', false],
  ['ba', 'ب', 'Ba', 'باء', 'بـ', 'ـبـ', 'ـب', true],
  ['ta', 'ت', 'Ta', 'تاء', 'تـ', 'ـتـ', 'ـت', true],
  ['tha', 'ث', 'Tha', 'ثاء', 'ثـ', 'ـثـ', 'ـث', true],
  ['jim', 'ج', 'Jim', 'جيم', 'جـ', 'ـجـ', 'ـج', true],
  ['ha-throat', 'ح', 'Ha (throat)', 'حاء', 'حـ', 'ـحـ', 'ـح', true],
  ['kha', 'خ', 'Kha', 'خاء', 'خـ', 'ـخـ', 'ـخ', true],
  ['dal', 'د', 'Dal', 'دال', 'د', 'ـد', 'ـد', false],
  ['dhal', 'ذ', 'Dhal', 'ذال', 'ذ', 'ـذ', 'ـذ', false],
  ['ra', 'ر', 'Ra', 'راء', 'ر', 'ـر', 'ـر', false],
  ['zay', 'ز', 'Zay', 'زاي', 'ز', 'ـز', 'ـز', false],
  ['sin', 'س', 'Sin', 'سين', 'سـ', 'ـسـ', 'ـس', true],
  ['shin', 'ش', 'Shin', 'شين', 'شـ', 'ـشـ', 'ـش', true],
  ['sad', 'ص', 'Sad', 'صاد', 'صـ', 'ـصـ', 'ـص', true],
  ['dad', 'ض', 'Dad', 'ضاد', 'ضـ', 'ـضـ', 'ـض', true],
  ['ta-heavy', 'ط', 'Ta (heavy)', 'طاء', 'طـ', 'ـطـ', 'ـط', true],
  ['dha-heavy', 'ظ', 'Dha (heavy)', 'ظاء', 'ظـ', 'ـظـ', 'ـظ', true],
  ['ayn', 'ع', 'Ayn', 'عين', 'عـ', 'ـعـ', 'ـع', true],
  ['ghayn', 'غ', 'Ghayn', 'غين', 'غـ', 'ـغـ', 'ـغ', true],
  ['fa', 'ف', 'Fa', 'فاء', 'فـ', 'ـفـ', 'ـف', true],
  ['qaf', 'ق', 'Qaf', 'قاف', 'قـ', 'ـقـ', 'ـق', true],
  ['kaf', 'ك', 'Kaf', 'كاف', 'كـ', 'ـكـ', 'ـك', true],
  ['lam', 'ل', 'Lam', 'لام', 'لـ', 'ـلـ', 'ـل', true],
  ['mim', 'م', 'Mim', 'ميم', 'مـ', 'ـمـ', 'ـم', true],
  ['nun', 'ن', 'Nun', 'نون', 'نـ', 'ـنـ', 'ـن', true],
  ['ha', 'ه', 'Ha', 'هاء', 'هـ', 'ـهـ', 'ـه', true],
  ['waw', 'و', 'Waw', 'واو', 'و', 'ـو', 'ـو', false],
  ['ya', 'ي', 'Ya', 'ياء', 'يـ', 'ـيـ', 'ـي', true],
];
const lessonHints: Record<string, string> = {
  alif: 'Alif has a tall upright shape. Start at the top and move down gently.',
  ba: 'Ba has one dot below its bowl. Draw the bowl from right to left, then add the dot below.',
  ta: 'Ta has two dots above its bowl. Draw the bowl from right to left, then add the two dots.',
  tha: 'Tha has three dots above its bowl. Draw the bowl, then add the three dots above.',
  jim: 'Jim has a curved body and one dot inside the lower curve. Follow the curve, then add the dot.',
};
const tracePaths: Record<string, string[]> = {
  alif: ['M 164 62 L 164 218'],
  ba: [bowl, dot(161, 239)],
  ta: [bowl, dot(148, 107), dot(176, 107)],
  tha: [bowl, dot(148, 107), dot(176, 107), dot(162, 84)],
  jim: ['M 94 94 Q 145 83 215 133 Q 168 133 117 149 C 48 185 75 244 160 242 Q 205 243 240 222', dot(151, 194)],
};

export const arabicAlphabet: ArabicLetter[] = records.map(([id, arabic, name, spokenName, beginning, middle, end, joinsNext]) => ({
  id, arabic, name, spokenName, forms: [arabic, beginning, middle, end], joinsNext,
  hint: lessonHints[id] ?? `Notice the shape of ${name}. Compare it with its forms in a word and trace the dotted guide.`,
  tracePaths: tracePaths[id],
}));
export const starterLessons = arabicAlphabet.slice(0, 5);

export const arabicModules = [
  { id: 'alphabet', title: 'Arabic Alphabet', description: '28 letters · look, listen and trace' },
  { id: 'sounds', title: 'Letter Sounds', description: 'Listen to letter names and repeat' },
  { id: 'forms', title: 'Beginning · Middle · End', description: 'See how letters change in a word' },
  { id: 'harakat', title: 'Harakat', description: 'Short vowels and other reading marks' },
  { id: 'joining', title: 'Joining Letters', description: 'Learn which letters connect' },
  { id: 'words', title: 'Simple Words', description: 'Read short Arabic words' },
  { id: 'reading', title: 'Reading Practice', description: 'Try reading with the vowel marks' },
  { id: 'numbers', title: 'Numbers 1–10', description: 'Arabic digits and number words' },
] as const;

export const harakat = [
  { id: 'fatha', name: 'Fatha', arabic: 'بَ', explanation: 'The little stroke above gives a short “a” sound: ba.', spoken: 'بَ' },
  { id: 'kasra', name: 'Kasra', arabic: 'بِ', explanation: 'The little stroke below gives a short “i” sound: bi.', spoken: 'بِ' },
  { id: 'damma', name: 'Damma', arabic: 'بُ', explanation: 'The small curl above gives a short “u” sound: bu.', spoken: 'بُ' },
  { id: 'sukoon', name: 'Sukoon', arabic: 'بْ', explanation: 'The small circle means there is no short vowel after this consonant.', spoken: 'سكون' },
  { id: 'shadda', name: 'Shadda', arabic: 'بَّ', explanation: 'Shadda tells you to hold or double the consonant. This example also has fatha.', spoken: 'شدة' },
  { id: 'tanween', name: 'Tanween', arabic: 'بًا بٍ بٌ', explanation: 'Doubled vowel marks add an “n” ending: an, in, or un.', spoken: 'تنوين' },
];
export const simpleWords = [
  { arabic: 'بَاب', name: 'baab', meaning: 'door', letters: 'Ba + Alif + Ba' },
  { arabic: 'بَيْت', name: 'bayt', meaning: 'house', letters: 'Ba + Ya + Ta' },
  { arabic: 'كِتَاب', name: 'kitaab', meaning: 'book', letters: 'Kaf + Ta + Alif + Ba' },
  { arabic: 'قَلَم', name: 'qalam', meaning: 'pen', letters: 'Qaf + Lam + Mim' },
  { arabic: 'شَمْس', name: 'shams', meaning: 'sun', letters: 'Shin + Mim + Sin' },
  { arabic: 'قَمَر', name: 'qamar', meaning: 'moon', letters: 'Qaf + Mim + Ra' },
  { arabic: 'وَلَد', name: 'walad', meaning: 'boy', letters: 'Waw + Lam + Dal' },
  { arabic: 'بِنْت', name: 'bint', meaning: 'girl', letters: 'Ba + Nun + Ta' },
];
/** Arabic-Indic digits with the counting word (masculine form used when counting aloud). */
export const arabicNumbers = [
  { value: 1, digit: '١', word: 'وَاحِد', name: 'waahid' },
  { value: 2, digit: '٢', word: 'اِثْنَان', name: 'ithnaan' },
  { value: 3, digit: '٣', word: 'ثَلَاثَة', name: 'thalaatha' },
  { value: 4, digit: '٤', word: 'أَرْبَعَة', name: 'arba‘a' },
  { value: 5, digit: '٥', word: 'خَمْسَة', name: 'khamsa' },
  { value: 6, digit: '٦', word: 'سِتَّة', name: 'sitta' },
  { value: 7, digit: '٧', word: 'سَبْعَة', name: 'sab‘a' },
  { value: 8, digit: '٨', word: 'ثَمَانِيَة', name: 'thamaaniya' },
  { value: 9, digit: '٩', word: 'تِسْعَة', name: 'tis‘a' },
  { value: 10, digit: '١٠', word: 'عَشَرَة', name: '‘ashara' },
];
export const numberQuestions: QuizQuestion[] = [
  { id: 'number-3', type: 'multiple-choice', prompt: 'Which number is this?', arabic: '٣', options: [{ id: '2', label: '2' }, { id: '3', label: '3' }, { id: '7', label: '7' }], correctOptionId: '3', explanation: '٣ is 3, thalaatha.' },
  { id: 'number-5', type: 'letter', prompt: 'Choose the Arabic digit for 5.', options: [{ id: '4', label: '٤' }, { id: '5', label: '٥' }, { id: '6', label: '٦' }], correctOptionId: '5', explanation: '٥ is 5, khamsa.' },
  { id: 'number-10', type: 'multiple-choice', prompt: 'What does ‘ashara mean?', arabic: 'عَشَرَة', options: [{ id: '10', label: '10' }, { id: '1', label: '1' }, { id: '8', label: '8' }], correctOptionId: '10', explanation: '‘Ashara is 10: ١٠.' },
  { id: 'number-order', type: 'order', prompt: 'Put these numbers in order from smallest.', items: [{ id: 'one', label: '١' }, { id: 'two', label: '٢' }, { id: 'three', label: '٣' }], correctOrder: ['one', 'two', 'three'], explanation: '١, ٢, ٣ are 1, 2, 3.' },
];

export function letterQuiz(letter: ArabicLetter): QuizQuestion[] {
  const index = arabicAlphabet.findIndex(item => item.id === letter.id);
  const next = arabicAlphabet[(index + 1) % arabicAlphabet.length];
  const third = arabicAlphabet[(index + 2) % arabicAlphabet.length];
  return [
    { id: `${letter.id}-identify`, type: 'letter', prompt: `Which letter is ${letter.name}?`,
      options: [next, letter, third].map(item => ({ id: item.id, label: item.arabic })), correctOptionId: letter.id,
      explanation: `${letter.arabic} is ${letter.name}.` },
    { id: `${letter.id}-name`, type: 'multiple-choice', prompt: 'What is the name of this letter?', arabic: letter.arabic,
      options: [third, letter, next].map(item => ({ id: item.id, label: item.name })), correctOptionId: letter.id,
      explanation: `This is ${letter.name}.` },
    { id: `${letter.id}-listen`, type: 'listen-select', prompt: 'Listen to the letter name, then choose the letter.',
      teachingSpeech: letter.name, options: [letter, third, next].map(item => ({ id: item.id, label: item.arabic })),
      correctOptionId: letter.id, explanation: `You heard ${letter.name}: ${letter.arabic}.` },
    { id: `${letter.id}-forms`, type: 'true-false', prompt: `${letter.name} connects to the letter after it.`,
      answer: letter.joinsNext, explanation: letter.joinsNext ? `${letter.name} connects to a following letter.`
        : `${letter.name} does not connect to a following letter. It can connect to the letter before it.` },
  ];
}
export const sampleArabicQuestions = starterLessons.flatMap(letterQuiz);

export const practiceQuestions: QuizQuestion[] = [
  { id: 'arabic-match', type: 'match', prompt: 'Match each letter to its name.', pairs: starterLessons.slice(0, 3).map(letter => ({ id: letter.id, left: letter.arabic, right: letter.name })),
    explanation: 'Alif is ا, Ba is ب, and Ta is ت.' },
  { id: 'arabic-meaning', type: 'meaning', prompt: 'What does this Arabic word mean?', arabic: 'بَاب',
    options: [{ id: 'door', label: 'Door' }, { id: 'book', label: 'Book' }, { id: 'house', label: 'House' }], correctOptionId: 'door', explanation: 'Baab means door.' },
  { id: 'arabic-order', type: 'order', prompt: 'Put the first three letters in alphabet order.',
    items: starterLessons.slice(0, 3).map(letter => ({ id: letter.id, label: letter.name })), correctOrder: ['alif', 'ba', 'ta'], explanation: 'The alphabet begins Alif, Ba, Ta.' },
  { id: 'fatha-select', type: 'letter', prompt: 'Choose Ba with fatha (ba).', options: [{ id: 'bi', label: 'بِ' }, { id: 'ba', label: 'بَ' }, { id: 'bu', label: 'بُ' }],
    correctOptionId: 'ba', explanation: 'Fatha is the little stroke above: بَ.' },
];
