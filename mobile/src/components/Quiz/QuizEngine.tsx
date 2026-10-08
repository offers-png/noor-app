import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuizAnswer, QuizQuestion } from '../../types/quiz';
import { AudioControls } from '../../services/audio/AudioControls';
import { NarrationButton } from '../../services/audio/NarrationButton';
import { answerIsReady, isArabicLabel, isCorrect, scoreQuiz } from './scoring';

interface Props {
  questions: QuizQuestion[];
  title?: string;
  networkAllowed?: boolean;
  audioEnabled?: boolean;
  onComplete: (score: number) => Promise<void> | void;
}

function Option({ label, selected, disabled, onPress }: {
  label: string; selected?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={[styles.option, selected && styles.selected]}>
    <Text style={[styles.optionText, isArabicLabel(label) && styles.arabicOption]}>{label}</Text>
  </Pressable>;
}

export function QuizEngine({ questions, title = 'Try a little quiz', networkAllowed = false, audioEnabled = true, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [checked, setChecked] = useState(false);
  const [left, setLeft] = useState<string | undefined>();
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLock = useRef(false);
  const question = questions[index];
  if (!question) return <Text style={styles.text}>No questions are available for this lesson.</Text>;
  const answer = answers[question.id];
  const choose = (value: QuizAnswer) => {
    if (checked) return;
    setAnswers(previous => ({ ...previous, [question.id]: value }));
  };
  const save = async () => {
    if (saveLock.current) return;
    const result = scoreQuiz(questions, answers);
    if (!result.complete) return;
    saveLock.current = true;
    setSaving(true);
    setSaveError('');
    try { await onComplete(result.score); setFinished(true); }
    catch { setSaveError('Your result could not be saved. Tap Save result to try again.'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const next = () => {
    if (index === questions.length - 1) { void save(); return; }
    setIndex(index + 1);
    setChecked(false);
    setLeft(undefined);
  };
  if (finished) {
    const result = scoreQuiz(questions, answers);
    return <View style={styles.card}><Text style={styles.title}>MashaAllah! Quiz complete.</Text>
      <Text style={styles.text}>{result.correct} of {result.total} correct · {result.score}%</Text>
      <Text style={styles.text}>{result.score >= 80 ? 'Great work! Your practice is saved.' : 'Keep practicing! Every try helps you learn.'}</Text>
      <Option label="Practice again" onPress={() => { setIndex(0); setAnswers({}); setChecked(false); setFinished(false); }} />
    </View>;
  }
  return <View style={styles.card}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.caption}>Question {index + 1} of {questions.length}</Text>
    <Text style={styles.prompt}>{question.prompt}</Text>
    {('arabic' in question) && question.arabic && <Text style={styles.arabic}>{question.arabic}</Text>}
    {question.type === 'listen-select' && question.audioUri && <AudioControls
      tracks={[{ id: question.id, title: 'Listen to the question', uri: question.audioUri }]} networkAllowed={networkAllowed} audioEnabled={audioEnabled} />}
    {question.type === 'listen-select' && question.teachingSpeech && <NarrationButton text={question.teachingSpeech} enabled={audioEnabled} />}
    {question.type === 'listen-select' && question.teachingSpeech && !audioEnabled && <Text style={styles.text}>Read the letter name instead: {question.teachingSpeech}</Text>}
    {question.type === 'true-false' ? <View style={styles.stack}>
      {[true, false].map(value => <Option key={String(value)} label={value ? 'True' : 'False'} selected={answer === value}
        disabled={checked} onPress={() => choose(value)} />)}
    </View> : question.type === 'match' ? <View style={styles.stack}>
      <Text style={styles.caption}>Tap a word on the left, then its partner on the right.</Text>
      <View style={styles.columns}>
        <View style={styles.column}>{question.pairs.map(pair => <Option key={pair.id} label={`${pair.left}${typeof answer === 'object' && !Array.isArray(answer) && answer[pair.id] ? ' ✓' : ''}`}
          selected={left === pair.id} disabled={checked} onPress={() => setLeft(pair.id)} />)}</View>
        <View style={styles.column}>{[...question.pairs].reverse().map(pair => <Option key={pair.id} label={pair.right}
          disabled={checked || !left} onPress={() => {
            if (!left) return;
            const matches = typeof answer === 'object' && !Array.isArray(answer) ? { ...answer } : {};
            // Each right-hand option can belong to only one left-hand option.
            for (const key of Object.keys(matches)) if (matches[key] === pair.id) delete matches[key];
            matches[left] = pair.id;
            choose(matches);
            setLeft(undefined);
          }} />)}</View>
      </View>
      {typeof answer === 'object' && !Array.isArray(answer) && Object.keys(answer).map(id => <Text key={id} style={styles.caption}>
        {question.pairs.find(pair => pair.id === id)?.left} ↔ {question.pairs.find(pair => pair.id === answer[id])?.right}
      </Text>)}
    </View> : question.type === 'order' ? <View style={styles.stack}>
      <Text style={styles.caption}>Tap the items in the right order.</Text>
      {[...question.items].reverse().map(item => <Option key={item.id} label={item.label}
        disabled={checked || (Array.isArray(answer) && answer.includes(item.id))} onPress={() => choose([...(Array.isArray(answer) ? answer : []), item.id])} />)}
      {Array.isArray(answer) && answer.map((id, order) => <Text key={id} style={styles.text}>{order + 1}. {question.items.find(item => item.id === id)?.label}</Text>)}
      <Option label="Start order again" disabled={checked} onPress={() => choose([])} />
    </View> : <View style={styles.stack}>{question.options.map(option => <Option key={option.id}
      label={option.label} selected={answer === option.id} disabled={checked} onPress={() => choose(option.id)} />)}</View>}
    {checked && <View style={styles.feedback} accessibilityLiveRegion="polite">
      <Text style={styles.prompt}>{isCorrect(question, answer) ? 'Excellent!' : 'Keep practicing!'}</Text>
      <Text style={styles.text}>{question.explanation ?? 'Review the lesson and have another go whenever you like.'}</Text>
      {!!question.sourceReference && <Text style={styles.caption}>Source: {question.sourceReference}</Text>}
    </View>}
    {!!saveError && <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>}
    <Pressable accessibilityRole="button" disabled={saving || !answerIsReady(question, answer)}
      accessibilityState={{ disabled: saving || !answerIsReady(question, answer) }}
      onPress={checked ? next : () => setChecked(true)} style={[styles.action, (!answerIsReady(question, answer) || saving) && styles.disabled]}>
      <Text style={styles.actionText}>{saving ? 'Saving…' : checked ? (index === questions.length - 1 ? 'Save result' : 'Next question') : 'Check answer'}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 14, borderRadius: 22, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#d8dfd0' },
  title: { color: '#203d30', fontSize: 23, fontWeight: '700' },
  prompt: { color: '#203d30', fontSize: 20, fontWeight: '600', lineHeight: 29 },
  text: { color: '#203d30', fontSize: 17, lineHeight: 26 },
  caption: { color: '#52634c', fontSize: 14, lineHeight: 21 },
  arabic: { writingDirection: 'rtl', textAlign: 'center', color: '#203d30', fontSize: 56, lineHeight: 86 },
  stack: { gap: 10 },
  option: { minHeight: 52, borderWidth: 1, borderColor: '#92a08b', borderRadius: 14, padding: 14, justifyContent: 'center', backgroundColor: '#f6f7f0' },
  optionText: { color: '#203d30', fontSize: 18, lineHeight: 26 },
  arabicOption: { fontSize: 48, lineHeight: 76, textAlign: 'center', writingDirection: 'rtl' },
  selected: { backgroundColor: '#dcebd3', borderWidth: 2, borderColor: '#226345' },
  columns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, gap: 10 },
  feedback: { backgroundColor: '#edf3e9', padding: 14, gap: 8, borderRadius: 14 },
  action: { minHeight: 52, padding: 15, borderRadius: 16, backgroundColor: '#226345', alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  disabled: { opacity: 0.4 },
  error: { color: '#843d2c', fontSize: 16 },
});
