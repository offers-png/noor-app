import type { Database } from '../database/types';
import type { QuranAudioDownload } from './QuranAudioDownloads';
import { QuranProviderError } from './QuranProvider';

export interface AudioFileInfo { exists: boolean; size: number }
export interface AudioTransfer {
  download(): Promise<{ uri: string; size: number } | null>;
  remove(): void;
  release(): void;
}
export interface AudioDownloadRuntime {
  inspect(uri: string): AudioFileInfo;
  availableBytes(): number;
  create(file: QuranAudioDownload, signal: AbortSignal, progress: (bytes: number) => void): AudioTransfer;
}
export interface AudioDownloadOptions {
  signal?: AbortSignal;
  onBytes?: (bytes: number, totalBytes: number) => void;
}
const running = new WeakSet<Database>();

export async function verifiedAudioPath(db: Database, id: string, runtime: Pick<AudioDownloadRuntime, 'inspect'>): Promise<string | undefined> {
  const saved = await db.getFirstAsync<{ path: string; bytes: number; total_bytes: number }>('SELECT path,bytes,total_bytes FROM downloads WHERE id=? AND status=?', id, 'complete');
  if (!saved) return undefined;
  try {
    const local = runtime.inspect(saved.path);
    if (local.exists && Number.isSafeInteger(saved.bytes) && saved.bytes > 0 && local.size === saved.bytes && saved.bytes === saved.total_bytes) return saved.path;
  } catch { /* A removed or inaccessible file is not a playable offline copy. */ }
  await db.runAsync('UPDATE downloads SET status=?,path=NULL,error=? WHERE id=?', 'failed', 'Saved recording is missing or incomplete. Download it again.', id);
  return undefined;
}

/** Persist completion only after native transfer, size verification and a final consent check. */
export async function transferQuranAudio(db: Database, files: QuranAudioDownload[], networkAllowed: () => boolean,
  runtime: AudioDownloadRuntime, onProgress: (completed: number, total: number) => void, options: AudioDownloadOptions = {}): Promise<void> {
  if (running.has(db)) throw new QuranProviderError('An audio download is already running.');
  if (!files.length || new Set(files.map(file => file.id)).size !== files.length || files.some(file => !Number.isSafeInteger(file.bytes) || file.bytes! <= 0)) throw new QuranProviderError('Check audio sizes before confirming the download.');
  const totalBytes = files.reduce((sum, file) => sum + file.bytes!, 0);
  if (!Number.isSafeInteger(totalBytes)) throw new QuranProviderError('The audio size estimate is invalid. Check sizes again.');
  function checkConsent() {
    if (options.signal?.aborted) throw new QuranProviderError('Audio download cancelled. Completed recordings remain available.', undefined, 'download_cancelled');
    if (!networkAllowed()) throw new QuranProviderError('Network access is disabled. Completed recordings remain available.', undefined, 'network_disabled');
  }
  checkConsent();
  running.add(db);
  let completed = 0;
  let transferredBytes = 0;
  try {
    const pending: QuranAudioDownload[] = [];
    for (const file of files) {
      const path = await verifiedAudioPath(db, file.id, runtime);
      if (path && runtime.inspect(path).size === file.bytes) { completed++; transferredBytes += file.bytes!; }
      else pending.push(file);
    }
    const required = pending.reduce((sum, file) => sum + file.bytes!, 0);
    const free = runtime.availableBytes();
    if (!Number.isFinite(free) || free < required + (required ? 1024 * 1024 : 0)) throw new QuranProviderError('There is not enough free storage for this audio. Free some space and try again.', undefined, 'storage_full');
    onProgress(completed, files.length);
    options.onBytes?.(transferredBytes, totalBytes);
    for (const file of pending) {
      checkConsent();
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120000);
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      const monitor = setInterval(() => { if (!networkAllowed()) controller.abort(); }, 250);
      let transfer: AudioTransfer | undefined;
      try {
        await db.runAsync('INSERT OR REPLACE INTO downloads(id,resource,resource_id,status,bytes,total_bytes,path,error) VALUES (?,?,?,?,?,?,?,?)', file.id, file.resource, file.resourceId, 'downloading', 0, file.bytes!, null, null);
        checkConsent();
        transfer = runtime.create(file, controller.signal, bytes => {
          options.onBytes?.(transferredBytes + Math.max(0, Math.min(file.bytes!, bytes)), totalBytes);
        });
        const output = await transfer.download();
        checkConsent();
        if (timedOut) throw new QuranProviderError('The audio download timed out. Try again on a stable connection.', undefined, 'audio_timeout');
        if (!output || output.size !== file.bytes || !runtime.inspect(output.uri).exists || runtime.inspect(output.uri).size !== file.bytes) throw new QuranProviderError('The recording is incomplete or its size changed. Check sizes again before retrying.', undefined, 'audio_size_changed');
        await db.withTransactionAsync(async tx=>{checkConsent();await tx.runAsync('UPDATE downloads SET status=?,bytes=?,path=?,error=NULL WHERE id=?','complete',output.size,output.uri,file.id);checkConsent();});
        completed++; transferredBytes += output.size;
        onProgress(completed, files.length);
        options.onBytes?.(transferredBytes, totalBytes);
      } catch (error) {
        try { transfer?.remove(); } catch { /* Preserve the transfer failure if cleanup fails. */ }
        let failure = error instanceof QuranProviderError ? error : new QuranProviderError('The recording could not be downloaded. Check your connection and try again.', undefined, 'audio_download_failed');
        if (options.signal?.aborted) failure = new QuranProviderError('Audio download cancelled. Completed recordings remain available.', undefined, 'download_cancelled');
        else if (!networkAllowed()) failure = new QuranProviderError('Network access was disabled. Completed recordings remain available.', undefined, 'network_disabled');
        else if (timedOut) failure = new QuranProviderError('The audio download timed out. Try again on a stable connection.', undefined, 'audio_timeout');
        await db.runAsync('UPDATE downloads SET status=?,bytes=0,path=NULL,error=? WHERE id=?', 'failed', failure.message, file.id);
        throw failure;
      } finally {
        clearTimeout(timer); clearInterval(monitor); options.signal?.removeEventListener('abort', abort);
        try { transfer?.release(); } catch { /* Completion/error is already recorded. */ }
      }
    }
  } finally { running.delete(db); }
}
