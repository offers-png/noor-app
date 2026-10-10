import { NativeModule, requireNativeModule } from 'expo';

export type LockState = 'none' | 'pinned' | 'locked';
declare class KidsLockModule extends NativeModule<Record<string, never>> {
  getState(): LockState;
  isDeviceOwner(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  releaseDeviceOwner(): Promise<void>;
}

export default requireNativeModule<KidsLockModule>('KidsLock');
