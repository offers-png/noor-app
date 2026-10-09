import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Body, Button, Card, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { ACTIVITY_RULES, formatCents, RewardsRepository, type ChildRewardSummary, type LedgerEntry } from '../../services/rewards/RewardsRepository';
import { useAppStore } from '../../state/appStore';

const STATUS: Record<LedgerEntry['status'], string> = { approved: '✓ Verified', pending: '⏳ Waiting for parent', retry: '↺ Try again', rejected: '— Not counted' };
export function entryLabel(entry: LedgerEntry): string {
  return entry.kind === 'adjustment' ? 'Parent adjustment' : `${ACTIVITY_RULES[entry.kind]?.label ?? entry.kind}: ${entry.title}`;
}

/** The selected child's own points. Read-only: children cannot approve, edit or pay. */
export default function RewardsScreen() {
  const router = useRouter();
  const { children, selectedChildId } = useAppStore();
  const child = children.find(item => item.id === selectedChildId);
  const [summary, setSummary] = useState<ChildRewardSummary>();
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    if (selectedChildId) void getDb().then(db => new RewardsRepository(db).summary(selectedChildId)).then(value => { if (active) setSummary(value); }).catch(() => { if (active) setError('Your points could not be loaded.'); });
    return () => { active = false; };
  }, [selectedChildId]));
  if (!child) return <Screen title="My rewards"><Body>Choose a child profile in Parent Mode first.</Body></Screen>;
  if (!summary) return <Screen title="My rewards"><Body>{error || 'Loading your points…'}</Body></Screen>;
  const percent = Math.min(100, Math.round(summary.todayPoints / summary.target * 100));
  const today = summary.entries.filter(entry => entry.day === summary.day);
  const earlier = summary.entries.filter(entry => entry.day !== summary.day).slice(0, 30);
  return <Screen title={`${child.avatar} ${child.nickname}’s rewards`}>
    <Card>
      <Text style={styles.label}>TODAY</Text>
      <Text accessibilityLabel={`Today's points ${summary.todayPoints} of ${summary.target}`} style={styles.big}>{summary.todayPoints} / {summary.target}</Text>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
      <Text style={styles.body}>{summary.remaining > 0 ? `${summary.remaining} more points to reach today’s goal.` : 'MashaAllah! You reached today’s goal.'}</Text>
      <Text style={styles.body}>Today’s reward: {formatCents(summary.earnedTodayCents)}</Text>
      {summary.pendingCount > 0 && <Text style={styles.caption}>{summary.pendingCount} recording{summary.pendingCount === 1 ? '' : 's'} waiting for your parent.</Text>}
    </Card>
    <View style={styles.row}>
      <Card><Text style={styles.label}>NOT PAID YET</Text><Text style={styles.medium}>{formatCents(summary.unpaidCents)}</Text></Card>
      <Card><Text style={styles.label}>PAID BY PARENT</Text><Text style={styles.medium}>{formatCents(summary.paidCents)}</Text></Card>
    </View>
    <Button label="● Record my recitation" onPress={() => router.push('/record')} />
    <Card>
      <Text style={styles.heading}>How to earn points</Text>
      {Object.values(ACTIVITY_RULES).map(rule => <Text key={rule.label} style={styles.caption}>{rule.label}: {rule.points} points{rule.verification === 'parent' ? ' · parent checks your video' : ''}</Text>)}
      <Text style={styles.caption}>100 verified points in one day = $1, once a day. Points start again at midnight.</Text>
    </Card>
    <Card><Text style={styles.heading}>Today</Text>{today.length ? today.map(entry => <Line key={entry.id} entry={entry} />) : <Text style={styles.caption}>Nothing yet today. Let’s learn something!</Text>}</Card>
    {earlier.length > 0 && <Card><Text style={styles.heading}>Earlier</Text>{earlier.map(entry => <Line key={entry.id} entry={entry} showDay />)}</Card>}
  </Screen>;
}
function Line({ entry, showDay = false }: { entry: LedgerEntry; showDay?: boolean }) {
  return <View style={styles.line}><Text style={styles.body}>{showDay ? `${entry.day} · ` : ''}{entryLabel(entry)}</Text><Text style={styles.caption}>{STATUS[entry.status]} · {entry.status === 'approved' ? `${entry.points > 0 ? '+' : ''}${entry.points}` : entry.points} points{entry.note ? ` · ${entry.note}` : ''}</Text></View>;
}
const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.green },
  big: { fontSize: 44, fontWeight: '800', color: colors.ink },
  medium: { fontSize: 28, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
  track: { height: 18, borderRadius: 9, backgroundColor: '#e8edde', overflow: 'hidden' },
  fill: { height: 18, backgroundColor: colors.green },
  row: { gap: 12 },
  line: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
});
