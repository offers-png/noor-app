import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, colors } from '../../components/Common/ui';
import { sourcePracticeId, sourceReadings } from '../../content/lessons/sourceReadings';
import { AudioControls } from '../../services/audio/AudioControls';
import { getDb } from '../../services/database/database';
import { SourceReadingRepository } from './sourceReadingRepository';

interface Props {
  category: 'hadith' | 'duas';
  childId?: number;
  fontSize: number;
  networkAllowed: boolean;
  audioEnabled: boolean;
  onComplete: (id: string) => Promise<void>;
  onLessons?: () => void;
}

/** Source reading works from the compiled catalog, independently of editorial DB drafts. */
export function SourceReadingLibrary({ category, childId, fontSize, networkAllowed, audioEnabled, onComplete, onLessons }: Props) {
  const records = useMemo(() => sourceReadings(category), [category]);
  const [selected, setSelected] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [practicing, setPracticing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [focused, setFocused] = useState(true);
  const [message, setMessage] = useState('');
  const session = useRef(0);
  const alive = useRef(true);
  const lock = useRef(false);
  const record = records.find(item => item.id === selected);
  const noun = category === 'hadith' ? 'Hadith' : 'duas';
  const body = [styles.body, { fontSize: Math.max(16, fontSize * 0.55), lineHeight: Math.max(26, fontSize * 0.85) }];

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const loadSaved = useCallback(async () => childId ? new SourceReadingRepository(await getDb()).savedIds(childId, category) : [], [childId, category]);
  useFocusEffect(useCallback(() => {
    const version = ++session.current;
    setFocused(true); setLoadingSaved(true); setBusy(lock.current);
    void loadSaved().then(ids => { if (session.current === version) setSavedIds(ids); })
      .catch(() => { if (session.current === version) setMessage('Saved readings could not be loaded. You can still read every selection.'); })
      .finally(() => { if (session.current === version) setLoadingSaved(false); });
    return () => { session.current++; setFocused(false); };
  }, [loadSaved]));

  const run = async (work: () => Promise<void>, success: string) => {
    if (!childId || lock.current) return;
    const version = session.current;
    lock.current = true; setBusy(true); setMessage('');
    try { await work(); if (session.current === version) setMessage(success); }
    catch { if (session.current === version) setMessage('Your practice could not be saved. Please try again.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const toggleSaved = async () => {
    if (!record || !childId) return;
    const id = record.id;
    await run(async () => {
      const repo = new SourceReadingRepository(await getDb());
      await repo.setSaved(childId, id, !savedIds.includes(id));
      const ids = await repo.savedIds(childId, category);
      if (alive.current) setSavedIds(ids);
    }, 'Your saved readings are updated.');
  };
  const complete = async (memorized = false) => {
    if (!record || !childId) return;
    const reading = record;
    await run(async () => {
      if (memorized) await new SourceReadingRepository(await getDb()).markMemorized(childId, reading.id);
      await onComplete(sourcePracticeId(reading));
    }, memorized ? 'MashaAllah! You marked this dua as memorized.' : 'MashaAllah! Your reading practice is saved.');
  };

  if (!record) {
    const query = search.trim().toLocaleLowerCase();
    const listed = records.filter(item => (!savedOnly || savedIds.includes(item.id))
      && (!query || `${item.title} ${item.topic} ${item.canonicalText} ${item.translation} ${item.transliteration?.text ?? ''} ${item.source.sourceReference}`.toLocaleLowerCase().includes(query)));
    return <View style={styles.stack}>
      <Card><Text accessibilityRole="header" style={styles.heading}>Read together</Text><Text style={body}>{records.length} short source selections, ready offline. Read with your adult and practice at your own pace.</Text><Text style={styles.caption}>Arabic and translations are selected from Sunnah.com. Each reading shows its reference.</Text></Card>
      <View style={styles.row}><View style={styles.flex}><Button label={`All ${noun}`} secondary={savedOnly} onPress={() => setSavedOnly(false)} /></View><View style={styles.flex}><Button label={`Saved (${savedIds.length})`} secondary={!savedOnly} onPress={() => setSavedOnly(true)} /></View></View>
      <TextInput accessibilityLabel={`Search ${noun} in Arabic or English`} placeholder="Search a reading or source" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.search} />
      {listed.map(item => <Card key={item.id}><Text style={styles.heading}>{item.title}</Text><Text style={styles.caption}>{item.topic}</Text><Text accessibilityLanguage="ar" style={[styles.arabic, { fontSize: Math.max(28, fontSize * 0.85), lineHeight: Math.max(48, fontSize * 1.5) }]}>{item.canonicalText}</Text><Text style={styles.caption}>{item.source.sourceReference}</Text><Button label={`Read ${item.title}`} onPress={() => { setSelected(item.id); setPracticing(false); setHidden(false); setMessage(''); }} /></Card>)}
      {!listed.length && <Card><Text style={body}>{savedOnly ? loadingSaved ? 'Opening your saved readings…' : 'Save a reading to find it here.' : 'No readings match your search.'}</Text></Card>}
      {!!message && <Text accessibilityLiveRegion="polite" style={body}>{message}</Text>}
      {onLessons && <Button label="Learning lessons & quizzes" secondary onPress={onLessons} />}
    </View>;
  }

  return <View style={styles.stack}>
    <Button label={`← All ${noun}`} secondary onPress={() => { setSelected(null); setMessage(''); }} />
    <Text accessibilityRole="header" style={styles.heading}>{record.title}</Text>
    <Card>
      <Text style={styles.caption}>Short source selection • part of a longer narration</Text>
      {hidden ? <Text style={body}>The reading is hidden. Try remembering it, then show it to check.</Text> : <>
        <Text accessibilityLanguage="ar" style={[styles.arabic, { fontSize: Math.max(32, fontSize), lineHeight: Math.max(55, fontSize * 1.7) }]}>{record.canonicalText}</Text>
        {record.transliteration && <><Text style={body}>{record.transliteration.text}</Text><Text style={styles.caption}>Transliteration: {record.transliteration.source.sourceReference}, {record.transliteration.source.sourceName}</Text></>}
        <Text style={body}>{record.translation}</Text>
      </>}
      <Text style={styles.caption}>Arabic and English: {record.source.sourceReference}, {record.source.sourceName}</Text>
      <Text style={styles.caption}>{record.source.translationName}</Text>
      {!!record.narrator && <Text style={styles.caption}>Narrator: {record.narrator}</Text>}
      {record.audioUri && focused ? <AudioControls key={record.id} tracks={[{ id: `${record.id}:source-audio`, title: record.title, uri: record.audioUri, sourceLabel: record.source.sourceReference }]} networkAllowed={networkAllowed} audioEnabled={audioEnabled} /> : category === 'duas' && <Text style={styles.caption}>A source recording is not supplied for this selection. Practice pronunciation with your adult.</Text>}
      <Button label={savedIds.includes(record.id) ? 'Remove from saved readings' : '★ Save this reading'} secondary disabled={busy || loadingSaved || !childId} onPress={() => { void toggleSaved(); }} />
    </Card>
    <Button label="😊 I practiced reading" disabled={busy || !childId} onPress={() => { void complete(); }} />
    {category === 'duas' && <>
      <Button label={practicing ? 'Return to reading' : 'Practice from memory'} secondary onPress={() => { setPracticing(!practicing); setHidden(false); }} />
      {practicing && <Card><Text style={body}>Read with your adult, repeat, then hide the reading and try from memory.</Text><Button label={hidden ? 'Show the reading' : 'Hide the reading'} secondary onPress={() => setHidden(!hidden)} /><Button label="★ Mark as memorized" disabled={busy || !childId} onPress={() => { void complete(true); }} /><Text style={styles.caption}>You and your adult mark your progress. The app does not judge pronunciation.</Text></Card>}
    </>}
    <Text style={styles.caption}>Read selections with an adult. Ask a qualified teacher about religious questions.</Text>
    {!!message && <Text accessibilityLiveRegion="polite" style={body}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 14 }, row: { flexDirection: 'row', gap: 12 }, flex: { flex: 1 },
  heading: { color: colors.ink, fontSize: 23, lineHeight: 31, fontWeight: '700' },
  body: { color: colors.ink, writingDirection: 'ltr' }, caption: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  arabic: { writingDirection: 'rtl', textAlign: 'right', color: colors.ink },
  search: { borderWidth: 1, borderColor: '#94a58b', minHeight: 54, padding: 14, borderRadius: 15, fontSize: 17, color: colors.ink, backgroundColor: '#fffdf6' },
});
