export interface QuranSource {
  name: string;
  reference: string;
  url: string;
  license: string;
  version: string;
  verifiedAt: string;
  translator?: string;
}

export interface Surah {
  number: number;
  arabicName: string;
  name: string;
  englishName: string;
  revelationType: string;
  ayahCount: number;
  availableOffline: boolean;
  source?: QuranSource;
}

export interface QuranTextLayer { text: string; source: QuranSource }
export interface QuranWord {
  id: string;
  position: number;
  canonicalText: string;
  translation?: QuranTextLayer;
  transliteration?: QuranTextLayer;
  audioUrl?: string;
  source: QuranSource;
}
export interface QuranWordTiming { position: number; startMs: number; endMs: number }
export interface QuranAudio { url: string; reciter: string; source: QuranSource; localUri?: string; downloadId?:string; wordTimings?:QuranWordTiming[] }
export interface Ayah {
  key: string;
  surahNumber: number;
  ayahNumber: number;
  canonicalText: string;
  source: QuranSource;
  translation?: QuranTextLayer;
  transliteration?: QuranTextLayer;
  words?: QuranWord[];
  audio?: QuranAudio;
  tafsir?: QuranTextLayer;
}

export type ResourceGroup = 'quran_core' | 'mushafs' | 'translations' | 'word_by_word_translations' | 'word_by_word_transliterations' | 'tafsirs' | 'recitations' | 'chapter_recitations' | 'articles';
export interface SyncMutation {
  sequence: number;
  type: 'RESOURCE_CREATE' | 'RESOURCE_INVALIDATE' | 'RESOURCE_DELETE' | 'RESOURCE_UPDATE' | 'ROW_CREATE' | 'ROW_UPDATE' | 'ROW_DELETE';
  resource_group: ResourceGroup;
  resource_id: number;
  record_type: string | null;
  record_key: string | null;
  snapshot_url: string | null;
  data: Record<string, unknown> | null;
  changed_at?: string;
}
export interface SyncPage {
  sync: { sync_until_sequence: number; has_more: boolean; next_page_url: string | null; next_sync_token: string | null; mutations: SyncMutation[] };
}
export interface ResourceSnapshot {
  resource_group: ResourceGroup;
  resource_id: number;
  resource_content_id: number | null;
  schema_version: number;
  sync_sequence: number;
  records: Record<string, unknown>[];
  attribution?:QuranSource;
}
export interface QuranSyncState { filter: string; environment: string; syncToken: string | null; lastSync: string | null; status: 'complete' | 'syncing' | 'failed' }
