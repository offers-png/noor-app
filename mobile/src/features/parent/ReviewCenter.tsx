import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Body, Button, Card, Field, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { formatBytes, nativeRecordingFiles, RecordingStore, type RecordingWithReview } from '../../services/recordings/RecordingStore';
import { formatCents, RewardsRepository, SALAH_APPROACHES, type ChildRewardSummary, type LedgerEntry, type RewardSettings, type SalahApproach } from '../../services/rewards/RewardsRepository';
import { useAppStore } from '../../state/appStore';
import { entryLabel } from '../rewards/RewardsScreen';

type Pending = LedgerEntry & { nickname: string; avatar: string };
const parentAllowed = () => useAppStore.getState().parentUnlocked;

/** Parent-only review of recordings, points, rewards and payouts. Every write re-checks the PIN session. */
export default function ReviewCenter({ back }: { back: () => void }) {
  const { children } = useAppStore();
  const [pending, setPending] = useState<Pending[]>([]);
  const [summaries, setSummaries] = useState<Record<number, ChildRewardSummary>>({});
  const [recordings, setRecordings] = useState<RecordingWithReview[]>([]);
  const [usage, setUsage] = useState({ count: 0, bytes: 0 });
  const [settings, setSettings] = useState<RewardSettings>();
  const [selected, setSelected] = useState<string[]>([]);
  const [watching, setWatching] = useState<string>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [timeZone, setTimeZone] = useState('');

  const load = useCallback(async () => {
    const db = await getDb();
    const rewards = new RewardsRepository(db);
    const store = new RecordingStore(db, await nativeRecordingFiles(), rewards);
    const current = await rewards.settings();
    await store.applyRetention(current.retentionDays);
    const entries = await Promise.all(useAppStore.getState().children.map(async child => [child.id, await rewards.summary(child.id)] as const));
    setSettings(current); setTimeZone(current.timeZone); setPending(await rewards.pending()); setSummaries(Object.fromEntries(entries));
    setRecordings(await store.list()); setUsage(await store.usage());
  }, []);
  useFocusEffect(useCallback(() => { void load().catch(() => setMessage('Review information could not be loaded.')); }, [load]));
  const run = async (work: (rewards: RewardsRepository, store: RecordingStore) => Promise<string | void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (!parentAllowed()) throw new Error('Your parent session ended. Enter your PIN again.');
      const db = await getDb(); const rewards = new RewardsRepository(db);
      const result = await work(rewards, new RecordingStore(db, await nativeRecordingFiles(), rewards));
      if (result) setMessage(result);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'That did not work. Please try again.'); }
    finally { setBusy(false); }
  };
  const confirm = (title: string, body: string, action: () => void) => Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: 'destructive', onPress: action }]);
  const recordingFor = (id: string | null) => recordings.find(row => row.id === id);

  return <Screen title="Review center" back={back}>
    {!!message && <Card><Text accessibilityRole="alert" style={styles.body}>{message}</Text></Card>}
    <Body>Approve recordings, correct points and record payouts. This app never sends money; you pay your children yourself.</Body>

    <Text style={styles.section}>Waiting for review ({pending.length})</Text>
    {!pending.length && <Body>No recordings are waiting.</Body>}
    {pending.map(entry => {
      const recording = recordingFor(entry.recording_id);
      return <Card key={entry.id}>
        <Text style={styles.heading}>{entry.avatar} {entry.nickname}</Text>
        <Text style={styles.body}>{entryLabel(entry)}</Text>
        <Text style={styles.caption}>{entry.day} · {entry.points} points if approved{recording ? ` · ${Math.round((recording.duration_ms ?? 0) / 1000)}s · ${formatBytes(recording.bytes)}` : ''}</Text>
        {watching === entry.recording_id ? <Player id={entry.recording_id!} /> : <Button label="▶ Watch recording" secondary disabled={!recording} onPress={() => setWatching(entry.recording_id ?? undefined)} />}
        <Text style={styles.caption}>Listen carefully: the app does not judge pronunciation. You decide.</Text>
        <Button label={`Approve · +${entry.points}`} disabled={busy} onPress={() => void run(async rewards => { await rewards.approve(entry.id, parentAllowed); return `Approved for ${entry.nickname}.`; })} />
        <Button label="Ask to try again" secondary disabled={busy} onPress={() => void run(async rewards => { await rewards.reject(entry.id, parentAllowed, { allowRetry: true, note: 'Please try again' }); return `${entry.nickname} can record a new attempt today.`; })} />
        <Button label="Reject" secondary disabled={busy} onPress={() => void run(async rewards => { await rewards.reject(entry.id, parentAllowed, { allowRetry: false }); })} />
      </Card>;
    })}

    <Text style={styles.section}>Children</Text>
    {children.map(child => <ChildCard key={child.id} name={`${child.avatar} ${child.nickname}`} summary={summaries[child.id]} busy={busy}
      onPay={() => confirm('Mark rewards as paid?', `Record that you paid ${child.nickname} ${formatCents(summaries[child.id]?.unpaidCents ?? 0)}. No money is sent by the app.`, () => void run(async rewards => { const payout = await rewards.markPaid(child.id, parentAllowed); return `Recorded ${formatCents(payout.amount_cents)} paid to ${child.nickname}.`; }))}
      onAdjust={(points, note) => void run(async rewards => { await rewards.adjust(child.id, points, note, parentAllowed); return `Adjusted ${child.nickname}’s points by ${points}.`; })}
      onCorrect={(entry, points) => void run(async rewards => { await rewards.correct(entry.id, points, parentAllowed, 'Corrected by parent'); return 'Points corrected.'; })} />)}

    <Text style={styles.section}>Recordings</Text>
    <Card>
      <Text style={styles.body}>{usage.count} recordings · {formatBytes(usage.bytes)} on this phone</Text>
      <Text style={styles.caption}>Videos are stored privately inside this app and are never uploaded. Deleting a video that is still waiting for review cancels its points.</Text>
      <Text style={styles.body}>Keep reviewed recordings for: {settings?.retentionDays ? `${settings.retentionDays} days` : 'until I delete them'}</Text>
      <View style={styles.row}>{[0, 7, 30, 90].map(days => <Button key={days} label={`${settings?.retentionDays === days ? '✓ ' : ''}${days ? `${days} days` : 'Keep'}`} secondary disabled={busy} onPress={() => void run(async rewards => { await rewards.saveSettings({ retentionDays: days }, parentAllowed); })} />)}</View>
      {recordings.map(row => <View key={row.id} style={styles.line}>
        <Text style={styles.body}>{row.avatar} {row.nickname} · {row.title}</Text>
        <Text style={styles.caption}>{row.created_at.slice(0, 10)} · {formatBytes(row.bytes)} · {row.status ?? 'reviewed'}</Text>
        <View style={styles.row}>
          <Button label={selected.includes(row.id) ? '✓ Selected' : 'Select'} secondary onPress={() => setSelected(list => list.includes(row.id) ? list.filter(id => id !== row.id) : [...list, row.id])} />
          <Button label="Watch" secondary onPress={() => setWatching(row.id)} />
          <Button label="Export" secondary disabled={busy} onPress={() => void run(async (_, store) => { const Sharing = await import('expo-sharing'); if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is not available on this device.'); await Sharing.shareAsync(await store.pathForParent(row.id, parentAllowed), { mimeType: 'video/mp4', dialogTitle: 'Export recording' }); })} />
        </View>
        {watching === row.id && <Player id={row.id} />}
      </View>)}
      <Button label={`Delete selected (${selected.length})`} secondary disabled={busy || !selected.length} onPress={() => confirm('Delete recordings?', `${selected.length} recording(s) will be permanently deleted.`, () => void run(async (_, store) => { const count = await store.delete(selected, parentAllowed); setSelected([]); return `Deleted ${count} recording(s).`; }))} />
      <Button label="Delete all recordings" secondary disabled={busy || !recordings.length} onPress={() => confirm('Delete all recordings?', 'Every recording on this phone will be permanently deleted.', () => void run(async (_, store) => { const count = await store.delete(recordings.map(row => row.id), parentAllowed); setSelected([]); return `Deleted ${count} recording(s).`; }))} />
    </Card>

    <Text style={styles.section}>Settings</Text>
    <Card>
      <Text style={styles.body}>Points reset at midnight in this time zone:</Text>
      <Field label="Time zone (for example America/New_York)" value={timeZone} onChangeText={setTimeZone} autoCapitalize="none" autoCorrect={false} />
      <Button label="Save time zone" secondary disabled={busy || timeZone === settings?.timeZone} onPress={() => void run(async rewards => { await rewards.saveSettings({ timeZone: timeZone.trim() }, parentAllowed); return 'Time zone saved.'; })} />
      <Text style={styles.body}>Salah teaching approach</Text>
      <Text style={styles.caption}>Shown in the Salah guide so your child knows which way your teacher will show the details.</Text>
      {(Object.keys(SALAH_APPROACHES) as SalahApproach[]).map(value => <Button key={value} label={`${settings?.salahApproach === value ? '✓ ' : ''}${SALAH_APPROACHES[value]}`} secondary disabled={busy} onPress={() => void run(async rewards => { await rewards.saveSettings({ salahApproach: value }, parentAllowed); })} />)}
    </Card>
  </Screen>;
}

function ChildCard({ name, summary, busy, onPay, onAdjust, onCorrect }: { name: string; summary?: ChildRewardSummary; busy: boolean; onPay: () => void; onAdjust: (points: number, note: string) => void; onCorrect: (entry: LedgerEntry, points: number) => void }) {
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string>();
  const [value, setValue] = useState('');
  if (!summary) return <Card><Text style={styles.heading}>{name}</Text><Body>Loading…</Body></Card>;
  const today = summary.entries.filter(entry => entry.day === summary.day);
  return <Card>
    <Text style={styles.heading}>{name}</Text>
    <Text style={styles.body}>Today: {summary.todayPoints} / {summary.target} points · reward {formatCents(summary.earnedTodayCents)}</Text>
    <Text style={styles.body}>Unpaid {formatCents(summary.unpaidCents)} · Paid {formatCents(summary.paidCents)} · Waiting {summary.pendingCount}</Text>
    <Button label={`Mark ${formatCents(summary.unpaidCents)} as paid`} disabled={busy || !summary.unpaidCents} onPress={onPay} />
    {today.map(entry => <View key={entry.id} style={styles.line}>
      <Text style={styles.caption}>{entryLabel(entry)} · {entry.status} · {entry.points} pts</Text>
      {editing === entry.id ? <View style={styles.row}><Field label="Correct points (0–100)" value={value} onChangeText={setValue} keyboardType="number-pad" maxLength={3} /><Button label="Save" disabled={busy || !/^\d+$/.test(value)} onPress={() => { onCorrect(entry, Number(value)); setEditing(undefined); }} /></View>
        : entry.status === 'approved' && entry.kind !== 'adjustment' && <Button label="Correct points" secondary onPress={() => { setEditing(entry.id); setValue(String(entry.points)); }} />}
    </View>)}
    <Field label="Add or remove points today (for example 10 or -10)" value={points} onChangeText={setPoints} keyboardType="numbers-and-punctuation" maxLength={4} />
    <Field label="Reason" value={note} onChangeText={setNote} maxLength={80} />
    <Button label="Save adjustment" secondary disabled={busy || !/^-?\d+$/.test(points.trim()) || !note.trim()} onPress={() => { onAdjust(Number(points.trim()), note); setPoints(''); setNote(''); }} />
    {summary.payouts.length > 0 && <Text style={styles.caption}>Payments: {summary.payouts.map(payout => `${payout.paid_at.slice(0, 10)} ${formatCents(payout.amount_cents)}`).join(' · ')}</Text>}
  </Card>;
}

/** Loads a recording path only through the parent-checked store method. */
function Player({ id }: { id: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void (async () => { const store = new RecordingStore(await getDb(), await nativeRecordingFiles()); const path = await store.pathForParent(id, parentAllowed); if (active) setUri(path); })().catch(() => { if (active) setError('This recording could not be opened.'); }); return () => { active = false; }; }, [id]);
  if (error) return <Body>{error}</Body>;
  return uri ? <VideoBox uri={uri} /> : <Body>Opening recording…</Body>;
}
function VideoBox({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <View style={styles.video}><VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" /></View>;
}
const styles = StyleSheet.create({
  section: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 8 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  line: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 6 },
  video: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1d2a24' },
});
