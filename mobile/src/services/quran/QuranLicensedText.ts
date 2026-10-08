import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import chapters from '../../content/fixtures/quran-chapters.json';
import type { QuranSource } from '../../types/quran';
import type { Database } from '../database/types';
import { QuranProviderError } from './QuranProvider';

export type TanzilTextKind = 'arabic' | 'transliteration';
export interface TanzilConsent { unchangedUseConfirmed: boolean; noncommercialUseConfirmed?: boolean }
export interface TanzilVerse { key: string; surahNumber: number; ayahNumber: number; text: string }
export interface TanzilTextMetadata {
  kind: TanzilTextKind;
  source: QuranSource;
  chapterCount: 114;
  verseCount: 6236;
  bytes: number;
  sha256: string;
  notice: string;
  licenseUrl: string;
}
export interface StagedTanzilText extends TanzilTextMetadata { originalText: string; verses: readonly TanzilVerse[] }
export interface InstalledTanzilText extends TanzilTextMetadata { installedAt: string; consent: TanzilConsent }
interface StoredTanzilText { originalText: string; installedAt: string; consent: TanzilConsent }
export interface TanzilDownloadOptions {
  proxyUrl: string;
  networkAllowed: () => boolean;
  consent: TanzilConsent;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export const TANZIL_MAX_BYTES = 3 * 1024 * 1024;
export const TANZIL_EDITIONS = Object.freeze({
  arabic: {
    downloadUrl: 'https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true',
    sha256: 'bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8',
    bytes: 1370878,
    licenseUrl: 'https://tanzil.net/docs/Text_License',
    source: Object.freeze({ name: 'Tanzil Project', reference: 'Uthmani Quran text, version 1.1, default download options', url: 'https://tanzil.net/', license: 'CC BY 3.0; unchanged verbatim text and original copyright notice required', version: '1.1', verifiedAt: '2026-10-08', language: 'Arabic' }) as QuranSource,
  },
  transliteration: {
    downloadUrl: 'https://tanzil.net/trans/en.transliteration',
    sha256: '8c20d95e484534e921cd2e0d2546aab7f5300090c0bd76697095b3ca1db1e01d',
    bytes: 1044894,
    licenseUrl: 'https://tanzil.net/trans/',
    source: Object.freeze({ name: 'Tanzil.net — English Transliteration', translator: 'English Transliteration', reference: 'en.transliteration; original publisher markup retained', url: 'https://tanzil.net/trans/', license: 'Tanzil translation terms: noncommercial purposes only; otherwise obtain translator/publisher permission; unchanged republication', version: 'September 6, 2010', verifiedAt: '2026-10-08', language: 'English' }) as QuranSource,
  },
});

function edition(kind: TanzilTextKind) {
  if (kind !== 'arabic' && kind !== 'transliteration') throw new QuranProviderError('Choose a supported Tanzil text edition.');
  return TANZIL_EDITIONS[kind];
}
function requireConsent(kind: TanzilTextKind, consent: TanzilConsent): void {
  if (consent?.unchangedUseConfirmed !== true) throw new QuranProviderError('A parent must accept the publisher attribution and unchanged-text requirements before downloading.');
  if (kind === 'transliteration' && consent.noncommercialUseConfirmed !== true) throw new QuranProviderError('This transliteration edition permits noncommercial use only. A parent must confirm that use before downloading.');
}
function requireNetwork(allowed: () => boolean): void {
  if (!allowed()) throw new QuranProviderError('Parent-enabled network access is required. The previous offline edition remains available.', undefined, 'network_disabled');
}

/** Parse exact publisher strings; do not trim, normalize, correct, or generate verse text. */
export function parseTanzilRows(originalText: string): { verses: TanzilVerse[]; notice: string } {
  const verses: TanzilVerse[] = [];
  const seen = new Set<string>();
  let footer = false;
  const lines = originalText.split(/\r?\n/);
  const noticeLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) { footer = true; noticeLines.push(line); continue; }
    if (!line) { if (footer) noticeLines.push(line); continue; }
    const match = /^([1-9]\d{0,2})\|([1-9]\d{0,2})\|(.+)$/.exec(line);
    if (!match || footer) throw new QuranProviderError('The publisher file has an unexpected row or footer format. No partial content was saved.');
    const surahNumber = Number(match[1]);
    const ayahNumber = Number(match[2]);
    const chapter = chapters[surahNumber - 1];
    const key = `${surahNumber}:${ayahNumber}`;
    if (!chapter || ayahNumber > chapter.ayahCount || seen.has(key)) throw new QuranProviderError('The publisher file contains an invalid or duplicate ayah reference.');
    seen.add(key);
    verses.push({ key, surahNumber, ayahNumber, text: match[3] });
  }
  if (verses.length !== 6236 || !footer) throw new QuranProviderError('A complete publisher edition must contain all 114 surahs, 6,236 ayahs and its original notice.');
  let index = 0;
  for (const chapter of chapters) for (let number = 1; number <= chapter.ayahCount; number++) {
    if (verses[index++]?.key !== `${chapter.number}:${number}`) throw new QuranProviderError('The publisher file has missing or reordered ayahs.');
  }
  return { verses, notice: noticeLines.join('\n') };
}

/** The edition hash ties the import to publisher bytes verified with its published permission. */
export function stageTanzilText(kind: TanzilTextKind, bytes: Uint8Array): StagedTanzilText {
  const known = edition(kind);
  if (bytes.length > TANZIL_MAX_BYTES) throw new QuranProviderError('The publisher file exceeds the supported download size.');
  let originalText: string;
  try { originalText = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new QuranProviderError('The publisher file is not valid UTF-8. No text was saved.'); }
  const parsed = parseTanzilRows(originalText);
  const hash = bytesToHex(sha256(bytes));
  if (hash !== known.sha256 || bytes.length !== known.bytes) throw new QuranProviderError('The publisher edition has changed or the download is damaged. This edition needs source verification before it can be installed.', undefined, 'edition_changed');
  return { kind, source: { ...known.source }, chapterCount: 114, verseCount: 6236, bytes: bytes.length, sha256: hash, licenseUrl: known.licenseUrl, originalText, ...parsed };
}

export async function prepareTanzilText(kind: TanzilTextKind, options: TanzilDownloadOptions): Promise<StagedTanzilText> {
  edition(kind);
  requireConsent(kind, options.consent);
  requireNetwork(options.networkAllowed);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeout = setTimeout(abort, 60000);
  const revoked = setInterval(() => { if (!options.networkAllowed()) abort(); }, 150);
  try {
    if (controller.signal.aborted) throw new QuranProviderError('The publisher download was cancelled.');
    const response = await (options.fetcher ?? fetch)(`${options.proxyUrl.replace(/\/+$/, '')}/api/resources/tanzil-${kind}`, { signal: controller.signal });
    requireNetwork(options.networkAllowed);
    if (!response.ok) throw new QuranProviderError(`The publisher download service returned ${response.status}. Check the parent content connection and retry.`);
    const advertised = Number(response.headers.get('content-length'));
    if (advertised > TANZIL_MAX_BYTES) throw new QuranProviderError('The publisher download exceeds the supported size.');
    let bytes: Uint8Array;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (true) {
          requireNetwork(options.networkAllowed);
          if (controller.signal.aborted) throw new QuranProviderError('The publisher download was cancelled.');
          const { value, done } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > TANZIL_MAX_BYTES) { await reader.cancel(); throw new QuranProviderError('The publisher download exceeds the supported size.'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    } else bytes = new Uint8Array(await response.arrayBuffer());
    requireNetwork(options.networkAllowed);
    if (controller.signal.aborted) throw new QuranProviderError('The publisher download was cancelled.');
    return stageTanzilText(kind, bytes);
  } catch (error) {
    requireNetwork(options.networkAllowed);
    if (controller.signal.aborted) throw new QuranProviderError(options.signal?.aborted ? 'The publisher download was cancelled.' : 'The publisher download timed out. Your saved edition is still available.');
    if (error instanceof QuranProviderError) throw error;
    throw new QuranProviderError('The publisher download could not be reached. Check the parent content connection and retry.');
  } finally {
    clearTimeout(timeout); clearInterval(revoked);
    options.signal?.removeEventListener('abort', abort);
  }
}

const resource = (kind: TanzilTextKind) => `licensed:tanzil:${kind}`;
const resourceId = (kind: TanzilTextKind) => kind === 'arabic' ? 'uthmani' : 'en.transliteration';
const cache = new WeakMap<Database, Map<TanzilTextKind, { payload: string; staged: StagedTanzilText; installed: InstalledTanzilText }>>();

/** Verify again at the atomic install boundary; callers cannot forge staged rows or attribution. */
export async function commitTanzilText(db: Database, staged: StagedTanzilText, consent: TanzilConsent, networkAllowed: () => boolean): Promise<InstalledTanzilText> {
  requireConsent(staged.kind, consent);
  requireNetwork(networkAllowed);
  const verified = stageTanzilText(staged.kind, utf8ToBytes(staged.originalText));
  const stored: StoredTanzilText = { originalText: verified.originalText, installedAt: new Date().toISOString(), consent: { unchangedUseConfirmed: true, ...(staged.kind === 'transliteration' ? { noncommercialUseConfirmed: true } : {}) } };
  await db.withTransactionAsync(async tx => {
    requireNetwork(networkAllowed);
    await tx.runAsync('INSERT OR REPLACE INTO quran_resources(resource,resource_id,version,payload_json) VALUES(?,?,?,?)', resource(staged.kind), resourceId(staged.kind), verified.sha256, JSON.stringify(stored));
    requireNetwork(networkAllowed);
  });
  cache.delete(db);
  const { originalText: _original, verses: _verses, ...metadata } = verified;
  return { ...metadata, installedAt: stored.installedAt, consent: stored.consent };
}

export async function readTanzilText(db: Database, kind: TanzilTextKind): Promise<{ staged: StagedTanzilText; installed: InstalledTanzilText } | null> {
  edition(kind);
  const row = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM quran_resources WHERE resource=? AND resource_id=?', resource(kind), resourceId(kind));
  if (!row) return null;
  const hit = cache.get(db)?.get(kind);
  if (hit?.payload === row.payload_json) return hit;
  try {
    const stored = JSON.parse(row.payload_json) as StoredTanzilText;
    requireConsent(kind, stored.consent);
    if (!Number.isFinite(Date.parse(stored.installedAt))) return null;
    const staged = stageTanzilText(kind, utf8ToBytes(stored.originalText));
    const { originalText: _original, verses: _verses, ...metadata } = staged;
    const result = { payload: row.payload_json, staged, installed: { ...metadata, installedAt: stored.installedAt, consent: stored.consent } };
    const entries = cache.get(db) ?? new Map(); entries.set(kind, result); cache.set(db, entries);
    return result;
  } catch { return null; } // A damaged local edition is never advertised as available.
}

export async function installedTanzilText(db: Database, kind: TanzilTextKind): Promise<InstalledTanzilText | null> { return (await readTanzilText(db, kind))?.installed ?? null; }
export async function removeTanzilText(db: Database, kind: TanzilTextKind): Promise<void> {
  edition(kind);
  await db.runAsync('DELETE FROM quran_resources WHERE resource=? AND resource_id=?', resource(kind), resourceId(kind));
  cache.delete(db);
}
export const prepareTanzilTransliteration = (options: TanzilDownloadOptions) => prepareTanzilText('transliteration', options);
export const commitTanzilTransliteration = (db: Database, staged: StagedTanzilText, consent: TanzilConsent, networkAllowed: () => boolean) => {
  if (staged.kind !== 'transliteration') throw new QuranProviderError('Select the transliteration edition to install.');
  return commitTanzilText(db, staged, consent, networkAllowed);
};
export const installedTanzilTransliteration = (db: Database) => installedTanzilText(db, 'transliteration');
