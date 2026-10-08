import type { QuranSyncState, ResourceGroup, ResourceSnapshot, SyncMutation } from '../../types/quran';
import { QuranProviderError, type QuranSyncProvider } from './QuranProvider';

export const SYNC_GROUPS: ResourceGroup[] = ['articles', 'chapter_recitations', 'mushafs', 'quran_core', 'recitations', 'tafsirs', 'translations', 'word_by_word_translations', 'word_by_word_transliterations'];
export function canonicalResourceFilter(filter: string): string {
  const groups = new Map<string, Set<number> | '*'>();
  for (const item of filter.split(';')) {
    const [group, ids, extra] = item.split(':');
    if (extra || !SYNC_GROUPS.includes(group as ResourceGroup) || !ids) throw new QuranProviderError('Invalid Content Sync resource filter');
    if (ids === '*') { if (group === 'quran_core') throw new QuranProviderError('Canonical Quran core must use quran_core:1'); groups.set(group, '*'); continue; }
    const set = groups.get(group) === '*' ? null : (groups.get(group) as Set<number> | undefined) ?? new Set<number>();
    for (const id of ids.split(',')) {
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || (group === 'quran_core' && id !== '1')) throw new QuranProviderError('Invalid Content Sync resource ID');
      set?.add(Number(id));
    }
    if (set) groups.set(group, set);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, ids]) => `${group}:${ids === '*' ? '*' : [...ids].sort((a,b) => a-b).join(',')}`).join(';');
}
export function needsQuranSync(lastSync: string | null, connected: boolean, now = Date.now()): boolean {
  return connected && (!lastSync || !Number.isFinite(Date.parse(lastSync)) || now - Date.parse(lastSync) >= 7 * 24 * 60 * 60 * 1000);
}
export interface SyncStore {
  state(environment: string, filter: string): Promise<QuranSyncState | null>;
  resource(environment: string, group: ResourceGroup, id: number): Promise<ResourceSnapshot | null>;
  resources(environment: string): Promise<ResourceSnapshot[]>;
  commit(environment: string, resources: Map<string, ResourceSnapshot | null>, state: QuranSyncState): Promise<void>;
}
function key(group: ResourceGroup, id: number): string { return `${group}:${id}`; }
function permitted(filter: string, group: string, id: number): boolean { return filter.split(';').some(part => { const [g, ids] = part.split(':'); return group === g && (ids === '*' || ids.split(',').includes(String(id))); }); }
function recordType(group: ResourceGroup, row: Record<string, unknown>): string {
  if (typeof row.record_type === 'string') return row.record_type;
  const types: Partial<Record<ResourceGroup,string>> = { translations: 'translation', word_by_word_translations: 'word_translation', word_by_word_transliterations: 'word_transliteration', tafsirs: 'tafsir', articles: 'article_localization' };
  if (!types[group]) throw new QuranProviderError('Snapshot row lacks its canonical record type');
  return types[group]!;
}
function rowKey(group: ResourceGroup, row: Record<string, unknown>): string {
  if (row.id !== undefined && row.id !== null) return String(row.id);
  if (group === 'articles' && row.article_id !== undefined && row.language_id !== undefined) return `${row.article_id}:${row.language_id}`;
  throw new QuranProviderError('Snapshot row lacks its canonical record key');
}
export function validateSnapshot(snapshot:ResourceSnapshot):void{
  if(snapshot.schema_version!==1 || !Array.isArray(snapshot.records))throw new QuranProviderError('Unsupported Content Sync snapshot schema');
  if(snapshot.resource_group!=='quran_core')return;
  if(snapshot.resource_id!==1)throw new QuranProviderError('Canonical Quran core must be singleton 1');
  const chapters=snapshot.records.filter(r=>r.record_type==='chapter');
  const verses=snapshot.records.filter(r=>r.record_type==='verse');
  if(chapters.length!==114 || verses.length!==6236)throw new QuranProviderError('The canonical Quran snapshot is incomplete. Production quran_core:1 must contain all 114 surahs and 6,236 ayahs.');
  const counts=new Map<number,number>();const refs=new Set<string>();
  for(const verse of verses){const chapter=Number(verse.chapter_id),number=Number(verse.verse_number);if(typeof verse.text_uthmani!=='string'||!verse.text_uthmani||verse.verse_key!==`${chapter}:${number}`||!Number.isInteger(chapter)||chapter<1||chapter>114||!Number.isInteger(number)||number<1||refs.has(String(verse.verse_key)))throw new QuranProviderError('Canonical Quran snapshot contains an invalid verse identity or missing text');refs.add(String(verse.verse_key));counts.set(chapter,(counts.get(chapter)??0)+1);}
  for(const chapter of chapters){const number=Number(chapter.chapter_number??chapter.id);const expected=Number(chapter.verses_count);if(counts.get(number)!==expected)throw new QuranProviderError('Canonical chapter count does not match its verses');for(let verse=1;verse<=expected;verse++)if(!refs.has(`${number}:${verse}`))throw new QuranProviderError('Canonical Quran snapshot has a gap in verse numbering');}
}

/** Fully stage each paginated run, then atomically commit rows and the final token. */
export class QuranSyncService {
  private running = false;
  constructor(private readonly provider: QuranSyncProvider, private readonly store: SyncStore, private readonly networkAllowed: () => boolean) {}
  async synchronize(resourceFilter: string): Promise<QuranSyncState> {
    if (!this.networkAllowed()) throw new QuranProviderError('Content downloads require parent-enabled network access.');
    if (this.running) throw new QuranProviderError('A Quran synchronization is already running.');
    this.running = true;
    try {
      const filter = canonicalResourceFilter(resourceFilter);
      const state = await this.store.state(this.provider.environment, filter);
      try { return await this.run(filter, state?.syncToken ?? null); }
      catch (error) {
        if (error instanceof QuranProviderError && ['resync_required', 'token_filter_mismatch', 'cursor_filter_mismatch'].includes(error.code ?? '')) return await this.run(filter, null);
        throw error;
      }
    } finally { this.running = false; }
  }
  private async run(filter: string, token: string | null): Promise<QuranSyncState> {
    const staged = new Map<string, ResourceSnapshot | null>();
    if (!token) for (const resource of await this.store.resources(this.provider.environment)) if (permitted(filter, resource.resource_group, resource.resource_id)) staged.set(key(resource.resource_group, resource.resource_id), null);
    const query = `resources=${encodeURIComponent(filter)}&per_page=100&${token ? `sync_token=${encodeURIComponent(token)}` : 'bootstrap=true'}`;
    let path: string | null = `/api/v4/resources/sync?${query}`;
    let finalToken: string | null = null;
    let previousSequence = -1;
    const visited = new Set<string>();
    while (path) {
      if (!this.networkAllowed()) throw new QuranProviderError('Network access was disabled during synchronization.');
      if (visited.has(path) || visited.size > 10000 || !path.startsWith('/api/v4/resources/sync?')) throw new QuranProviderError('Invalid or repeated sync page path');
      visited.add(path);
      const { sync } = await this.provider.sync(path);
      for (const change of sync.mutations) {
        if (!permitted(filter, change.resource_group, change.resource_id) || change.sequence < previousSequence || change.sequence > sync.sync_until_sequence) throw new QuranProviderError('Invalid Content Sync mutation order or scope');
        previousSequence = change.sequence;
        await this.apply(staged, change);
      }
      if (sync.has_more) {
        if (!sync.next_page_url || sync.next_sync_token !== null) throw new QuranProviderError('Invalid intermediate sync page');
        path = sync.next_page_url; // The server owns the cursor. Follow it unchanged.
      } else {
        if (!sync.next_sync_token) throw new QuranProviderError('Final Content Sync checkpoint is missing');
        finalToken = sync.next_sync_token;
        path = null;
      }
    }
    const state: QuranSyncState = { filter, environment: this.provider.environment, syncToken: finalToken, lastSync: new Date().toISOString(), status: 'complete' };
    await this.store.commit(this.provider.environment, staged, state);
    return state;
  }
  private async apply(staged: Map<string, ResourceSnapshot | null>, change: SyncMutation): Promise<void> {
    const resourceKey = key(change.resource_group, change.resource_id);
    if (change.type === 'RESOURCE_DELETE') { staged.set(resourceKey, null); return; }
    if (change.type === 'RESOURCE_CREATE' || change.type === 'RESOURCE_INVALIDATE') {
      const expected = `/api/v4/resources/snapshots/${change.resource_group}/${change.resource_id}`;
      if (change.snapshot_url !== expected) throw new QuranProviderError('Snapshot path does not match the requested resource');
      try {
        const snapshot = await this.provider.snapshot(change.snapshot_url);
        if (snapshot.resource_group !== change.resource_group || snapshot.resource_id !== change.resource_id) throw new QuranProviderError('Snapshot identity mismatch');
        validateSnapshot(snapshot);
        staged.set(resourceKey, snapshot);
      } catch (error) {
        if (error instanceof QuranProviderError && error.code === 'snapshot_not_found') staged.set(resourceKey, null);
        else throw error;
      }
      return;
    }
    if (change.type === 'RESOURCE_UPDATE') return;
    if (!['ROW_CREATE', 'ROW_UPDATE', 'ROW_DELETE'].includes(change.type) || !change.record_type || !change.record_key) throw new QuranProviderError('Unsupported or incomplete Content Sync mutation');
    const resource = staged.has(resourceKey) ? staged.get(resourceKey) : await this.store.resource(this.provider.environment, change.resource_group, change.resource_id);
    if (!resource) throw new QuranProviderError('A row update has no local resource; bootstrap the filter again', 410, 'resync_required');
    const records = resource.records.filter(row => !(recordType(change.resource_group, row) === change.record_type && rowKey(change.resource_group, row) === change.record_key));
    if (change.type !== 'ROW_DELETE') {
      if (!change.data || rowKey(change.resource_group, change.data) !== change.record_key || recordType(change.resource_group, change.data) !== change.record_type) throw new QuranProviderError('Sync row identity mismatch');
      records.push(change.data);
    }
    staged.set(resourceKey, { ...resource, records, sync_sequence: Math.max(resource.sync_sequence, change.sequence) });
  }
}
