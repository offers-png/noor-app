import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, Field, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { configuredContentConnection } from '../../services/quran/config';
import { searchStoryVideos, STORY_TOPICS, StoryVideoLibrary, type ApprovedVideo, type CheckedVideo, type StoryTopic } from '../../services/videos/StoryVideos';
import { useAppStore } from '../../state/appStore';
import { VideoPlayer } from './VideoPlayer';

const parentAllowed = () => useAppStore.getState().parentUnlocked;
const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Parent searches a trusted channel, watches each video, and approves it for a story topic. */
export default function VideosAdmin({ back }: { back: () => void }) {
  const { settings } = useAppStore();
  const [topic, setTopic] = useState<StoryTopic>('creation');
  const [channel, setChannel] = useState('');
  const [results, setResults] = useState<CheckedVideo[]>([]);
  const [preview, setPreview] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [approved, setApproved] = useState<ApprovedVideo[]>([]);
  const [baseUrl, setBaseUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => { setApproved(await new StoryVideoLibrary(await getDb()).list()); setBaseUrl((await configuredContentConnection())?.url ?? ''); }, []);
  useFocusEffect(useCallback(() => { void reload().catch(() => setMessage('Approved videos could not be loaded.')); }, [reload]));
  const run = async (work: () => Promise<string | void>) => {
    if (busy) return; setBusy(true); setMessage('');
    try { if (!parentAllowed()) throw new Error('Your parent session ended. Enter your PIN again.'); const text = await work(); if (text) setMessage(text); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'That did not work.'); }
    finally { setBusy(false); }
  };
  return <Screen title="Story videos" back={back}>
    <Body>Choose YouTube videos your children can watch inside the app. Search a channel you trust, watch each video yourself, then approve it.</Body>
    <Card><Text style={styles.caption}>The server only shows public, Made for Kids videos of 20 minutes or less. It cannot judge religious accuracy or how prophets are shown. Many families avoid videos that picture prophets; please check this yourself. YouTube may still show ads, and videos need internet.</Text></Card>
    {!settings.networkEnabled && <Card><Text style={styles.body}>Turn on optional network access in Parent Mode to search and play videos.</Text></Card>}
    {!!message && <Card><Text accessibilityRole="alert" style={styles.body}>{message}</Text></Card>}
    <Card>
      <Text style={styles.heading}>Topic</Text>
      <View style={styles.row}>{(Object.keys(STORY_TOPICS) as StoryTopic[]).map(value => <Button key={value} label={`${topic === value ? '✓ ' : ''}${STORY_TOPICS[value]}`} secondary={topic !== value} onPress={() => setTopic(value)} />)}</View>
      <Field label="Trusted YouTube channel (@handle or channel link)" value={channel} onChangeText={setChannel} autoCapitalize="none" autoCorrect={false} />
      <Button label="Search this channel" disabled={busy || !settings.networkEnabled || !channel.trim()} onPress={() => void run(async () => {
        const connection = await configuredContentConnection(); if (!connection) throw new Error('Save your content server address in Content downloads first.');
        const found = await searchStoryVideos(connection.url, topic, channel, () => useAppStore.getState().settings.networkEnabled);
        setResults(found); setPreview(undefined); setConfirmed(false);
        return found.length ? `${found.length} videos passed the checks. Watch before approving.` : 'No suitable videos found for this topic on that channel.';
      })} />
    </Card>
    {results.map(video => <Card key={video.id}>
      <Text style={styles.heading}>{video.title}</Text>
      <Text style={styles.caption}>{video.channelTitle} · {minutes(video.durationSeconds)}</Text>
      {preview === video.id && baseUrl ? <>
        <VideoPlayer id={video.id} baseUrl={baseUrl} />
        <View style={styles.switchRow}><Text style={[styles.body, { flex: 1 }]}>I watched this video. Its teaching, pictures and words suit my children.</Text><Switch accessibilityLabel="Confirm you watched the video" value={confirmed} onValueChange={setConfirmed} /></View>
        <Button label={`Approve for “${STORY_TOPICS[topic]}”`} disabled={busy || !confirmed} onPress={() => void run(async () => { await new StoryVideoLibrary(await getDb()).approve(video, topic, { watchedAndSuitable: confirmed }, parentAllowed); setConfirmed(false); setPreview(undefined); return 'Approved. Your children can watch it in Story Videos.'; })} />
      </> : <Button label="Watch to review" secondary disabled={!settings.networkEnabled || !baseUrl} onPress={() => { setPreview(video.id); setConfirmed(false); }} />}
    </Card>)}
    <Text style={styles.heading}>Approved ({approved.length})</Text>
    {approved.map(video => <Card key={video.id}><Text style={styles.body}>{STORY_TOPICS[video.topic]} · {video.title}</Text><Button label="Remove" secondary disabled={busy} onPress={() => void run(async () => { await new StoryVideoLibrary(await getDb()).remove(video.id, parentAllowed); })} /></Card>)}
  </Screen>;
}
const styles = StyleSheet.create({
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
