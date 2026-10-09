import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, Field, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { configuredContentConnection } from '../../services/quran/config';
import { SunnahProvider } from '../../services/hadith/SunnahProvider';
import { collectionTitle, COLLECTIONS, DUA_CATEGORIES, HADITH_CATEGORIES, ImportedLibrary, SUGGESTED_HADITH, type ImportedReading, type ImportKind } from '../../services/hadith/ImportedLibrary';
import { SourceText } from '../lessons/ImportedSection';
import { useAppStore } from '../../state/appStore';
import type { HadithRecord } from '../../types/lessons';

const parentAllowed = () => useAppStore.getState().parentUnlocked;

/** Parent adds individual Hadith and Dua records from Sunnah.com after reading the exact source text. */
export default function LibraryImport({ back }: { back: () => void }) {
  const { settings } = useAppStore();
  const [kind, setKind] = useState<ImportKind>('hadith');
  const [collection, setCollection] = useState('bukhari');
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState<string>(HADITH_CATEGORIES[0]);
  const [record, setRecord] = useState<HadithRecord>();
  const [read, setRead] = useState(false);
  const [items, setItems] = useState<ImportedReading[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const categories: readonly string[] = kind === 'hadith' ? HADITH_CATEGORIES : DUA_CATEGORIES;
  const reload = useCallback(async () => { const library = new ImportedLibrary(await getDb()); setItems([...await library.list('hadith'), ...await library.list('dua')]); }, []);
  useFocusEffect(useCallback(() => { void reload().catch(() => setMessage('Your library could not be loaded.')); }, [reload]));
  const run = async (work: () => Promise<string | void>) => {
    if (busy) return; setBusy(true); setMessage('');
    try { if (!parentAllowed()) throw new Error('Your parent session ended. Enter your PIN again.'); const result = await work(); if (result) setMessage(result); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'That did not work. Please try again.'); }
    finally { setBusy(false); }
  };
  const fetchRecord = (source: string, reference: string) => void run(async () => {
    setRecord(undefined); setRead(false);
    const connection = await configuredContentConnection();
    if (!connection) throw new Error('Save your content server address in Content downloads first.');
    const provider = new SunnahProvider(`${connection.url}`, { networkAllowed: useAppStore.getState().settings.networkEnabled });
    try { setRecord(await provider.getHadith(source, reference.trim())); }
    catch (error) {
      const text = error instanceof Error ? error.message : '';
      throw new Error(/unavailable|credentials|503/i.test(text) ? 'Sunnah.com is not available from your content server. It needs a Sunnah.com API key on the server (SUNNAH_API_KEY).' : text || 'The source could not be fetched.');
    }
  });
  return <Screen title="Hadith & Dua library" back={back}>
    <Body>Add individual hadith and duas from Sunnah.com. The app shows the exact Arabic, English and grading from the source. Read it, choose a topic and confirm before your children see it.</Body>
    {!settings.networkEnabled && <Card><Text style={styles.body}>Turn on optional network access in Parent Mode to look up new readings. Readings you already added work offline.</Text></Card>}
    {!!message && <Card><Text accessibilityRole="alert" style={styles.body}>{message}</Text></Card>}
    <View style={styles.row}>{(['hadith', 'dua'] as const).map(value => <Button key={value} label={`${kind === value ? '✓ ' : ''}${value === 'hadith' ? 'Hadith' : 'Dua'}`} secondary={kind !== value} onPress={() => { setKind(value); setCategory((value === 'hadith' ? HADITH_CATEGORIES : DUA_CATEGORIES)[0]); setRecord(undefined); }} />)}</View>
    <Card>
      <Text style={styles.heading}>Look up a reference</Text>
      <View style={styles.row}>{COLLECTIONS.map(item => <Button key={item.id} label={`${collection === item.id ? '✓ ' : ''}${item.title}`} secondary={collection !== item.id} onPress={() => setCollection(item.id)} />)}</View>
      <Field label="Hadith number (as shown on Sunnah.com)" value={number} onChangeText={setNumber} autoCapitalize="none" maxLength={8} />
      <Button label="Fetch from Sunnah.com" disabled={busy || !settings.networkEnabled || !/^[0-9]+[a-z]?$/.test(number.trim())} onPress={() => fetchRecord(collection, number)} />
      {kind === 'hadith' && <><Text style={styles.caption}>Suggested starting points (check that the text matches the topic):</Text>{SUGGESTED_HADITH.map(item => <Button key={`${item.collection}${item.number}`} label={`${item.category}: ${collectionTitle(item.collection)} ${item.number}`} secondary disabled={busy || !settings.networkEnabled} onPress={() => { setCollection(item.collection); setNumber(item.number); setCategory(item.category); fetchRecord(item.collection, item.number); }} />)}</>}
    </Card>
    {record && <Card>
      <Text style={styles.heading}>{collectionTitle(record.collection)} {record.hadithNumber}</Text>
      <SourceText text={record.canonicalText} arabic fontSize={settings.fontSize} />
      <SourceText text={record.translation} />
      <Text style={styles.caption}>Grading: {record.grades.length ? record.grades.map(grade => `${grade.grade} (${grade.gradedBy})`).join(', ') : 'none supplied by the source'}</Text>
      <Text style={styles.body}>Topic</Text>
      <View style={styles.row}>{categories.map(value => <Button key={value} label={`${category === value ? '✓ ' : ''}${value}`} secondary={category !== value} onPress={() => setCategory(value)} />)}</View>
      <View style={styles.switchRow}><Text style={[styles.body, { flex: 1 }]}>I read this source text. It matches the topic and suits my children.</Text><Switch accessibilityLabel="Confirm you read the source text" value={read} onValueChange={setRead} /></View>
      <Button label="Add to my children’s library" disabled={busy || !read} onPress={() => void run(async () => { await new ImportedLibrary(await getDb()).add(record, kind, category, { parentReadSource: read }, parentAllowed); setRecord(undefined); setRead(false); return 'Added. It is available offline now.'; })} />
    </Card>}
    <Text style={styles.heading}>In your library ({items.length})</Text>
    {items.map(item => <Card key={item.id}><Text style={styles.body}>{item.kind === 'dua' ? 'Dua' : 'Hadith'} · {item.category} · {collectionTitle(item.record.collection)} {item.record.hadithNumber}</Text><Button label="Remove" secondary disabled={busy} onPress={() => void run(async () => { await new ImportedLibrary(await getDb()).remove(item.id, parentAllowed); })} /></Card>)}
    <Text style={styles.caption}>Sunnah.com permits individual hadith for teaching; it does not permit copying whole collections. Add only what your children are learning.</Text>
  </Screen>;
}
const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
