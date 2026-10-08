import type { Ayah, QuranSource, ResourceSnapshot, Surah, SyncPage } from '../../types/quran';
import { QuranProviderError, type QuranProvider, type QuranSyncProvider } from './QuranProvider';

export function assertRelativeQfPath(path: string): string {
  if (!/^\/api\/v4\/(?:resources\/(?:sync(?:\?|$)|snapshots\/[a-z_]+\/\d+(?:\?|$))|chapters(?:\?|$)|verses\/by_chapter\/\d+(?:\?|$)|verses\/by_key\/\d+:\d+(?:\?|$)|resources\/(?:translations|tafsirs|recitations)(?:\?|$))/.test(path) || /[\\#\r\n]/.test(path) || path.includes('..')) throw new QuranProviderError('Invalid Quran Foundation content path');
  return path;
}

export class QuranFoundationProvider implements QuranProvider, QuranSyncProvider {
  readonly id = 'quran-foundation';
  private readonly metadata=new Map<string,Promise<Record<string,unknown>[]>>();
  constructor(private readonly proxyUrl: string, public readonly environment: 'prelive' | 'production', private readonly fetcher: typeof fetch = fetch, private readonly networkAllowed: () => boolean = () => false) {}
  private async request<T>(path: string): Promise<T> {
    if (!this.networkAllowed()) throw new QuranProviderError('A parent must enable network access before using online Quran content.');
    assertRelativeQfPath(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const monitor = setInterval(() => { if (!this.networkAllowed()) controller.abort(); }, 250);
    try {
      const response = await this.fetcher(`${this.proxyUrl.replace(/\/$/, '')}/api/quran?environment=${this.environment}&path=${encodeURIComponent(path)}`, { signal: controller.signal });
      if(!this.networkAllowed())throw new QuranProviderError('Network access was disabled. Your saved content is still available.',undefined,'network_disabled');
      let json:{ error?: { code?: string; message?: string }; message?: string };
      try{json=await response.json();}catch{throw new QuranProviderError('The content service returned an unreadable response. Check the parent connection settings and try again.',response.status,'invalid_response');}
      if(!json || typeof json!=='object')throw new QuranProviderError('The content service returned an invalid response.',response.status,'invalid_response');
      if (!response.ok) throw new QuranProviderError(json.error?.message ?? json.message ?? `Quran service returned ${response.status}`, response.status, json.error?.code);
      return json as T;
    } catch(error) {
      if(error instanceof QuranProviderError)throw error;
      throw new QuranProviderError(!this.networkAllowed()?'Network access was disabled. Your saved content is still available.':controller.signal.aborted?'The content service timed out. Try again on a stable connection.':'The content service could not be reached. Check your connection and the parent connection settings.',undefined,!this.networkAllowed()?'network_disabled':'connection_failed');
    } finally { clearTimeout(timer);clearInterval(monitor); }
  }
  async chapters(): Promise<Surah[]> {
    const data = await this.request<{chapters: {id:number;name_arabic:string;name_simple:string;translated_name?:{name:string};revelation_place:string;verses_count:number}[]}>('/api/v4/chapters?language=en');
    return data.chapters.map(s => ({ number: s.id, arabicName: s.name_arabic, name: s.name_simple, englishName: s.translated_name?.name ?? s.name_simple, revelationType: s.revelation_place, ayahCount: s.verses_count, availableOffline: false, source: this.source('chapters') }));
  }
  async verses(surahNumber: number): Promise<Ayah[]> {
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) throw new QuranProviderError('Invalid surah number');
    const result: Ayah[] = [];
    for (let page = 1; ; page++) {
      const data = await this.request<{verses: Record<string, unknown>[]; pagination?: {next_page: number | null}}>(`/api/v4/verses/by_chapter/${surahNumber}?fields=text_uthmani&words=true&per_page=50&page=${page}`);
      result.push(...data.verses.map(v => this.mapVerse(v)));
      if (!data.pagination?.next_page) break;
      if (data.pagination.next_page !== page + 1 || page > 10) throw new QuranProviderError('Unexpected verse pagination');
    }
    return result;
  }
  async verse(key: string): Promise<Ayah | null> {
    if (!/^\d{1,3}:\d{1,3}$/.test(key)) throw new QuranProviderError('Invalid ayah reference');
    const data = await this.request<{verse: Record<string, unknown>}>(`/api/v4/verses/by_key/${key}?fields=text_uthmani&words=true`);
    return this.mapVerse(data.verse);
  }
  // Online results deliberately are not persisted. Offline content uses Content Sync only.
  private mapVerse(v: Record<string, unknown>): Ayah {
    if (typeof v.verse_key !== 'string' || typeof v.text_uthmani !== 'string') throw new QuranProviderError('Canonical Arabic is missing from the source response');
    const [chapter, number] = v.verse_key.split(':').map(Number);
    return { key: v.verse_key, surahNumber: chapter, ayahNumber: number, canonicalText: v.text_uthmani, source: this.source(v.verse_key) };
  }
  source(reference: string): QuranSource { return { name: 'Quran Foundation', reference, url: 'https://quran.com/', license: 'Quran Foundation Developer Terms; Content Sync for offline storage', version: 'v4', verifiedAt: new Date().toISOString() }; }
  async sync(path: string): Promise<SyncPage> { const data = await this.request<SyncPage>(path); if (!data.sync || !Array.isArray(data.sync.mutations)) throw new QuranProviderError('Invalid Content Sync response'); return data; }
  async snapshot(path: string): Promise<ResourceSnapshot> {
    const data = await this.request<ResourceSnapshot>(path);
    if (!Array.isArray(data.records) || data.schema_version !== 1) throw new QuranProviderError('Unsupported Content Sync snapshot schema');
    if(['translations','tafsirs','recitations'].includes(data.resource_group)){
      const kind=data.resource_group as 'translations'|'tafsirs'|'recitations';
      let metadata=this.metadata.get(kind);
      if(!metadata){metadata=this.resources(kind).then(result=>{const list=(result as Record<string,unknown>)[kind];if(!Array.isArray(list))throw new QuranProviderError('Source attribution metadata is unavailable');return list as Record<string,unknown>[];}).catch(error=>{this.metadata.delete(kind);throw error;});this.metadata.set(kind,metadata);}
      const attribution=(await metadata).find(row=>row.id===data.resource_id);
      if(!attribution)throw new QuranProviderError('The source did not provide attribution for the selected resource. No uncredited content is stored.');
      const language=typeof attribution.language_name==='string'?attribution.language_name.toLowerCase():undefined;
      if(kind==='tafsirs' && !['english','en'].includes(language??''))throw new QuranProviderError('Choose an English tafsir from the available source list. The selected resource is not identified as English by its publisher.',undefined,'tafsir_language');
      data.attribution={...this.source(`${kind}:${data.resource_id}`),name:typeof attribution.name==='string'?attribution.name:typeof attribution.reciter_name==='string'?attribution.reciter_name:`Quran Foundation ${kind} ${data.resource_id}`,translator:kind==='translations'&&typeof attribution.author_name==='string'?attribution.author_name:undefined,author:kind==='tafsirs'&&typeof attribution.author_name==='string'?attribution.author_name:undefined,language};
    }
    if(data.resource_group==='recitations' && !data.records.some(row=>row.record_type==='audio_file' && typeof row.verse_key==='string' && typeof row.url==='string' && row.url))throw new QuranProviderError('This published recitation has no ayah audio metadata. Choose another reciter or try syncing later.',undefined,'recitation_empty');
    if(data.resource_group==='tafsirs' && !data.records.some(row=>typeof row.text==='string'&&row.text.trim()))throw new QuranProviderError('This tafsir has no published explanation text for offline reading. Choose another source or try later.',undefined,'tafsir_empty');
    return data;
  }
  async resources(kind: 'translations' | 'tafsirs' | 'recitations'): Promise<unknown> { return this.request(`/api/v4/resources/${kind}?language=en`); }
}
