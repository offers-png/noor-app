import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import * as Speech from 'expo-speech';

/** For original teaching instructions and letter names only. Never use for Quran recitation. */
export function NarrationButton({ text, language = 'en', label = '▶ Listen', enabled = true }: { text: string; language?: string; label?: string; enabled?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { void Speech.stop(); }, []);
  useEffect(() => { if (!enabled) { void Speech.stop().then(() => setSpeaking(false)); } }, [enabled]);
  const narrate = async () => {
    await Speech.stop();
    if (speaking) { setSpeaking(false); return; }
    setError('');
    Speech.speak(text, { language, rate: 0.8, pitch: 1, onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false),
      onError: () => { setSpeaking(false); setError('Voice unavailable. You can read the instructions.'); } });
  };
  return <><Pressable accessibilityRole="button" accessibilityLabel={speaking ? 'Stop narration' : label}
    disabled={!enabled} accessibilityState={{ disabled: !enabled }}
    onPress={() => { void narrate(); }} style={{ backgroundColor: '#226345', minHeight: 48, borderRadius: 14, padding: 14, alignItems: 'center', opacity: enabled ? 1 : 0.5 }}>
    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{!enabled ? 'Audio is off · Ask a parent' : speaking ? '■ Stop' : label}</Text>
  </Pressable>{!!error && <Text accessibilityRole="alert" style={{ color: '#6e4123', marginTop: 8 }}>{error}</Text>}</>;
}
