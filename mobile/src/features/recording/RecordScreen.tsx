import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Body, Button, Card, Screen, colors } from '../../components/Common/ui';
import { getDb } from '../../services/database/database';
import { canStartRecording, MAX_RECORDING_SECONDS, nativeRecordingFiles, RecordingStore } from '../../services/recordings/RecordingStore';
import { ACTIVITY_RULES, type ActivityKind } from '../../services/rewards/RewardsRepository';
import { ALL_SURAHS } from '../../services/quran/FixtureQuranProvider';
import { sourceReadings } from '../../content/lessons/sourceReadings';
import { quranicDuaFixtures } from '../../content/lessons/quranicDuas';
import { PRAYERS } from '../../content/salah/salahGuide';
import { useAppStore } from '../../state/appStore';

type Item = { kind: ActivityKind; itemRef: string; title: string };
type RecordKind = 'quran_memorization' | 'dua_recitation' | 'hadith_memorization' | 'salah_demonstration' | 'wudu_demonstration';
const KIND_LABELS: Record<RecordKind, string> = { quran_memorization: 'Surah', dua_recitation: 'Dua', hadith_memorization: 'Hadith', salah_demonstration: 'Salah', wudu_demonstration: 'Wudu' };
const isRecordKind = (value: unknown): value is RecordKind => typeof value === 'string' && value in KIND_LABELS;

function itemsFor(kind: RecordKind, query: string): Item[] {
  if (kind === 'quran_memorization') {
    const q = query.trim().toLocaleLowerCase();
    return ALL_SURAHS.filter(surah => q ? `${surah.number} ${surah.name} ${surah.englishName}`.toLocaleLowerCase().includes(q) : surah.availableOffline)
      .slice(0, 12).map(surah => ({ kind, itemRef: String(surah.number), title: `Surah ${surah.name}` }));
  }
  if (kind === 'dua_recitation') return [...sourceReadings('duas').map(record => ({ kind, itemRef: record.id, title: record.title })), ...quranicDuaFixtures.map(dua => ({ kind, itemRef: dua.id, title: `${dua.title} (Qur’an ${dua.verseKey})` }))];
  if (kind === 'hadith_memorization') return sourceReadings('hadith').map(record => ({ kind, itemRef: record.id, title: record.title }));
  if (kind === 'salah_demonstration') return PRAYERS.map(prayer => ({ kind, itemRef: prayer.id, title: `${prayer.name} prayer` }));
  return [{ kind, itemRef: 'wudu', title: 'Wudu demonstration' }];
}

export default function RecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; itemRef?: string; title?: string }>();
  const { selectedChildId, children } = useAppStore();
  const child = children.find(item => item.id === selectedChildId);
  const preset = isRecordKind(params.kind) && params.itemRef ? { kind: params.kind, itemRef: String(params.itemRef), title: String(params.title ?? params.itemRef) } : undefined;
  const [kind, setKind] = useState<RecordKind>(preset?.kind as RecordKind ?? 'quran_memorization');
  const [query, setQuery] = useState('');
  const [item, setItem] = useState<Item | undefined>(preset);
  const [stage, setStage] = useState<'choose' | 'camera' | 'preview' | 'done'>(preset ? 'camera' : 'choose');
  const [captured, setCaptured] = useState<{ uri: string; durationMs: number }>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => itemsFor(kind, query), [kind, query]);
  const capturedRef = useRef<string | undefined>(undefined);
  useEffect(() => { capturedRef.current = captured?.uri; }, [captured]);
  // Unsent recordings are never kept: leaving this screen removes the temporary file.
  useEffect(() => () => { const uri = capturedRef.current; if (uri) void nativeRecordingFiles().then(files => files.remove(uri)).catch(() => {}); }, []);

  if (!child) return <Screen title="Record my recitation"><Body>Choose a child profile in Parent Mode first.</Body></Screen>;
  const discard = async () => { const uri = captured?.uri; setCaptured(undefined); if (uri) { try { (await nativeRecordingFiles()).remove(uri); } catch { /* already gone */ } } };
  const submit = async () => {
    if (!captured || !item || busy) return;
    setBusy(true); setMessage('');
    try {
      const store = new RecordingStore(await getDb(), await nativeRecordingFiles());
      await store.submit({ childId: child.id, kind: item.kind, itemRef: item.itemRef, title: item.title, tempUri: captured.uri, durationMs: captured.durationMs });
      capturedRef.current = undefined; setCaptured(undefined); setStage('done');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The recording could not be sent. Please try again.'); }
    finally { setBusy(false); }
  };

  if (stage === 'choose') return <Screen title="Record my recitation">
    <Body>{`${child.avatar} ${child.nickname}, choose what you will show your parent.`}</Body>
    <View style={styles.row}>{(Object.keys(KIND_LABELS) as RecordKind[]).map(value => <Button key={value} label={`${kind === value ? '✓ ' : ''}${KIND_LABELS[value]}`} secondary={kind !== value} onPress={() => { setKind(value); setQuery(''); }} />)}</View>
    {kind === 'quran_memorization' && <TextInput accessibilityLabel="Find a surah" placeholder="Find a surah by name or number" value={query} onChangeText={setQuery} style={styles.search} placeholderTextColor={colors.muted} />}
    {items.map(option => <Button key={`${option.kind}:${option.itemRef}`} label={option.title} secondary onPress={() => { setItem(option); setStage('camera'); setMessage(''); }} />)}
    <Text style={styles.caption}>{ACTIVITY_RULES[kind].points} points when your parent approves. Your video stays on this phone.</Text>
  </Screen>;
  if (stage === 'done') return <Screen title="Sent to your parent">
    <Card><Text style={styles.heading}>MashaAllah!</Text><Text style={styles.body}>{`Your recording of ${item?.title} is waiting for your parent. Points are added when they approve it.`}</Text></Card>
    <Button label="Record something else" onPress={() => { setItem(undefined); setStage('choose'); }} />
    <Button label="See my points" secondary onPress={() => router.replace('/rewards')} />
  </Screen>;
  if (stage === 'preview' && captured) return <Screen title="Watch your recording" back={() => { void discard(); setStage('camera'); }}>
    <Preview uri={captured.uri} />
    <Text style={styles.caption}>{item?.title} · {Math.round(captured.durationMs / 1000)} seconds</Text>
    {!!message && <Body>{message}</Body>}
    <Button label={busy ? 'Sending…' : 'Send to my parent for review'} disabled={busy} onPress={() => void submit()} />
    <Button label="Record again" secondary disabled={busy} onPress={() => { void discard(); setStage('camera'); }} />
  </Screen>;
  return <Screen title={item?.title ?? 'Record'} back={() => { setStage('choose'); setMessage(''); }}>
    <Recorder onCaptured={(uri, durationMs) => { setCaptured({ uri, durationMs }); setStage('preview'); }} onMessage={setMessage} />
    {!!message && <Body>{message}</Body>}
  </Screen>;
}

/** Live camera preview. Mounted only on this screen and released when the app leaves the foreground. */
function Recorder({ onCaptured, onMessage }: { onCaptured: (uri: string, durationMs: number) => void; onMessage: (text: string) => void }) {
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [microphonePermission, requestMicrophone] = useMicrophonePermissions();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const camera = useRef<CameraView>(null);
  const interrupted = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (!active && camera.current) { interrupted.current = true; camera.current.stopRecording(); }
      setForeground(active);
    });
    // Leaving the screen unmounts the camera, which ends any recording; its file is then discarded.
    return () => { listener.remove(); interrupted.current = true; };
  }, []);
  useEffect(() => { if (!recording) return; const timer = setInterval(() => setSeconds(value => value + 1), 1000); return () => clearInterval(timer); }, [recording]);
  if (!cameraPermission || !microphonePermission) return <Body>Checking camera permission…</Body>;
  if (!cameraPermission.granted || !microphonePermission.granted) {
    const blocked = (!cameraPermission.granted && !cameraPermission.canAskAgain) || (!microphonePermission.granted && !microphonePermission.canAskAgain);
    return <Card><Text style={styles.heading}>Camera and microphone</Text><Text style={styles.body}>To record your recitation, the app needs the camera and microphone. They only turn on while you are on this screen, and the video stays on this phone.</Text>
      {blocked ? <><Text style={styles.body}>Ask a parent to allow the camera and microphone for Kids Islam in the phone’s Settings.</Text><Button label="Open phone settings" secondary onPress={() => void Linking.openSettings()} /></>
        : <Button label="Allow camera and microphone" onPress={() => void (async () => { if (!cameraPermission.granted) await requestCamera(); if (!microphonePermission.granted) await requestMicrophone(); })()} />}
    </Card>;
  }
  const start = async () => {
    if (!camera.current || recording || !ready) return;
    const files = await nativeRecordingFiles();
    const space = canStartRecording(files);
    if (!space.ok) { onMessage(space.reason); return; }
    interrupted.current = false; onMessage(''); setSeconds(0); setRecording(true);
    const startedAt = Date.now();
    try {
      const result = await camera.current.recordAsync({ maxDuration: MAX_RECORDING_SECONDS });
      if (interrupted.current) { if (result?.uri) files.remove(result.uri); onMessage('Recording stopped because the app was closed. Please record again.'); return; }
      if (!result?.uri) { onMessage('The recording did not save. Please try again.'); return; }
      onCaptured(result.uri, Date.now() - startedAt);
    } catch { onMessage('The camera could not record. Close other camera apps and try again.'); }
    finally { setRecording(false); }
  };
  return <View style={{ gap: 12 }}>
    <View style={styles.cameraBox}>{foreground && <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mode="video" mute={false} active={foreground} onCameraReady={() => setReady(true)} onMountError={() => onMessage('The camera could not start. Close other camera apps and try again.')} />}</View>
    <Text style={styles.caption}>{recording ? `Recording… ${seconds}s (up to ${MAX_RECORDING_SECONDS / 60} minutes)` : 'Recite from memory. Tap stop when you finish.'}</Text>
    {recording ? <Button label="■ Stop" onPress={() => camera.current?.stopRecording()} /> : <Button label="● Record My Recitation" disabled={!ready} onPress={() => void start()} />}
  </View>;
}

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <View style={styles.cameraBox}><VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" /></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: { borderWidth: 1, borderColor: '#94a58b', minHeight: 52, padding: 14, borderRadius: 14, fontSize: 17, color: colors.ink, backgroundColor: '#fffdf6' },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1d2a24' },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  body: { fontSize: 17, lineHeight: 26, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
});
