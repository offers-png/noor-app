import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioControls, type AudioTrack } from '../../services/audio/AudioControls';
import { hiddenWordIndexes, memorizationLevels, nextMemorizationLevel, type MemorizationLevel, type MemorizationRating } from './logic';
import { RepeatPlanPlayer } from './RepeatPlanPlayer';

interface Props {
  lessonId: string;
  title: string;
  arabic: string;
  translation?: string;
  words?: string[];
  passages?: MemorizationPassage[];
  tracks?: AudioTrack[];
  networkAllowed?: boolean;
  audioEnabled?: boolean;
  fontSize?: number;
  onComplete: (rating: MemorizationRating) => Promise<void>;
  onLevelChange?: (level: MemorizationLevel) => Promise<void>;
  onExit?: () => void;
}
export interface MemorizationPassage { id: string; arabic: string; translation?: string; words?: string[] }
const instructions: Record<MemorizationLevel, string> = {
  listen: 'Listen to this ayah three times. Take your time and notice the sounds.',
  read: 'Now read it with the reciter. Follow the Arabic carefully.',
  repeat: 'Repeat it after the reciter. You can listen as often as you need.',
  hide: 'Let us cover a few words. Try remembering them, then reveal them to check.',
  recite: 'Can you recite it without looking? Tap Show Arabic whenever you need help.',
  complete: 'How did your practice feel? Choose one to save your progress.',
};

function MemoButton({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function MemorizationScreen({ title, arabic, translation, words, passages, tracks = [], networkAllowed = false, audioEnabled = true,
  fontSize = 36, onComplete, onLevelChange, onExit }: Props) {
  const [level, setLevel] = useState<MemorizationLevel>('listen');
  const [hideStage, setHideStage] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const shownPassages = passages?.length ? passages : [{ id: title, arabic, translation, words }];
  const move = async (next: MemorizationLevel) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try { await onLevelChange?.(next); setLevel(next); setRevealed(false); }
    catch { setError('Your practice could not be saved. Please try again.'); }
    finally { lock.current = false; setSaving(false); }
  };
  const finish = async (rating: MemorizationRating) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await onComplete(rating);
      if (rating === 'again') { setLevel('listen'); setHideStage(1); }
      else setSaved(true);
    } catch { setError('Your practice could not be saved. Please try again.'); }
    finally { lock.current = false; setSaving(false); }
  };
  if (saved) return <View style={styles.card}>
    <Text style={styles.title}>Great work! Practice saved.</Text>
    <Text style={styles.text}>Your own rating helps you plan what to practice next.</Text>
    <MemoButton label='Practice again' onPress={() => { setSaved(false); setLevel('listen'); setHideStage(1); }} />
    {onExit && <MemoButton label='Back to the reader' onPress={onExit} secondary />}
  </View>;
  return <View style={styles.card}>
    <Text style={styles.title}>Memorize · {title}</Text>
    <Text style={styles.caption}>Step {memorizationLevels.indexOf(level) + 1} of 6 · {level.toUpperCase()}</Text>
    <Text style={styles.text}>{instructions[level]}</Text>
    {level === 'recite' && !revealed ? <View style={styles.cover}>
      <Text style={styles.text}>The Arabic is covered. Take your time.</Text>
    </View> : shownPassages.map(passage => {
      const passageWords = passage.words?.length ? passage.words : passage.arabic.split(/\s+/u).filter(Boolean);
      const masked = hiddenWordIndexes(passageWords.length, hideStage);
      return <View key={passage.id} style={styles.passage}>
        {shownPassages.length > 1 && <Text style={styles.caption}>Ayah {passage.id}</Text>}
        {level === 'hide' && !revealed ? <View style={styles.wordRow} accessibilityLabel={`Words hidden for memory practice in ${passage.id}`}>
          {passageWords.map((word, index) => <Text key={index} style={[styles.word, { fontSize, lineHeight: fontSize * 1.8 }]}>{masked.includes(index) ? '•••' : word}</Text>)}
        </View> : <Text style={[styles.arabic, { fontSize, lineHeight: fontSize * 1.9 }]}>{passage.arabic}</Text>}
        {passage.translation && level !== 'recite' && <Text style={styles.translation}>{passage.translation}</Text>}
      </View>;
    })}
    {(level === 'hide' || level === 'recite') && <MemoButton label={revealed ? 'Cover Arabic' : 'Show Arabic'} onPress={() => setRevealed(!revealed)} secondary />}
    {level === 'hide' && <View style={styles.row}>{[1, 2, 3].map(stage => <Pressable accessibilityRole="button"
      accessibilityState={{ selected: hideStage === stage }} key={stage} onPress={() => { setHideStage(stage); setRevealed(false); }}
      style={[styles.stage, hideStage === stage && styles.activeStage]}><Text style={styles.text}>{stage === 3 ? 'Hide all' : `Hide ${stage}/3`}</Text></Pressable>)}</View>}
    {level !== 'complete' && tracks.length > 0 && !(level === 'repeat' && tracks.length > 1) && <AudioControls key={level} tracks={tracks} networkAllowed={networkAllowed} audioEnabled={audioEnabled} repeat={3} />}
    {level === 'repeat' && tracks.length > 1 && <RepeatPlanPlayer tracks={tracks} networkAllowed={networkAllowed} audioEnabled={audioEnabled} />}
    {(level === 'listen' || level === 'repeat') && (!tracks.length || !audioEnabled) && <Text style={styles.caption}>
      {!audioEnabled ? 'Audio is off. Ask a parent to enable it, or practice reading with a teacher.' : 'No recording is available for this item. You can practice reading with a teacher and continue.'}
    </Text>}
    <Text style={styles.caption}>This is your practice journal. The app does not judge your recitation and does not record your voice.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {level === 'complete' ? <View style={styles.stack}>
      <MemoButton label='😊 Easy' onPress={() => { void finish('easy'); }} disabled={saving} />
      <MemoButton label='😐 Need practice' onPress={() => { void finish('practice'); }} disabled={saving} />
      <MemoButton label='🔁 Practice again' onPress={() => { void finish('again'); }} disabled={saving} secondary />
    </View> : <MemoButton label={saving ? 'Saving…' : 'I practiced · Next step'} onPress={() => { void move(nextMemorizationLevel(level)); }} disabled={saving} />}
    {memorizationLevels.indexOf(level) > 0 && level !== 'complete' && <MemoButton label='Previous step' onPress={() => {
      void move(memorizationLevels[memorizationLevels.indexOf(level) - 1]);
    }} secondary disabled={saving} />}
    {onExit && <MemoButton label='Back to the reader' onPress={onExit} secondary />}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fffdf8', padding: 18, borderRadius: 22, gap: 16, borderWidth: 1, borderColor: '#d8dfd0' },
  title: { fontSize: 24, fontWeight: '700', color: '#203d30' },
  text: { color: '#203d30', fontSize: 18, lineHeight: 27 },
  caption: { color: '#52634c', fontSize: 14, lineHeight: 21 },
  translation: { color: '#425b4b', fontSize: 17, lineHeight: 27 },
  passage: { gap: 10, borderBottomWidth: 1, borderBottomColor: '#e1e7da', paddingBottom: 12 },
  arabic: { color: '#203d30', writingDirection: 'rtl', textAlign: 'right' },
  wordRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  word: { color: '#203d30', writingDirection: 'rtl' },
  cover: { minHeight: 140, borderRadius: 18, backgroundColor: '#e5ecd9', padding: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack: { gap: 12 },
  button: { minHeight: 52, backgroundColor: '#226345', borderRadius: 16, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondary: { backgroundColor: '#edf3e9', borderWidth: 1, borderColor: '#6d8263' },
  secondaryText: { color: '#203d30' },
  stage: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#6d8263', borderRadius: 13 },
  activeStage: { backgroundColor: '#dcebd3', borderWidth: 2 },
  error: { color: '#843d2c', fontSize: 16 },
  disabled: { opacity: 0.45 },
});
