import type { Ayah, ResourceSnapshot, Surah, SyncPage } from '../../types/quran';

export interface QuranProvider {
  readonly id: string;
  chapters(): Promise<Surah[]>;
  verses(surahNumber: number): Promise<Ayah[]>;
  verse(key: string): Promise<Ayah | null>;
}
export interface QuranSyncProvider {
  readonly environment: string;
  sync(path: string): Promise<SyncPage>;
  snapshot(path: string): Promise<ResourceSnapshot>;
}
export class QuranProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly code?: string) { super(message); this.name = 'QuranProviderError'; }
}
