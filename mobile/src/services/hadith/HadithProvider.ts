import type { HadithRecord } from '../../types/lessons';

export interface HadithCollection { id: string; title: string; arabicTitle: string; available: number }
export interface HadithProvider {
  readonly kind: 'sunnah' | 'development';
  getCollections(): Promise<HadithCollection[]>;
  getHadith(collection: string, number: string): Promise<HadithRecord>;
}
export class HadithProviderError extends Error {
  constructor(message: string, public readonly code: 'configuration' | 'network_disabled' | 'network' | 'http' | 'invalid_response' | 'not_found', public readonly status?: number) {
    super(message); this.name = 'HadithProviderError';
  }
}
