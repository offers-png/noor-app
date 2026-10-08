import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { QuizEngine } from '../../components/Quiz/QuizEngine';
import { NarrationButton } from '../../services/audio/NarrationButton';
import { arabicAlphabet, arabicModules, arabicNumbers, harakat, letterQuiz, numberQuestions, practiceQuestions, simpleWords, starterLessons, type ArabicLetter } from './content';
import { TracingCanvas } from './TracingCanvas';
import { useAppStore } from '../../state/appStore';
import { agePracticeGuidance } from '../../content/lessons/ageGuidance';

interface Props { onComplete: (id: string, score?: number) => Promise<void>; fontSize: number; narrationEnabled?: boolean; onOpenQuran?: () => void }
type Step = 'look' | 'listen' | 'repeat' | 'trace' | 'identify' | 'quiz';
const steps: Step[] = ['look', 'listen', 'repeat', 'trace', 'identify', 'quiz'];

function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

function LetterLesson({ letter, fontSize, narrationEnabled = false, onComplete, onBack }: Props & { letter: ArabicLetter; onBack: () => void }) {
  const [step, setStep] = useState<Step>('look');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [identified, setIdentified] = useState(false);
  const [choice, setChoice] = useState('');
  const lock = useRef(false);
  const next = () => setStep(steps[Math.min(steps.indexOf(step) + 1, steps.length - 1)]);
  const finishTrace = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try { await onComplete(`arabic-${letter.id}-trace`); next(); }
    catch { setError('Your tracing practice could not be saved. Please try Done again.'); }
    finally { lock.current = false; setSaving(false); }
  };
  const identifyOptions = letterQuiz(letter)[0];
  return <ScrollView contentContainerStyle={styles.screen}>
    <Button label="‹ Arabic School" onPress={onBack} secondary />
    <Text style={styles.title}>{letter.name}</Text>
    <Text style={styles.caption}>Step {steps.indexOf(step) + 1} of 6 · {step.toUpperCase()}</Text>
    {step === 'look' && <View style={styles.card}>
      <Text style={[styles.letter, { fontSize: Math.max(fontSize * 2.7, 84), lineHeight: Math.max(fontSize * 4, 135) }]}>{letter.arabic}</Text>
      <Text style={styles.heading}>Look at {letter.name}</Text>
      <Text style={styles.text}>{letter.hint}</Text>
      <Text style={styles.caption}>Arabic is read from right to left.</Text>
    </View>}
    {step === 'listen' && <View style={styles.card}>
      <Text style={[styles.letter, { fontSize: Math.max(fontSize * 2.5, 84) }]}>{letter.arabic}</Text>
      <Text style={styles.heading}>Listen to the letter name</Text>
      <NarrationButton enabled={narrationEnabled} text={letter.spokenName} language="ar" label={`▶ Hear ${letter.name}`} />
      <Text style={styles.caption}>Your device reads a letter name. Learn exact pronunciation with a teacher.</Text>
    </View>}
    {step === 'repeat' && <View style={styles.card}>
      <Text style={[styles.letter, { fontSize: Math.max(fontSize * 2.5, 84) }]}>{letter.arabic}</Text>
      <Text style={styles.heading}>Say it after the voice</Text>
      <Text style={styles.text}>Listen, then say “{letter.name}” three times. Ask a teacher or parent to listen with you.</Text>
      <NarrationButton enabled={narrationEnabled} text={letter.spokenName} language="ar" />
      <Text style={styles.caption}>We do not record your voice or judge pronunciation.</Text>
    </View>}
    {step === 'trace' && <View style={styles.card}><Text style={styles.heading}>Trace {letter.name}</Text>
      <TracingCanvas key={letter.id} letter={letter} onDone={() => { if (!saving) void finishTrace(); }} />
      {saving && <Text accessibilityLiveRegion="polite" style={styles.caption}>Saving your practice…</Text>}
    </View>}
    {step === 'identify' && <View style={styles.card}>
      <Text style={styles.heading}>Find {letter.name}</Text>
      <Text style={styles.text}>Which letter matches the one you practiced?</Text>
      {'options' in identifyOptions && <View style={styles.row}>{identifyOptions.options.map(option => <Pressable
        accessibilityRole="button" accessibilityState={{ selected: choice === option.id }} key={option.id}
        onPress={() => { setChoice(option.id); setIdentified(option.id === letter.id); }}
        style={[styles.letterOption, choice === option.id && styles.selected]}>
        <Text style={[styles.letter, { fontSize: 56 }]}>{option.label}</Text>
      </Pressable>)}</View>}
      {!!choice && <Text accessibilityLiveRegion="polite" style={styles.text}>{identified ? `Great work! This is ${letter.name}.` : 'Have another look, then try again.'}</Text>}
    </View>}
    {step === 'quiz' && <QuizEngine audioEnabled={narrationEnabled} questions={letterQuiz(letter)} title={`${letter.name} · Quiz`}
      onComplete={score => onComplete(`arabic-${letter.id}`, score)} />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {step !== 'quiz' && step !== 'trace' && <Button label={step === 'repeat' ? 'I practiced · Continue' : 'Continue'}
      disabled={step === 'identify' && !identified} onPress={next} />}
    {steps.indexOf(step) > 0 && <Button label="Previous step" secondary onPress={() => setStep(steps[steps.indexOf(step) - 1])} />}
  </ScrollView>;
}

export function ArabicScreen({ onComplete, fontSize, onOpenQuran, narrationEnabled = false }: Props) {
  const childAge = useAppStore(state => state.children.find(child => child.id === state.selectedChildId)?.age);
  const [letter, setLetter] = useState<ArabicLetter | null>(null);
  const [module, setModule] = useState('home');
  if (letter) return <LetterLesson key={letter.id} letter={letter} fontSize={fontSize} narrationEnabled={narrationEnabled} onComplete={onComplete} onBack={() => setLetter(null)} />;
  const list = (forms = false, sounds = false) => <View style={styles.stack}>{arabicAlphabet.map(item => <View key={item.id} style={styles.card}>
    <View style={styles.letterHeader}><Text style={[styles.singleLetter, { fontSize: Math.max(fontSize * 1.7, 56) }]}>{item.arabic}</Text>
      <View style={{ flex: 1 }}><Text style={styles.heading}>{item.name}</Text>
        <Text style={styles.caption}>{item.joinsNext ? 'Connects to the next letter' : 'Does not connect to the next letter'}</Text></View></View>
    {forms && <View style={styles.row}>{['Alone', 'Beginning', 'Middle', 'End'].map((name, index) => <View key={name} style={styles.form}>
      <Text style={styles.caption}>{name}</Text><Text style={[styles.formLetter, { fontSize: Math.max(fontSize, 32) }]}>{item.forms[index]}</Text>
    </View>)}</View>}
    {sounds && <NarrationButton enabled={narrationEnabled} text={item.spokenName} language="ar" label={`▶ Hear ${item.name}`} />}
    <Button label={`Practice ${item.name}`} secondary onPress={() => setLetter(item)} />
  </View>)}</View>;
  return <ScrollView contentContainerStyle={styles.screen}>
    {module !== 'home' && <Button label="‹ Arabic School" onPress={() => setModule('home')} secondary />}
    <Text style={styles.eyebrow}>ا ب ت · LITTLE STEPS, BIG LEARNING</Text>
    <Text style={styles.title}>Arabic School</Text>
    {module === 'home' ? <>
      <Text style={styles.text}>Look, listen, repeat and trace. Start with a letter you like.</Text>
      <Text style={styles.text}>{agePracticeGuidance(childAge)}</Text>
      <Text style={styles.heading}>Your first five lessons</Text>
      <View style={styles.row}>{starterLessons.map(item => <Pressable key={item.id} accessibilityRole="button"
        accessibilityLabel={`Start ${item.name} lesson`} onPress={() => setLetter(item)} style={styles.lessonTile}>
        <Text style={[styles.letter, { fontSize: Math.max(fontSize * 1.7, 64) }]}>{item.arabic}</Text>
        <Text style={styles.heading}>{item.name}</Text><Text style={styles.caption}>6 learning steps</Text>
      </Pressable>)}</View>
      <Text style={styles.heading}>Explore and practice</Text>
      {arabicModules.map(item => <Pressable accessibilityRole="button" key={item.id} onPress={() => setModule(item.id)} style={styles.card}>
        <Text style={styles.heading}>{item.title} ›</Text><Text style={styles.text}>{item.description}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" onPress={() => setModule('quran-words')} style={styles.card}>
        <Text style={styles.heading}>Quranic Words ›</Text><Text style={styles.text}>Explore source-attributed words in the Quran reader</Text>
      </Pressable>
      <Button label="Mixed practice quiz" onPress={() => setModule('quiz')} />
    </> : module === 'alphabet' ? list() : module === 'sounds' ? list(false, true) : module === 'forms' ? <>
      <Text style={styles.text}>Many letters change shape depending on their place in a word. Connecting marks show where a neighboring letter joins.</Text>{list(true)}
    </> : module === 'harakat' ? <>{harakat.map(mark => <View style={styles.card} key={mark.id}>
      <Text style={styles.heading}>{mark.name}</Text><Text style={[styles.letter, { fontSize: Math.max(fontSize * 1.7, 56) }]}>{mark.arabic}</Text>
      <Text style={styles.text}>{mark.explanation}</Text><NarrationButton enabled={narrationEnabled} text={mark.explanation} />
    </View>)}<QuizEngine audioEnabled={narrationEnabled} title="Short vowel practice" questions={practiceQuestions.slice(-1)} onComplete={score => onComplete('arabic-harakat', score)} /></>
      : module === 'joining' ? <>
        <View style={styles.card}><Text style={styles.heading}>Meet the connecting letters</Text><Text style={styles.text}>Arabic words flow from right to left. Most letters can connect to both neighboring letters.</Text>
          <Text style={[styles.letter, { fontSize: Math.max(fontSize * 1.5, 44) }]}>بـ + ـا + ب ← بَاب</Text>
          <Text style={styles.text}>Alif, Dal, Dhal, Ra, Zay and Waw do not connect to the following letter. They can connect to the letter before them.</Text>
          <Text style={[styles.letter, { fontSize: Math.max(fontSize * 1.5, 44) }]}>ا د ذ ر ز و</Text></View>{list(true)}
      </> : module === 'words' || module === 'reading' ? <>{simpleWords.map(word => <View key={word.name} style={styles.card}>
        <Text style={[styles.letter, { fontSize: Math.max(fontSize * 1.7, 56) }]}>{word.arabic}</Text>
        <Text style={styles.heading}>{word.name} · {word.meaning}</Text><Text style={styles.text}>{word.letters}</Text>
        <NarrationButton enabled={narrationEnabled} text={word.arabic} language="ar" /><Text style={styles.caption}>Device narration is a practice aid. Read with a teacher for pronunciation guidance.</Text>
      </View>)}<QuizEngine audioEnabled={narrationEnabled} title="Words and letters" questions={practiceQuestions.slice(0, 3)} onComplete={score => onComplete('arabic-words', score)} /></>
        : module === 'numbers' ? <>{arabicNumbers.map(number => <View key={number.value} style={styles.card}>
          <Text style={[styles.letter, { fontSize: Math.max(fontSize * 1.7, 56) }]}>{number.digit}  {number.word}</Text>
          <Text style={styles.heading}>{number.value} · {number.name}</Text>
          <NarrationButton enabled={narrationEnabled} text={number.word} language="ar" /></View>)}
          <Text style={styles.caption}>Arabic digits are written left to right, like 10 → ١٠. Device narration is a practice aid.</Text>
          <QuizEngine audioEnabled={narrationEnabled} title="Number practice" questions={numberQuestions} onComplete={score => onComplete('arabic-numbers', score)} /></>
        : module === 'quran-words' ? <View style={styles.card}><Text style={styles.heading}>Learn words in their ayah</Text>
          <Text style={styles.text}>Open a seeded surah in the Quran reader and choose Word by word. It keeps the Quran text and source attribution together.</Text>
          {onOpenQuran ? <Button label="Open Quran" onPress={onOpenQuran} /> : <Text style={styles.caption}>Return home and tap Quran to open the reader.</Text>}</View>
          : <QuizEngine audioEnabled={narrationEnabled} questions={practiceQuestions} onComplete={score => onComplete('arabic-mixed-quiz', score)} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { padding: 20, paddingBottom: 50, gap: 18, backgroundColor: '#f6f4eb' },
  title: { color: '#203d30', fontSize: 32, lineHeight: 40, fontWeight: '800' },
  eyebrow: { color: '#61713d', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heading: { color: '#203d30', fontSize: 21, lineHeight: 29, fontWeight: '700' },
  text: { color: '#203d30', fontSize: 18, lineHeight: 28 },
  caption: { color: '#52634c', fontSize: 14, lineHeight: 22 },
  card: { backgroundColor: '#fffdf8', padding: 18, gap: 12, borderRadius: 22, borderWidth: 1, borderColor: '#d8dfd0' },
  stack: { gap: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  letter: { color: '#203d30', writingDirection: 'rtl', textAlign: 'center', lineHeight: 115 },
  singleLetter: { color: '#203d30', writingDirection: 'rtl', minWidth: 80, textAlign: 'center', lineHeight: 90 },
  formLetter: { color: '#203d30', writingDirection: 'rtl', textAlign: 'center', lineHeight: 66 },
  form: { flexGrow: 1, minWidth: 60, alignItems: 'center', backgroundColor: '#edf3e9', borderRadius: 12, padding: 8 },
  letterHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  lessonTile: { minWidth: 140, flexGrow: 1, alignItems: 'center', gap: 8, borderRadius: 22, backgroundColor: '#e6eddd', padding: 18, borderWidth: 1, borderColor: '#c6d4b9' },
  letterOption: { minWidth: 80, flexGrow: 1, backgroundColor: '#edf3e9', borderRadius: 16, borderWidth: 1, borderColor: '#92a08b' },
  selected: { borderWidth: 2, borderColor: '#226345', backgroundColor: '#dcebd3' },
  button: { minHeight: 52, backgroundColor: '#226345', borderRadius: 16, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#edf3e9', borderWidth: 1, borderColor: '#6d8263' },
  secondaryText: { color: '#203d30' },
  disabled: { opacity: 0.4 },
  error: { color: '#843d2c', fontSize: 16 },
});

export default ArabicScreen;
