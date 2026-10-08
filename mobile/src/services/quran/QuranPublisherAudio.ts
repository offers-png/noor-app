import type { Database } from '../database/types';
import type { QuranSource } from '../../types/quran';
import { ALL_SURAHS, AUDIO_SOURCE } from './FixtureQuranProvider';
import { QuranProviderError } from './QuranProvider';
import type { QuranAudioDownload } from './QuranAudioDownloads';

/**
 * Credential-free recitation path: Islamic Network / Al Quran Cloud permits streaming and downloading
 * its recitations for personal and educational use (terms section IV, retained in
 * quran-audio-license.html). Metadata comes through the content proxy; files come from the publisher CDN.
 */
export const PUBLISHER_AUDIO_EDITION = 'ar.alafasy';
export const PUBLISHER_AUDIO_RECITER = 'Mishary Rashid Alafasy';
export const PUBLISHER_AUDIO_SOURCE: QuranSource = Object.freeze({ ...AUDIO_SOURCE, reference: 'Mishary Rashid Alafasy, ar.alafasy, publisher 128 kbps ayah recordings' });
const storageKey = `publisher-audio:${PUBLISHER_AUDIO_EDITION}`;
const urlPattern = /^https:\/\/cdn\.islamic\.network\/quran\/audio\/128\/ar\.alafasy\/([1-9]\d{0,3})\.mp3$/;

export interface PublisherAudioAyah { key: string; number: number; url: string }
export interface PublisherAudioMetadata { surah: number; edition: string; syncedAt: string; ayahs: PublisherAudioAyah[] }

function ayahOffset(surah: number): number {
  return ALL_SURAHS.filter(chapter => chapter.number < surah).reduce((sum, chapter) => sum + chapter.ayahCount, 0);
}
export function publisherAudioDownloadId(key: string, url: string): string { return `${storageKey}:${key}:${url}`; }

/** Independently re-check the proxy response against Tanzil chapter counts and the publisher URL scheme. */
export function validatePublisherAudio(payload: unknown, surah: number, syncedAt = new Date().toISOString()): PublisherAudioMetadata {
  const chapter = ALL_SURAHS.find(item => item.number === surah);
  if (!chapter) throw new QuranProviderError('Choose a surah from 1 to 114.');
  const value = payload as { surah?: unknown; source?: { edition?: unknown }; ayahs?: unknown };
  const invalid = new QuranProviderError('The recitation list could not be verified. No audio was downloaded; try again later.', undefined, 'audio_metadata_invalid');
  if (!value || value.surah !== surah || value.source?.edition !== PUBLISHER_AUDIO_EDITION || !Array.isArray(value.ayahs) || value.ayahs.length !== chapter.ayahCount) throw invalid;
  const offset = ayahOffset(surah);
  const ayahs = value.ayahs.map((row: { key?: unknown; number?: unknown; url?: unknown }, index) => {
    const match = typeof row?.url === 'string' ? urlPattern.exec(row.url) : null;
    if (row?.key !== `${surah}:${index + 1}` || row.number !== offset + index + 1 || !match || Number(match[1]) !== row.number) throw invalid;
    return { key: row.key, number: row.number, url: row.url as string };
  });
  return { surah, edition: PUBLISHER_AUDIO_EDITION, syncedAt, ayahs };
}

export async function fetchPublisherAudio(proxyUrl: string, surah: number, networkAllowed: () => boolean, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<PublisherAudioMetadata> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new QuranProviderError('Choose a surah from 1 to 114.');
  if (!networkAllowed() || signal?.aborted) throw new QuranProviderError('Enable optional network access in Parent Mode to get recitations.', undefined, 'network_disabled');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const monitor = setInterval(() => { if (!networkAllowed()) controller.abort(); }, 250);
  try {
    const response = await fetcher(`${proxyUrl.replace(/\/+$/, '')}/api/audio/alafasy/${surah}`, { signal: controller.signal });
    if (!networkAllowed() || signal?.aborted) throw new QuranProviderError('Network access was disabled. Saved recordings are unchanged.', undefined, 'network_disabled');
    let body: unknown;
    try { body = await response.json(); } catch { throw new QuranProviderError('The content server returned an unreadable response. Check the connection in Parent Mode.', response.status, 'invalid_response'); }
    if (!response.ok) throw new QuranProviderError(response.status === 404 ? 'This content server does not support recitation downloads yet. Update or redeploy it, then try again.' : (body as { message?: string })?.message ?? 'The recitation list is unavailable. Try again later.', response.status);
    return validatePublisherAudio(body, surah);
  } catch (error) {
    if (error instanceof QuranProviderError) throw error;
    throw new QuranProviderError(!networkAllowed() || signal?.aborted ? 'Network access was disabled. Saved recordings are unchanged.' : controller.signal.aborted ? 'The content server timed out. Try again on a stable connection.' : 'The content server could not be reached. Check your internet connection and the server address.', undefined, 'connection_failed');
  } finally { clearTimeout(timer); clearInterval(monitor); signal?.removeEventListener('abort', abort); }
}

export async function savePublisherAudio(db: Database, metadata: PublisherAudioMetadata, allowed: () => boolean): Promise<void> {
  await db.withTransactionAsync(async tx => {
    if (!allowed()) throw new QuranProviderError('Network permission changed; the previous recitation list was kept.', undefined, 'network_disabled');
    await tx.runAsync('INSERT OR REPLACE INTO quran_resources(resource,resource_id,version,payload_json) VALUES (?,?,?,?)', storageKey, String(metadata.surah), metadata.syncedAt, JSON.stringify(metadata));
  });
}

export async function readPublisherAudio(db: Database, surah: number): Promise<PublisherAudioMetadata | null> {
  const row = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM quran_resources WHERE resource=? AND resource_id=?', storageKey, String(surah));
  if (!row) return null;
  try { const stored = JSON.parse(row.payload_json) as PublisherAudioMetadata; return validatePublisherAudio({ ...stored, source: { edition: stored.edition } }, surah, stored.syncedAt); }
  catch { return null; } // A damaged list is treated as absent; the parent can fetch it again.
}

/** Lists refresh at least weekly, matching the app's other offline source refresh policy. */
export function publisherAudioIsFresh(metadata: PublisherAudioMetadata, now = Date.now()): boolean {
  const age = now - Date.parse(metadata.syncedAt);
  return Number.isFinite(age) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}
export function publisherAudioPlan(metadata: PublisherAudioMetadata): QuranAudioDownload[] {
  return metadata.ayahs.map(ayah => ({ id: publisherAudioDownloadId(ayah.key, ayah.url), resource: 'recitations', resourceId: PUBLISHER_AUDIO_EDITION, verseKey: ayah.key, url: ayah.url }));
}

/** Per-surah offline state, used by the parent download list. */
export async function publisherAudioStatus(db: Database): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM downloads WHERE resource_id=? AND status=?', PUBLISHER_AUDIO_EDITION, 'complete');
  const counts = new Map<number, number>();
  for (const row of rows) { const surah = Number(row.id.slice(storageKey.length + 1).split(':')[0]); if (Number.isInteger(surah)) counts.set(surah, (counts.get(surah) ?? 0) + 1); }
  return counts;
}

/** Deletes only files this download flow created; bundled assets are never in the downloads table. */
export async function removePublisherAudio(db: Database, surah: number, deleteFile: (uri: string) => void): Promise<number> {
  const rows = await db.getAllAsync<{ id: string; path: string | null }>('SELECT id,path FROM downloads WHERE resource_id=? AND id LIKE ?', PUBLISHER_AUDIO_EDITION, `${storageKey}:${surah}:%`);
  for (const row of rows) { if (row.path) { try { deleteFile(row.path); } catch { /* Missing files are already gone. */ } } }
  await db.runAsync('DELETE FROM downloads WHERE resource_id=? AND id LIKE ?', PUBLISHER_AUDIO_EDITION, `${storageKey}:${surah}:%`);
  return rows.length;
}
