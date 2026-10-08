import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AudioControls, type AudioTrack } from '../../services/audio/AudioControls';
import { buildRepeatPlan, canPlayTrack } from '../../services/audio/AudioEngine';
import { advancePlan, initialPlanCursor } from './logic';

/** Individual ayahs are practiced first, followed by the complete range together. */
export function RepeatPlanPlayer({ tracks, networkAllowed = false, audioEnabled = true }: {
  tracks: AudioTrack[]; networkAllowed?: boolean; audioEnabled?: boolean;
}) {
  const plan = useMemo(() => buildRepeatPlan(tracks.map(track => track.id), 5, 3, 2), [tracks]);
  const [cursor, setCursor] = useState(initialPlanCursor);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const step = plan[cursor.step];
  const current = step && tracks.find(track => track.id === step.trackIds[cursor.track]);
  const available = audioEnabled && tracks.length > 0 && tracks.every(track => canPlayTrack(track, networkAllowed));
  const finish = () => {
    setWaiting(true);
    timer.current = setTimeout(() => {
      setCursor(value => advancePlan(plan, value));
      setWaiting(false);
    }, step.pauseMs);
  };
  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setStarted(false);
    setWaiting(false);
    setCursor(initialPlanCursor);
  };
  return <View style={{ gap: 12, padding: 16, backgroundColor: '#edf3e9', borderRadius: 20 }}>
    <Text style={{ color: '#203d30', fontSize: 20, fontWeight: '700' }}>Practice a range together</Text>
    <Text style={{ color: '#425b4b', fontSize: 16, lineHeight: 24 }}>Each ayah five times, then the whole range three times. Pause two seconds between recordings.</Text>
    {!started ? <Pressable accessibilityRole="button" disabled={!available} onPress={() => setStarted(true)}
      style={{ minHeight: 48, backgroundColor: '#226345', opacity: available ? 1 : 0.5, padding: 14, borderRadius: 14 }}>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>▶ Start range practice</Text>
    </Pressable> : cursor.finished ? <Text style={{ color: '#203d30', fontSize: 18 }}>Great work! Your range practice is complete.</Text>
      : <>
        <Text accessibilityLiveRegion="polite" style={{ color: '#203d30', fontSize: 16 }}>
          Step {cursor.step + 1} of {plan.length} · Round {cursor.iteration + 1} of {step.repetitions}
          {waiting ? ' · Pause…' : ''}
        </Text>
        {current && <AudioControls key={`${cursor.step}-${cursor.track}-${cursor.iteration}`} tracks={[current]} networkAllowed={networkAllowed}
          audioEnabled={audioEnabled} autoPlay repeat={1} pauseSeconds={2} onFinished={finish} />}
      </>}
    {!available && <Text style={{ color: '#52634c', fontSize: 15 }}>Ask a parent to enable audio and make every recording in this range available.</Text>}
    {started && <Pressable accessibilityRole="button" onPress={reset} style={{ minHeight: 48, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#718473' }}>
      <Text style={{ color: '#203d30', fontSize: 17 }}>Stop / Reset range</Text>
    </Pressable>}
  </View>;
}
