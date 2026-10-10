import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, colors } from '../../components/Common/ui';
import { kidsLock, type LockState } from '../../services/parent/kidsLock';
import { useAppStore } from '../../state/appStore';

const STATE_TEXT: Record<LockState, string> = {
  locked: 'Locked: Kids Islam is the only app that can be used. Only your parent PIN releases it.',
  pinned: 'Pinned: the phone stays in Kids Islam. Leaving needs the phone’s own lock-screen PIN (see step 2).',
  none: 'Not holding the screen right now.',
  unsupported: 'This build cannot lock the screen. Install the Kids Islam APK (not Expo Go) on an Android phone.',
};

/** Parent controls for keeping a child inside the app. */
export function KidsLockCard({ run }: { run: (work: () => Promise<void>) => Promise<void> }) {
  const { settings, updateSettings, setLockSuspended, lockSuspended } = useAppStore();
  const [state, setState] = useState<LockState>(kidsLock.state());
  const [dedicated, setDedicated] = useState(kidsLock.dedicatedDevice());
  const refresh = useCallback(() => { setState(kidsLock.state()); setDedicated(kidsLock.dedicatedDevice()); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  return <Card>
    <Text style={{ fontSize: 20, color: colors.ink }}>Lock the phone to Kids Islam</Text>
    <Body>When on, the phone stays in this app from the moment it opens. Your child can use every lesson but cannot go to other apps. You release it with your parent PIN here.</Body>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Body>Keep the phone in Kids Islam</Body>
      <Switch accessibilityLabel="Keep the phone in Kids Islam" value={settings.kidsLock} onValueChange={enabled => void run(async () => {
        await updateSettings({ kidsLock: enabled });
        if (!enabled) await kidsLock.release();
        else { setLockSuspended(false); await kidsLock.hold(); }
        refresh();
      })} />
    </View>
    <Body>{lockSuspended && settings.kidsLock ? 'Paused by you. It locks again when you tap Enter Kids Mode.' : STATE_TEXT[state]}</Body>
    {settings.kidsLock && state !== 'none' && state !== 'unsupported' && <Button label="Let the phone leave the app (until Kids Mode)" secondary onPress={() => void run(async () => { setLockSuspended(true); await kidsLock.release(); refresh(); })} />}
    {settings.kidsLock && state === 'none' && !lockSuspended && <Button label="Lock now" secondary onPress={() => void run(async () => { await kidsLock.hold(); refresh(); })} />}
    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>Set up once</Text>
    <Body>1. In Android Settings, search “App pinning” (or “Pin windows”) and turn it on. The first time the app locks, tap “Got it” or “Pin”.</Body>
    <Body>2. In the same setting, turn on “Ask for PIN before unpinning” and use a phone PIN your child does not know. Without this, a child who knows the button gesture can leave.</Body>
    <Body>For a phone used only by your child, you can make the lock complete, so only your Kids Islam parent PIN can release it. A computer with Android platform tools is needed once. See the guide in the app’s documentation (Dedicated device mode).</Body>
    {dedicated && <>
      <Body>Dedicated device mode is on.</Body>
      <Button label="Turn off dedicated device mode" secondary onPress={() => Alert.alert('Turn off dedicated device mode?', 'The phone will use normal app pinning again, and Kids Islam can be uninstalled.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Turn off', style: 'destructive', onPress: () => void run(async () => { await kidsLock.releaseDedicatedDevice(); refresh(); }) }])} />
    </>}
  </Card>;
}
