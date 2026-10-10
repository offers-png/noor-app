import { Platform } from 'react-native';

export type LockState = 'none' | 'pinned' | 'locked' | 'unsupported';
export interface KidsLockNative { getState(): 'none' | 'pinned' | 'locked'; isDeviceOwner(): boolean; start(): Promise<void>; stop(): Promise<void>; releaseDeviceOwner(): Promise<void> }

let native: KidsLockNative | null | undefined;
function load(): KidsLockNative | null {
  if (native !== undefined) return native;
  // A static import would crash Expo Go, which lacks this native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try { native = Platform.OS === 'android' ? (require('../../../modules/kids-lock/src/KidsLockModule').default as KidsLockNative) : null; }
  catch { native = null; } // Expo Go or a build without the module: locking is unavailable, never a crash.
  return native;
}

export { shouldHoldScreen } from './lockPolicy';

export const kidsLock = {
  available(): boolean { return !!load(); },
  state(): LockState { const lock = load(); if (!lock) return 'unsupported'; try { return lock.getState(); } catch { return 'unsupported'; } },
  dedicatedDevice(): boolean { try { return load()?.isDeviceOwner() ?? false; } catch { return false; } },
  /** Pins the app (asks once) or, on a dedicated device, locks it silently. */
  async hold(): Promise<LockState> {
    const lock = load(); if (!lock) return 'unsupported';
    if (lock.getState() === 'none') await lock.start();
    return lock.getState();
  },
  async release(): Promise<void> { const lock = load(); if (lock && lock.getState() !== 'none') await lock.stop(); },
  async releaseDedicatedDevice(): Promise<void> { await load()?.releaseDeviceOwner(); },
};
