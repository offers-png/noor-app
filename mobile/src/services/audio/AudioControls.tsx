import { useEffect, useReducer, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { audioReducer, canPlayTrack, initialAudioSession, type AudioTrack, type RepeatCount } from './AudioEngine';

export type { AudioTrack, RepeatCount } from './AudioEngine';

export interface AudioControlsProps {
  tracks: AudioTrack[];
  networkAllowed?: boolean;
  audioEnabled?: boolean;
  initialIndex?: number;
  repeat?: RepeatCount;
  pauseSeconds?: number;
  autoPlay?: boolean;
  continuous?: boolean;
  onTrackChange?: (index: number) => void;
  onFinished?: () => void;
  onPositionChange?: (seconds: number, playing: boolean) => void;
}

function Control({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

export function AudioControls({ tracks, networkAllowed = false, audioEnabled = true, initialIndex = 0, repeat = 1,
  pauseSeconds = 2, autoPlay = false, continuous = false, onTrackChange, onFinished, onPositionChange }: AudioControlsProps) {
  const [session, dispatch] = useReducer(audioReducer, { ...initialAudioSession, trackIndex: initialIndex });
  const [repeatOverride, setRepeatCount] = useState<RepeatCount>();
  const [gapOverride, setGap] = useState<number>();
  const [continuousOverride, setContinuous] = useState<boolean>();
  const repeatCount = repeatOverride ?? repeat;
  const gap = gapOverride ?? pauseSeconds;
  const continuousPlay = continuousOverride ?? continuous;
  const track = tracks[session.trackIndex];
  const allowed = audioEnabled && canPlayTrack(track, networkAllowed);
  // Keep one native player/media service across ayahs. Load sources only after consent checks.
  const source = allowed ? track?.asset ?? track?.uri ?? null : null;
  // The polling option is also a lifecycle dependency: revoking availability releases
  // the previous native player and its buffered remote source instead of merely pausing it.
  const player = useAudioPlayer(null, { updateInterval: allowed ? 250 : 500 });
  const status = useAudioPlayerStatus(player);
  const finishedCallback = useRef(onFinished);
  const positionCallback = useRef(onPositionChange);
  const operation = useRef(0);
  const autoStarted = useRef(false);
  const lastFinished = useRef(-1);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { finishedCallback.current = onFinished; }, [onFinished]);
  useEffect(() => { positionCallback.current = onPositionChange; }, [onPositionChange]);
  useEffect(() => { positionCallback.current?.(status.currentTime, status.playing); }, [status.currentTime, status.playing]);
  useEffect(() => {
    operation.current += 1;
    player.pause();
    // Expo's Android replace implementation expects a source record, even though
    // the public AudioSource union includes null. The empty hook handles no-source states.
    if (source !== null) player.replace(source);
  }, [player, source]);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true,
      interruptionMode: 'doNotMix', allowsRecording: false }).catch(() => {
      dispatch({ type: 'error', message: 'Audio could not start. Try again.' });
    });
  }, []);

  useEffect(() => {
    if (!allowed) {
      operation.current += 1;
      player.pause();
      if (Platform.OS !== 'web') player.setActiveForLockScreen(false);
      dispatch({ type: 'pause' });
    }
  }, [allowed, player]);

  useEffect(() => {
    if (status.didJustFinish) dispatch({ type: 'finish', repeat: repeatCount, continuous: continuousPlay, total: tracks.length });
  }, [status.didJustFinish, repeatCount, continuousPlay, tracks.length]);

  useEffect(() => {
    const current = sessionRef.current;
    // Media-session controls act directly on the native player, bypassing our buttons.
    if (status.playing && (current.phase === 'paused' || current.phase === 'idle' || current.phase === 'complete' || current.phase === 'error')) {
      if (current.phase === 'paused' && current.pausedFrom === 'advancing') {
        player.pause();
        dispatch({ type: 'play' });
      } else dispatch({ type: 'native-play' });
    } else if (!status.playing && current.phase === 'playing' && status.isLoaded && !status.isBuffering
      && !status.didJustFinish && status.duration > 0 && status.currentTime < status.duration - 0.05) {
      operation.current += 1;
      dispatch({ type: 'pause' });
    }
  }, [status.playing, status.isLoaded, status.isBuffering, status.didJustFinish, status.currentTime, status.duration, player]);

  useEffect(() => {
    if (session.phase === 'complete' && lastFinished.current !== operation.current) {
      lastFinished.current = operation.current;
      finishedCallback.current?.();
    }
    if (session.phase !== 'waiting' && session.phase !== 'advancing') return;
    const generation = operation.current;
    const timer = setTimeout(() => {
      if (operation.current !== generation || sessionRef.current.phase !== session.phase) return;
      if (session.phase === 'advancing') {
        dispatch({ type: 'advance', total: tracks.length });
        onTrackChange?.(session.trackIndex + 1);
        return;
      }
      player.seekTo(0).then(() => {
        if (operation.current !== generation || sessionRef.current.phase !== 'waiting') return;
        dispatch({ type: 'play' });
        player.play();
      }).catch(() => dispatch({ type: 'error', message: 'Could not repeat this audio. Try replay.' }));
    }, Math.max(0, Math.min(gap, 30)) * 1000);
    return () => clearTimeout(timer);
  }, [session.phase, session.trackIndex, gap, player, tracks.length, onTrackChange]);

  useEffect(() => {
    if (session.phase !== 'loading' || !allowed || !status.isLoaded) return;
    try {
      if (Platform.OS !== 'web') player.setActiveForLockScreen(true, {
        title: track.title, artist: track.sourceLabel ?? 'Kids Islam learning', albumTitle: 'Kids Islam',
      });
      dispatch({ type: 'play' });
      player.play();
    } catch { dispatch({ type: 'error', message: 'The next recording could not start. Try again.' }); }
  }, [session.phase, allowed, status.isLoaded, player, track]);

  useEffect(() => {
    if (!autoPlay || !allowed || !status.isLoaded || autoStarted.current) return;
    autoStarted.current = true;
    if (Platform.OS !== 'web') player.setActiveForLockScreen(true, {
      title: track.title, artist: track.sourceLabel ?? 'Kids Islam learning', albumTitle: 'Kids Islam',
    });
    dispatch({ type: 'play' });
    player.play();
  }, [autoPlay, allowed, status.isLoaded, player, track]);

  useEffect(() => () => {
    operation.current += 1;
    // useAudioPlayer releases its native object before later effect cleanups.
    // Release stops playback; calling methods here can touch an already released player.
  }, [player]);

  const play = async (restart = false) => {
    if (!allowed) return;
    const generation = ++operation.current;
    try {
      if (!restart && !status.error && session.phase === 'paused' && session.pausedFrom) {
        dispatch({ type: 'play' });
        return;
      }
      if (status.error) player.replace(track.asset ?? track.uri ?? null);
      else if (restart || session.phase === 'complete' || (status.duration > 0 && status.currentTime >= status.duration - 0.05)) {
        await player.seekTo(0);
      }
      if (operation.current !== generation) return;
      if (Platform.OS !== 'web') player.setActiveForLockScreen(true, {
        title: track.title, artist: track.sourceLabel ?? 'Kids Islam learning', albumTitle: 'Kids Islam',
      });
      dispatch({ type: restart || session.phase === 'complete' ? 'restart' : 'play' });
      player.play();
    } catch {
      dispatch({ type: 'error', message: 'This audio is unavailable. Ask a parent to check the download.' });
    }
  };
  const pause = () => {
    operation.current += 1;
    player.pause();
    dispatch({ type: 'pause' });
  };
  const move = (index: number) => {
    if (index < 0 || index >= tracks.length) return;
    operation.current += 1;
    player.pause();
    dispatch({ type: 'move', index, total: tracks.length });
    onTrackChange?.(index);
  };
  const changeRepeat = (count: RepeatCount) => {
    pause();
    dispatch({ type: 'move', index: session.trackIndex, total: tracks.length });
    void player.seekTo(0).catch(() => undefined);
    setRepeatCount(count);
  };
  const changeContinuous = () => {
    pause();
    dispatch({ type: 'move', index: session.trackIndex, total: tracks.length });
    setContinuous(!continuousPlay);
  };
  const active = !status.error && (status.playing || session.phase === 'waiting' || session.phase === 'advancing' || session.phase === 'loading');

  return <View style={styles.card}>
    <Text style={styles.heading}>{track?.title ?? 'Listen'}</Text>
    {track?.sourceLabel && <Text style={styles.caption}>Recitation: {track.sourceLabel}</Text>}
    {!allowed && <Text accessibilityRole="alert" style={styles.caption}>
      {!audioEnabled ? 'Audio is off. Ask a parent to enable listening.' : track?.uri ? 'Ask a parent to download this audio or enable online listening.' : 'No recording is available for this item yet.'}
    </Text>}
    <View style={styles.row}>
      {tracks.length > 1 && <Control label="‹ Previous" disabled={session.trackIndex === 0} onPress={() => move(session.trackIndex - 1)} />}
      <Control label={active ? 'Pause' : status.error ? 'Retry audio' : '▶ Play'} disabled={!allowed}
        onPress={active ? pause : () => { void play(); }} />
      <Control label="↻ Replay" disabled={!allowed} onPress={() => { void play(true); }} />
      {tracks.length > 1 && <Control label="Next ›" disabled={session.trackIndex === tracks.length - 1} onPress={() => move(session.trackIndex + 1)} />}
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.caption}>
      {session.error ?? (status.error ? 'This recording could not be loaded. Try again, or ask a parent to check its download.' : session.phase === 'waiting' || session.phase === 'advancing' ? `Pause for ${gap} seconds${session.phase === 'advancing' ? ' before the next ayah' : ''}…` : session.phase === 'complete'
        ? 'Listening complete. Great work!' : status.isBuffering ? 'Loading recording…'
        : `${Math.floor(status.currentTime)} / ${Math.floor(status.duration)} seconds`)}
    </Text>
    {tracks.length > 1 && <Pressable accessibilityRole="checkbox" accessibilityState={{checked:continuousPlay}}
      onPress={changeContinuous} style={[styles.choice, continuousPlay && styles.selected]}>
      <Text style={styles.choiceText}>{continuousPlay ? '✓ ' : ''}Continue to next ayah</Text>
    </Pressable>}
    <Text style={styles.label}>Repeat each ayah</Text>
    <View style={styles.row}>{([1, 3, 5, 10, 'unlimited'] as const).map(count =>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: repeatCount === count }} key={count}
        onPress={() => changeRepeat(count)} style={[styles.choice, repeatCount === count && styles.selected]}>
        <Text style={styles.choiceText}>{count === 'unlimited' ? '∞' : `${count}×`}</Text>
      </Pressable>)}</View>
    <Text style={styles.label}>Pause between repeats</Text>
    <View style={styles.row}>{[0, 2, 5].map(seconds =>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: gap === seconds }} key={seconds}
        onPress={() => setGap(seconds)} style={[styles.choice, gap === seconds && styles.selected]}>
        <Text style={styles.choiceText}>{seconds}s</Text>
      </Pressable>)}</View>
    {session.repetitions > 0 && <Text style={styles.caption}>Completed {session.repetitions} repetition{session.repetitions === 1 ? '' : 's'}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#edf3e9', padding: 16, borderRadius: 20, gap: 10 },
  heading: { fontSize: 19, fontWeight: '700', color: '#203d30' },
  caption: { color: '#425b4b', fontSize: 15, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600', color: '#203d30' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 14, backgroundColor: '#226345', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  choice: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#718473', paddingHorizontal: 14 },
  selected: { borderColor: '#226345', borderWidth: 2, backgroundColor: '#d7e8ce' },
  choiceText: { color: '#203d30', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.45 },
});
