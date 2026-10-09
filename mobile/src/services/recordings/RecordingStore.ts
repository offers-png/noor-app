import type { Database } from '../database/types';
import { ACTIVITY_RULES, RewardsRepository, type ActivityKind, type LedgerEntry } from '../rewards/RewardsRepository';

/**
 * Children's recitation videos stay in the app's private storage (Android app-internal files,
 * protected by the OS sandbox and device file-based encryption). Nothing is uploaded or shared.
 */
export const MIN_FREE_BYTES = 200 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 180;

export interface RecordingFiles {
  availableBytes(): number;
  /** Moves a finished camera capture into private storage and returns its final location and size. */
  keep(tempUri: string, name: string): Promise<{ uri: string; size: number }>;
  remove(uri: string): void;
}
export interface RecordingRow { id: string; child_id: number; kind: ActivityKind; item_ref: string; title: string; path: string; bytes: number; duration_ms: number | null; created_at: string }
export interface RecordingWithReview extends RecordingRow { nickname: string; avatar: string; ledger_id: string | null; status: LedgerEntry['status'] | null; points: number | null; note: string | null }

export function canStartRecording(files: Pick<RecordingFiles, 'availableBytes'>): { ok: true } | { ok: false; reason: string } {
  let free = 0;
  try { free = files.availableBytes(); } catch { /* treated as unknown */ }
  if (!Number.isFinite(free) || free < MIN_FREE_BYTES) return { ok: false, reason: 'There is not enough free space on this phone to record. Ask a parent to free up some space.' };
  return { ok: true };
}

let counter = 0;
function recordingId(): string { counter = (counter + 1) % 1e6; return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${counter}`; }
function guard(parentAllowed: () => boolean) { if (!parentAllowed()) throw new Error('Enter your parent PIN to continue.'); }

export class RecordingStore {
  constructor(private readonly db: Database, private readonly files: RecordingFiles, private readonly rewards = new RewardsRepository(db), private readonly now: () => Date = () => new Date()) {}

  /** Saves a finished recording and submits it for parent review. Duplicates are discarded, never kept. */
  async submit(input: { childId: number; kind: ActivityKind; itemRef: string; title: string; tempUri: string; durationMs?: number }): Promise<{ recordingId: string; entryId: string }> {
    const discardTemp = () => { try { this.files.remove(input.tempUri); } catch { /* already gone */ } };
    if (ACTIVITY_RULES[input.kind]?.verification !== 'parent') { discardTemp(); throw new Error('This activity is not reviewed by video.'); }
    if (!await this.db.getFirstAsync('SELECT id FROM children WHERE id=?', input.childId)) { discardTemp(); throw new Error('Choose a child profile first.'); }
    const id = recordingId();
    let kept: { uri: string; size: number };
    try { kept = await this.files.keep(input.tempUri, `${input.childId}-${id}.mp4`); }
    catch { discardTemp(); throw new Error('The recording could not be saved. Check that the phone has free space and try again.'); }
    if (!Number.isSafeInteger(kept.size) || kept.size <= 0) { this.files.remove(kept.uri); throw new Error('The recording was empty or interrupted. Please record again.'); }
    let entryId = '';
    let replaced: string | null = null;
    try {
      await this.db.withTransactionAsync(async tx => {
        await tx.runAsync('INSERT INTO recordings(id,child_id,kind,item_ref,title,path,bytes,duration_ms,created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, input.childId, input.kind, input.itemRef, input.title, kept.uri, kept.size, input.durationMs ?? null, this.now().toISOString());
        const before = await tx.getAllAsync<{ id: string; recording_id: string | null }>("SELECT id,recording_id FROM points_ledger WHERE child_id=? AND kind=? AND status='retry'", input.childId, input.kind);
        const result = await this.rewards.submit({ childId: input.childId, kind: input.kind, itemRef: input.itemRef, title: input.title, recordingId: id }, tx);
        if (result.status === 'duplicate') throw new Error('You already sent this today. Your parent will review it.');
        if (result.status === 'capped') throw new Error('You have reached today’s limit for this activity.');
        if (!result.entryId) throw new Error('The recording could not be submitted. Please try again.');
        entryId = result.entryId;
        replaced = before.find(row => row.id === result.entryId)?.recording_id ?? null;
      });
    } catch (error) {
      this.files.remove(kept.uri);
      throw error;
    }
    if (replaced) await this.deleteRows([replaced]); // the earlier attempt a parent asked to redo
    return { recordingId: id, entryId };
  }

  list(childId?: number): Promise<RecordingWithReview[]> {
    const sql = `SELECT r.*,c.nickname,c.avatar,p.id AS ledger_id,p.status,p.points,p.note FROM recordings r JOIN children c ON c.id=r.child_id
      LEFT JOIN points_ledger p ON p.recording_id=r.id ${childId ? 'WHERE r.child_id=?' : ''} ORDER BY r.created_at DESC`;
    return childId ? this.db.getAllAsync(sql, childId) : this.db.getAllAsync(sql);
  }
  /** Only a parent may open a recording file for playback or export. */
  async pathForParent(id: string, parentAllowed: () => boolean): Promise<string> {
    guard(parentAllowed);
    const row = await this.db.getFirstAsync<{ path: string }>('SELECT path FROM recordings WHERE id=?', id);
    if (!row) throw new Error('This recording was deleted.');
    return row.path;
  }
  async usage(): Promise<{ count: number; bytes: number }> {
    const row = await this.db.getFirstAsync<{ count: number; bytes: number | null }>('SELECT COUNT(*) AS count,SUM(bytes) AS bytes FROM recordings');
    return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
  }
  async delete(ids: string[], parentAllowed: () => boolean): Promise<number> {
    guard(parentAllowed);
    return this.deleteRows(ids);
  }
  async deleteForChild(childId: number, parentAllowed: () => boolean): Promise<number> {
    guard(parentAllowed);
    return this.deleteRows((await this.db.getAllAsync<{ id: string }>('SELECT id FROM recordings WHERE child_id=?', childId)).map(row => row.id));
  }
  /** Deletes reviewed recordings older than the retention period. Videos still awaiting review are kept. 0 days keeps everything. */
  async applyRetention(days: number): Promise<number> {
    if (!Number.isInteger(days) || days <= 0) return 0;
    const cutoff = new Date(this.now().getTime() - days * 86400000).toISOString();
    const rows = await this.db.getAllAsync<{ id: string }>(`SELECT r.id FROM recordings r LEFT JOIN points_ledger p ON p.recording_id=r.id
      WHERE r.created_at < ? AND (p.status IS NULL OR p.status <> 'pending')`, cutoff);
    return this.deleteRows(rows.map(row => row.id));
  }
  private async deleteRows(ids: string[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      const row = await this.db.getFirstAsync<{ path: string }>('SELECT path FROM recordings WHERE id=?', id);
      if (!row) continue;
      try { this.files.remove(row.path); } catch { /* a missing file is already removed */ }
      await this.db.withTransactionAsync(async tx => {
        // A video deleted before review can no longer be verified, so it cannot earn points.
        await tx.runAsync("UPDATE points_ledger SET status='rejected',note='Recording deleted before review',decided_at=? WHERE recording_id=? AND status='pending'", this.now().toISOString(), id);
        await tx.runAsync('UPDATE points_ledger SET recording_id=NULL WHERE recording_id=?', id);
        await tx.runAsync('DELETE FROM recordings WHERE id=?', id);
      });
      deleted++;
    }
    return deleted;
  }
}

/** Native private-storage adapter. Loaded lazily so tests and web never touch device files. */
export async function nativeRecordingFiles(): Promise<RecordingFiles> {
  const { Directory, File, Paths } = await import('expo-file-system');
  const directory = new Directory(Paths.document, 'recordings');
  directory.create({ idempotent: true, intermediates: true });
  return {
    availableBytes: () => Paths.availableDiskSpace,
    async keep(tempUri, name) {
      const source = new File(tempUri);
      const destination = new File(directory, name);
      await source.move(destination);
      return { uri: destination.uri, size: destination.size };
    },
    remove(uri) { const file = new File(uri); if (file.exists) file.delete(); },
  };
}
export function formatBytes(bytes: number): string {
  return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${(bytes / 1048576).toFixed(1)} MB`;
}
