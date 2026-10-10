import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { configuredContentConnection } from '../../services/quran/config';
import { stillPermitted, STORY_TOPICS, StoryVideoLibrary, type ApprovedVideo } from '../../services/videos/StoryVideos';
import { useAppStore } from '../../state/appStore';
import { VideoPlayer } from './VideoPlayer';

/** Child view: only parent-approved videos, re-checked with YouTube before each play. */
export default function StoryVideosScreen() {
  const { settings } = useAppStore();
  const [videos, setVideos] = useState<ApprovedVideo[]>([]);
  const [baseUrl, setBaseUrl] = useState('');
  const [playing, setPlaying] = useState<ApprovedVideo>();
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => { const list = await new StoryVideoLibrary(await getDb()).list(); const connection = await configuredContentConnection(); if (active) { setVideos(list); setBaseUrl(connection?.url ?? ''); } })().catch(() => { if (active) setMessage('Videos could not be loaded.'); });
    return () => { active = false; };
  }, []));
  const play = async (video: ApprovedVideo) => {
    setMessage(''); setChecking(true);
    try {
      if (!baseUrl) throw new Error('Ask your parent to set up videos.');
      if (!await stillPermitted(baseUrl, video.id, () => useAppStore.getState().settings.networkEnabled)) throw new Error('This video is not available right now. Ask your parent to choose another.');
      setPlaying(video);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The video could not start.'); }
    finally { setChecking(false); }
  };
  if (!settings.networkEnabled) return <Screen title="Story videos"><Card><Text style={styles.body}>Videos need the internet. Ask your parent to turn it on in Parent Mode.</Text></Card></Screen>;
  if (playing) return <Screen title={playing.title} back={() => setPlaying(undefined)}>
    <VideoPlayer id={playing.id} baseUrl={baseUrl} />
    <Text style={styles.caption}>{STORY_TOPICS[playing.topic]} · {playing.channelTitle}</Text>
    <Body>Watch with your family and talk about what you learned.</Body>
  </Screen>;
  const topics = [...new Set(videos.map(video => video.topic))];
  return <Screen title="Story videos">
    {!videos.length && <Card><Text style={styles.body}>Your parent has not added any story videos yet.</Text></Card>}
    {!!message && <Body>{message}</Body>}
    {topics.map(topic => <Card key={topic}>
      <Text style={styles.heading}>{STORY_TOPICS[topic]}</Text>
      {videos.filter(video => video.topic === topic).map(video => <Button key={video.id} label={`▶ ${video.title}`} secondary disabled={checking} onPress={() => void play(video)} />)}
    </Card>)}
  </Screen>;
}
const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 17, lineHeight: 26, color: colors.ink },
  caption: { fontSize: 14, color: colors.muted },
});
