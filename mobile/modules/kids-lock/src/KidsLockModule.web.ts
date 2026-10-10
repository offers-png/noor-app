import { registerWebModule, NativeModule } from 'expo';

// Lock task mode exists only on Android; the web preview never locks.
class KidsLockModule extends NativeModule<Record<string, never>> {
  getState() { return 'none' as const; }
  isDeviceOwner() { return false; }
  async start() {}
  async stop() {}
  async releaseDeviceOwner() {}
}

export default registerWebModule(KidsLockModule, 'KidsLockModule');
