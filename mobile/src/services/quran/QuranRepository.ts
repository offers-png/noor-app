import type { Database } from '../database/types';
import type { Ayah, QuranSource, QuranSyncState, ResourceGroup, ResourceSnapshot, Surah } from '../../types/quran';
import { ALL_SURAHS, SEEDED_AYAHS } from './FixtureQuranProvider';
import type { SyncStore } from './QuranSyncService';
import { audioCacheKey, resolveQuranAudioUrl } from './QuranAudioDownloads';
import { verseIdForReference } from './QuranNavigation';
import { sourcedWordTimings } from './QuranTiming';
import { readQuranResourcePreferences, selectActiveQuranResource, type QuranResourcePreferences } from './QuranResourcePreferences';

const seedOperations = new WeakMap<Database, Promise<void>>();

/** Share one initialization transaction across every repository using the same connection. */
export function seedQuran(db: Database): Promise<void> {
  const existing = seedOperations.get(db);
  if (existing) return existing;
  const operation = Promise.resolve().then(() => db.withTransactionAsync(async tx => {
    for (const surah of ALL_SURAHS) await tx.runAsync('INSERT OR IGNORE INTO surahs(number,payload_json) VALUES (?,?)', surah.number, JSON.stringify(surah));
    for (const ayah of SEEDED_AYAHS) await tx.runAsync('INSERT OR IGNORE INTO ayahs(verse_key,surah_number,ayah_number,canonical_text,source_json,payload_json) VALUES (?,?,?,?,?,?)', ayah.key, ayah.surahNumber, ayah.ayahNumber, ayah.canonicalText, JSON.stringify(ayah.source), JSON.stringify(ayah));
  })).catch((error: unknown) => {
    seedOperations.delete(db);
    throw error;
  });
  seedOperations.set(db, operation);
  return operation;
}

export class SQLiteQuranSyncStore implements SyncStore {
  constructor(private readonly db: Database) {}
  async state(environment: string, filter: string): Promise<QuranSyncState | null> {
    const row = await this.db.getFirstAsync<{ sync_token: string; last_sync: string; download_status: string }>('SELECT sync_token,last_sync,download_status FROM quran_sync WHERE resource=? AND resource_id=?', `filter:${environment}`, filter);
    return row ? { environment, filter, syncToken: row.sync_token, lastSync: row.last_sync, status: row.download_status as QuranSyncState['status'] } : null;
  }
  async resource(environment: string, group: ResourceGroup, id: number): Promise<ResourceSnapshot | null> {
    const row = await this.db.getFirstAsync<{payload_json:string}>('SELECT payload_json FROM quran_resources WHERE resource=? AND resource_id=?', `qf:${environment}:${group}`, String(id));
    return row ? JSON.parse(row.payload_json) as ResourceSnapshot : null;
  }
  async resources(environment: string): Promise<ResourceSnapshot[]> {
    const rows = await this.db.getAllAsync<{payload_json:string}>('SELECT payload_json FROM quran_resources WHERE resource LIKE ?', `qf:${environment}:%`);
    return rows.map(r => JSON.parse(r.payload_json) as ResourceSnapshot);
  }
  async commit(environment: string, resources: Map<string,ResourceSnapshot | null>, state: QuranSyncState): Promise<void> {
    await this.db.withTransactionAsync(async tx => {
      for (const [key, resource] of resources) {
        const [group,id] = key.split(':');
        const scoped = `qf:${environment}:${group}`;
        if (!resource) {
          await tx.runAsync('DELETE FROM quran_resources WHERE resource=? AND resource_id=?', scoped, id);
          await tx.runAsync('INSERT OR REPLACE INTO quran_sync(resource,resource_id,version,last_sync,sync_token,download_status) VALUES (?,?,?,?,?,?)', scoped, id, '', state.lastSync, null, 'unavailable');
        } else {
          const version = `${resource.schema_version}:${resource.sync_sequence}`;
          await tx.runAsync('INSERT OR REPLACE INTO quran_resources(resource,resource_id,version,payload_json) VALUES (?,?,?,?)', scoped, id, version, JSON.stringify(resource));
          await tx.runAsync('INSERT OR REPLACE INTO quran_sync(resource,resource_id,version,last_sync,sync_token,download_status) VALUES (?,?,?,?,?,?)', scoped, id, version, state.lastSync, null, 'complete');
        }
      }
      await tx.runAsync('INSERT OR REPLACE INTO quran_sync(resource,resource_id,version,last_sync,sync_token,download_status) VALUES (?,?,?,?,?,?)', `filter:${environment}`, state.filter, '1', state.lastSync, state.syncToken, state.status);
    });
  }
}

function qfSource(resource: ResourceSnapshot, reference: string): QuranSource {
  return { name: `Quran Foundation ${resource.resource_group} resource ${resource.resource_id}`, url: 'https://quran.com/', license: 'Quran Foundation Developer Terms; offline copy maintained through Content Sync', verifiedAt: 'Content Sync',...resource.attribution,reference,version: `${resource.schema_version}:${resource.sync_sequence}` };
}

export class QuranRepository {
  constructor(private readonly dbFactory: () => Promise<Database> = async () => (await import('../database/database')).getDb(), private readonly environment = 'production') {}
  private async db(): Promise<Database> { const db = await this.dbFactory(); await seedQuran(db); return db; }
  async chapters(): Promise<Surah[]> {
    const db = await this.db();
    const chapters = (await db.getAllAsync<{payload_json:string}>('SELECT payload_json FROM surahs ORDER BY number')).map(s => JSON.parse(s.payload_json) as Surah);
    const core = await new SQLiteQuranSyncStore(db).resource(this.environment, 'quran_core', 1);
    if (core) for (const chapter of chapters) chapter.availableOffline = chapter.availableOffline || core.records.some(row => row.record_type === 'verse' && row.chapter_id === chapter.number);
    return chapters;
  }
  async verses(surahNumber: number): Promise<Ayah[]> {
    const db = await this.db();
    const resources = await new SQLiteQuranSyncStore(db).resources(this.environment);
    const preferences = await readQuranResourcePreferences(db, this.environment);
    const core = resources.find(r => r.resource_group === 'quran_core');
    let ayahs:Ayah[]=[];
    if (core) {
      const verses = core.records.filter(r => r.record_type === 'verse' && r.chapter_id === surahNumber && typeof r.text_uthmani === 'string');
      if (verses.length) {
        ayahs=verses.sort((a,b) => Number(a.verse_number)-Number(b.verse_number)).map(row => this.mapSynced(row, core, resources, preferences));
      }
    }
    if(!ayahs.length)ayahs=(await db.getAllAsync<{payload_json:string;canonical_text:string}>('SELECT payload_json,canonical_text FROM ayahs WHERE surah_number=? ORDER BY ayah_number', surahNumber)).map(row => {const ayah={ ...JSON.parse(row.payload_json) as Ayah, canonicalText: row.canonical_text };ayah.audio??=SEEDED_AYAHS.find(v=>v.key===ayah.key)?.audio;return this.layers(ayah,undefined,resources,preferences);});
    for(const ayah of ayahs)if(ayah.audio?.downloadId){const file=await db.getFirstAsync<{path:string}>('SELECT path FROM downloads WHERE id=? AND status=?',ayah.audio.downloadId,'complete');if(file?.path)ayah.audio.localUri=file.path;}
    return ayahs;
  }
  private mapSynced(row: Record<string,unknown>, core: ResourceSnapshot, resources: ResourceSnapshot[], preferences:QuranResourcePreferences): Ayah {
    const key = String(row.verse_key);
    const fixture=SEEDED_AYAHS.find(v=>v.key===key);
    const ayah: Ayah = { key, surahNumber: Number(row.chapter_id), ayahNumber: Number(row.verse_number), canonicalText: row.text_uthmani as string, source: qfSource(core,key),translation:fixture?.translation,audio:fixture?.audio };
    return this.layers(ayah,core,resources,preferences);
  }
  private layers(ayah:Ayah,core:ResourceSnapshot|undefined,resources:ResourceSnapshot[],preferences:QuranResourcePreferences):Ayah{
    const key=ayah.key;
    const translation = selectActiveQuranResource(resources,'translations',preferences);
    const translated = translation?.records.find(r => r.verse_key === key && typeof r.text === 'string');
    if (translated && translation) ayah.translation = { text: translated.text as string, source: { ...qfSource(translation,key), translator: typeof translated.translator === 'string' ? translated.translator : translation.attribution?.translator } };
    const tafsir = selectActiveQuranResource(resources,'tafsirs',preferences);
    const verseId = core?.records.find(r => r.record_type === 'verse' && r.verse_key === key)?.id ?? verseIdForReference(key);
    const tafsirText = tafsir?.records.find(r => {
      if (typeof r.text !== 'string' || !r.text) return false;
      if (Number.isSafeInteger(r.start_verse_id) && Number.isSafeInteger(r.end_verse_id) && typeof verseId === 'number') return Number(r.start_verse_id) <= verseId && verseId <= Number(r.end_verse_id);
      return r.verse_key === key;
    });
    if (tafsirText && tafsir) ayah.tafsir = {text:tafsirText.text as string,source:qfSource(tafsir,typeof tafsirText.group_verse_key_from === 'string' && typeof tafsirText.group_verse_key_to === 'string' ? `${tafsirText.group_verse_key_from}–${tafsirText.group_verse_key_to}` : key)};
    const audio = selectActiveQuranResource(resources,'recitations',preferences);
    const file = audio?.records.find(r => r.verse_key === key && r.record_type === 'audio_file' && typeof r.url === 'string');
    if (file && audio) ayah.audio = { url:resolveQuranAudioUrl(file.url as string), reciter:typeof file.reciter_name === 'string' ? file.reciter_name : audio.attribution?.name??`Quran Foundation recitation ${audio.resource_id}`,source:qfSource(audio,key),downloadId:audioCacheKey(audio.resource_id,key,file.url as string,file.updated_at),wordTimings:sourcedWordTimings(file.segments) };
    const words = core?.records.filter(r => r.record_type === 'word' && r.verse_key === key && r.char_type_name === 'word' && typeof r.text_indopak === 'string').sort((a,b)=>Number(a.position)-Number(b.position))??[];
    const wordTranslations = selectActiveQuranResource(resources,'word_by_word_translations',preferences);
    const wordTransliterations = selectActiveQuranResource(resources,'word_by_word_transliterations',preferences);
    ayah.words = words.map(w => {
      const trans = wordTranslations?.records.find(r => r.word_id === w.id && typeof r.text === 'string');
      const translit = wordTransliterations?.records.find(r => r.word_id === w.id && typeof r.text === 'string');
      return { id:String(w.id), position:Number(w.position), canonicalText:w.text_indopak as string, source:core?qfSource(core,`${key}:${w.position}`):ayah.source, translation:trans && wordTranslations ? {text:trans.text as string, source:qfSource(wordTranslations,`${key}:${w.position}`)} : undefined, transliteration:translit && wordTransliterations ? {text:translit.text as string,source:qfSource(wordTransliterations,`${key}:${w.position}`)} : undefined };
    });
    // A transliteration is a separate source layer; no automatic transliteration of Arabic.
    return ayah;
  }
  async bookmarks(childId: number): Promise<string[]> { return (await (await this.db()).getAllAsync<{item_id:string}>('SELECT item_id FROM bookmarks WHERE child_id=? AND kind=? ORDER BY created_at DESC', childId, 'quran')).map(r=>r.item_id); }
  async saveMemorization(childId:number,key:string,level:string,rating?:string):Promise<void>{await(await this.db()).runAsync('INSERT INTO memorization_progress(child_id,verse_key,level,rating,last_practiced) VALUES (?,?,?,?,?) ON CONFLICT(child_id,verse_key) DO UPDATE SET level=excluded.level,rating=COALESCE(excluded.rating,memorization_progress.rating),last_practiced=excluded.last_practiced',childId,key,level,rating??null,new Date().toISOString());}
  async toggleBookmark(childId: number, key: string): Promise<boolean> {
    const db = await this.db();
    const exists = await db.getFirstAsync('SELECT item_id FROM bookmarks WHERE child_id=? AND kind=? AND item_id=?', childId, 'quran', key);
    if (exists) { await db.runAsync('DELETE FROM bookmarks WHERE child_id=? AND kind=? AND item_id=?', childId,'quran',key); return false; }
    await db.runAsync('INSERT INTO bookmarks(child_id,kind,item_id,created_at) VALUES (?,?,?,?)',childId,'quran',key,new Date().toISOString()); return true;
  }
}
