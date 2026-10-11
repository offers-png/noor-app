import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Field, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { LessonReviewRepository } from '../../content/lessons/reviewRepository';
import { useAppStore } from '../../state/appStore';

export type GuideId = 'guide-salah' | 'guide-wudu';
const names: Record<GuideId, string> = { 'guide-salah': 'Salah — Learn to Pray', 'guide-wudu': 'Wudu — Learn Purification' };
const ages = [5, 7, 9, 12, 15];

/** One-step parent approval from the locked tile. Records the same review and publication as Review educational explanations. */
export default function GuideApprove({ id, done, back }: { id: GuideId; done: () => void; back: () => void }) {
  const [reviewer, setReviewer] = useState('');
  const [min, setMin] = useState(5);
  const [max, setMax] = useState(15);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const open = async () => {
    setBusy(true); setMessage('');
    try {
      await new LessonReviewRepository(await getDb(), () => useAppStore.getState().parentUnlocked).openForFamily(id, { reviewer, ageRange: { min, max }, confirmed });
      done();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The guide could not be opened. Please retry.'); }
    finally { setBusy(false); }
  };
  return <Screen title={`Open ${names[id]}`} back={back}>
    <Body>Look through the guide with your child’s teacher or imam (or yourself, if you are confident in it). When you are happy with it, open it here. You can withdraw it any time in Parent Mode → Review educational explanations.</Body>
    <Card><Text style={styles.note}>The Arabic words of the prayer and wudu are copied exactly from the cited hadith (Sahih al-Bukhari, Sahih Muslim, Abu Dawud and Ibn Majah), and every reference was checked against the hadith text. Where schools differ, the guide lists the differences without a ruling.</Text></Card>
    <Card>
      <Field label="Who checked it (your name, teacher or imam)" value={reviewer} onChangeText={setReviewer} maxLength={120} editable={!busy} />
      <Text style={styles.label}>From age</Text>
      <View style={styles.row}>{ages.filter(age => age <= max).map(age => <Button key={age} label={`${min === age ? '✓ ' : ''}${age}`} secondary={min !== age} onPress={() => setMin(age)} />)}</View>
      <Text style={styles.label}>Up to age</Text>
      <View style={styles.row}>{ages.filter(age => age >= min).map(age => <Button key={age} label={`${max === age ? '✓ ' : ''}${age}`} secondary={max !== age} onPress={() => setMax(age)} />)}</View>
      <View style={styles.switchRow}><Text style={[styles.body, { flex: 1 }]}>We checked this guide and its sources, and I approve it for my children aged {min}–{max}.</Text><Switch accessibilityLabel="Confirm you checked and approve this guide" value={confirmed} disabled={busy} onValueChange={setConfirmed} /></View>
      <Button label="Open it for my children" disabled={busy || !confirmed || !reviewer.trim()} onPress={() => void open()} />
      {!!message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}
    </Card>
  </Screen>;
}
const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  note: { fontSize: 15, lineHeight: 22, color: '#71491b' },
  label: { fontSize: 15, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
