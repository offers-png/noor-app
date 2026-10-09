import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, colors } from '../../components/Common/ui';
import { QuizEngine } from '../../components/Quiz/QuizEngine';
import { getDb } from '../../services/database/database';
import { collectionTitle, ImportedLibrary, sourceQuiz, type ImportedReading } from '../../services/hadith/ImportedLibrary';
import { arabicDisplayProps, sourceTextParagraphs } from '../../services/quran/presentation';

/** Renders Sunnah.com source text, formatting its markup without changing any words. */
export function SourceText({ text, arabic = false, fontSize = 32 }: { text: string; arabic?: boolean; fontSize?: number }) {
  return <>{sourceTextParagraphs(text).map((paragraph, index) => <Text key={index} selectable style={arabic ? [styles.arabic, arabicDisplayProps(fontSize)] : styles.body}>
    {paragraph.runs.map((run, position) => <Text key={position} style={{ fontWeight: run.bold || paragraph.heading ? '700' : '400', fontStyle: run.italic ? 'italic' : 'normal' }}>{run.text}</Text>)}
  </Text>)}</>;
}

/** Parent-added Sunnah.com readings for children, grouped by topic. */
export function ImportedSection({ kind, childId, fontSize, onComplete }: { kind: 'hadith' | 'dua'; childId?: number; fontSize: number; onComplete: (id: string, score?: number) => Promise<void> }) {
  const router = useRouter();
  const [items, setItems] = useState<ImportedReading[]>([]);
  const [open, setOpen] = useState<string>();
  const [quiz, setQuiz] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      const db = await getDb();
      const list = await new ImportedLibrary(db).list(kind);
      const marks = childId ? (await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM bookmarks WHERE child_id=? AND kind=?', childId, 'imported')).map(row => row.item_id) : [];
      if (active) { setItems(list); setSaved(marks); }
    })().catch(() => undefined);
    return () => { active = false; };
  }, [kind, childId]));
  if (!items.length) return null;
  const toggle = async (id: string) => {
    if (!childId) return;
    const db = await getDb();
    if (saved.includes(id)) await db.runAsync('DELETE FROM bookmarks WHERE child_id=? AND kind=? AND item_id=?', childId, 'imported', id);
    else await db.runAsync('INSERT OR IGNORE INTO bookmarks(child_id,kind,item_id,created_at) VALUES (?,?,?,?)', childId, 'imported', id, new Date().toISOString());
    setSaved(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  };
  const categories = [...new Set(items.map(item => item.category))];
  return <View style={styles.stack}>
    <Text style={styles.section}>{kind === 'hadith' ? 'More hadith from your parent' : 'More duas from your parent'}</Text>
    {categories.map(category => <View key={category} style={styles.stack}>
      <Text style={styles.heading}>{category}</Text>
      {items.filter(item => item.category === category).map(item => <Card key={item.id}>
        <Text style={styles.caption}>{kind === 'dua' ? 'From the Sunnah (hadith-based)' : 'Hadith'} · {collectionTitle(item.record.collection)} {item.record.hadithNumber}</Text>
        {open === item.id ? <>
          <SourceText text={item.record.canonicalText} arabic fontSize={fontSize} />
          <SourceText text={item.record.translation} />
          <Text style={styles.caption}>Grading: {item.record.grades.length ? item.record.grades.map(grade => `${grade.grade} (${grade.gradedBy})`).join(', ') : 'none supplied by the source'}</Text>
          <Text style={styles.caption}>Source: Sunnah.com · {collectionTitle(item.record.collection)} {item.record.hadithNumber}. Read it with your adult; they can explain what it means.</Text>
          <Button label={saved.includes(item.id) ? '★ Saved' : '☆ Save'} secondary disabled={!childId} onPress={() => void toggle(item.id)} />
          <Button label="I practised it from memory" secondary disabled={!childId} onPress={() => void onComplete(`imported:${item.id}`).then(() => setMessage('Practice saved.')).catch(() => setMessage('Practice could not be saved.'))} />
          <Button label="● Record my recitation" onPress={() => router.push({ pathname: '/record', params: { kind: kind === 'dua' ? 'dua_recitation' : 'hadith_memorization', itemRef: item.id, title: `${collectionTitle(item.record.collection)} ${item.record.hadithNumber}` } })} />
          {quiz ? <QuizEngine questions={sourceQuiz(item, items)} title="Quick quiz" onComplete={score => onComplete(`imported-quiz:${item.id}`, score)} /> : <Button label="Quick quiz" secondary onPress={() => setQuiz(true)} />}
          {!!message && <Text style={styles.caption}>{message}</Text>}
          <Button label="Close" secondary onPress={() => { setOpen(undefined); setQuiz(false); setMessage(''); }} />
        </> : <Button label="Open" onPress={() => { setOpen(item.id); setQuiz(false); setMessage(''); }} />}
      </Card>)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  stack: { gap: 12 },
  section: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 10 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 17, lineHeight: 27, color: colors.ink, writingDirection: 'ltr' },
  arabic: { color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
});
