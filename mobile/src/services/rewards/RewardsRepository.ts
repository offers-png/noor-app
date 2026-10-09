import type { Database } from '../database/types';

export const DAILY_TARGET = 100;
export const DAILY_REWARD_CENTS = 100;

export type ActivityKind = 'quran_memorization' | 'dua_recitation' | 'hadith_memorization' | 'salah_lesson' | 'salah_demonstration'
  | 'wudu_demonstration' | 'quiz' | 'revision';
type Scope = 'item-day' | 'kind-day';
interface ActivityRule { label: string; points: number; verification: 'app' | 'parent'; scope: Scope; dailyCap?: number }

/** Parent-reviewed video activities need approval; app-verified ones are checked by the app (quiz score, finished lesson). */
export const ACTIVITY_RULES: Record<ActivityKind, ActivityRule> = {
  quran_memorization: { label: 'Quran memorization', points: 20, verification: 'parent', scope: 'item-day' },
  dua_recitation: { label: 'Dua recited from memory', points: 15, verification: 'parent', scope: 'item-day' },
  hadith_memorization: { label: 'Hadith memorized and explained', points: 15, verification: 'parent', scope: 'item-day' },
  salah_demonstration: { label: 'Salah practice shown', points: 15, verification: 'parent', scope: 'item-day' },
  wudu_demonstration: { label: 'Wudu demonstrated', points: 15, verification: 'parent', scope: 'kind-day' },
  salah_lesson: { label: 'Salah lesson completed', points: 15, verification: 'app', scope: 'kind-day' },
  quiz: { label: 'Islamic knowledge quiz passed', points: 10, verification: 'app', scope: 'item-day', dailyCap: 30 },
  revision: { label: 'Daily revision', points: 10, verification: 'app', scope: 'kind-day' },
};
export const QUIZ_PASS_SCORE = 80;

export interface RewardSettings { timeZone: string; retentionDays: number; salahApproach: SalahApproach }
export type SalahApproach = 'teacher' | 'hanafi' | 'maliki' | 'shafii' | 'hanbali';
export const SALAH_APPROACHES: Record<SalahApproach, string> = {
  teacher: 'Follow our teacher or local masjid', hanafi: 'Hanafi school', maliki: 'Maliki school', shafii: 'Shafi‘i school', hanbali: 'Hanbali school',
};
const SETTINGS_KEY = 'rewards-settings:v1';

export interface LedgerEntry {
  id: string; child_id: number; kind: ActivityKind | 'adjustment'; item_ref: string; title: string; award_key: string; day: string;
  points: number; status: 'pending' | 'approved' | 'retry' | 'rejected'; verification: 'app' | 'parent' | 'adjustment';
  recording_id: string | null; note: string | null; created_at: string; decided_at: string | null;
}
export interface DailyReward { child_id: number; day: string; amount_cents: number; status: 'unpaid' | 'paid'; earned_at: string; payout_id: string | null }
export interface Payout { id: string; child_id: number; amount_cents: number; paid_at: string; note: string | null }
export interface ChildRewardSummary {
  day: string; todayPoints: number; target: number; remaining: number; earnedTodayCents: number; unpaidCents: number; paidCents: number;
  pendingCount: number; entries: LedgerEntry[]; rewards: DailyReward[]; payouts: Payout[];
}
export type SubmitResult = { status: 'pending' | 'approved'; entryId: string } | { status: 'duplicate' | 'capped'; entryId?: string };

function defaultTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
export function validTimeZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date(0)); return !!zone.trim(); } catch { return false; }
}
/** Calendar day (YYYY-MM-DD) in the parent's time zone; points reset at that local midnight. */
export function rewardDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
let sequence = 0;
function newId(prefix: string): string { sequence = (sequence + 1) % 1e6; return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${sequence}`; }
function guard(parentAllowed: () => boolean) { if (!parentAllowed()) throw new Error('Enter your parent PIN to continue.'); }

export class RewardsRepository {
  constructor(private readonly db: Database, private readonly now: () => Date = () => new Date()) {}

  /** Pass the transaction handle when called inside one; the shared adapter queues other queries. */
  async settings(source: Database = this.db): Promise<RewardSettings> {
    const row = await source.getFirstAsync<{ value_json: string }>('SELECT value_json FROM app_settings WHERE key=?', SETTINGS_KEY);
    const stored = row ? JSON.parse(row.value_json) as Partial<RewardSettings> : {};
    return {
      timeZone: stored.timeZone && validTimeZone(stored.timeZone) ? stored.timeZone : defaultTimeZone(),
      retentionDays: Number.isInteger(stored.retentionDays) && stored.retentionDays! >= 0 ? stored.retentionDays! : 30,
      salahApproach: stored.salahApproach && stored.salahApproach in SALAH_APPROACHES ? stored.salahApproach : 'teacher',
    };
  }
  async saveSettings(value: Partial<RewardSettings>, parentAllowed: () => boolean): Promise<RewardSettings> {
    guard(parentAllowed);
    if (value.timeZone !== undefined && !validTimeZone(value.timeZone)) throw new Error('Enter a valid time zone, such as America/New_York.');
    if (value.retentionDays !== undefined && (!Number.isInteger(value.retentionDays) || value.retentionDays < 0 || value.retentionDays > 365)) throw new Error('Keep recordings for 0 to 365 days (0 keeps them until you delete them).');
    if (value.salahApproach !== undefined && !(value.salahApproach in SALAH_APPROACHES)) throw new Error('Choose a listed teaching approach.');
    const next = { ...await this.settings(), ...value };
    await this.db.runAsync('INSERT OR REPLACE INTO app_settings(key,value_json) VALUES (?,?)', SETTINGS_KEY, JSON.stringify(next));
    return next;
  }
  async today(): Promise<string> { return rewardDay(this.now(), (await this.settings()).timeZone); }

  /**
   * Records a completed activity for one child. App-verified activities are approved immediately;
   * video activities wait for a parent. The same award can never be counted twice.
   */
  async submit(input: { childId: number; kind: ActivityKind; itemRef: string; title: string; recordingId?: string }, tx: Database = this.db): Promise<SubmitResult> {
    const rule = ACTIVITY_RULES[input.kind];
    if (!rule) throw new Error('Unknown activity.');
    if (!input.itemRef.trim()) throw new Error('Choose what was practised.');
    if (rule.verification === 'parent' && !input.recordingId) throw new Error('This activity needs a recording for your parent to review.');
    if (rule.verification === 'app' && input.recordingId) throw new Error('App-checked activities do not take recordings.');
    const child = await tx.getFirstAsync<{ id: number }>('SELECT id FROM children WHERE id=?', input.childId);
    if (!child) throw new Error('Choose a child profile first.');
    const now = this.now();
    const day = rewardDay(now, (await this.settings(tx)).timeZone);
    const awardKey = rule.scope === 'kind-day' ? `${input.kind}:${day}` : `${input.kind}:${input.itemRef}:${day}`;
    const existing = await tx.getFirstAsync<LedgerEntry>('SELECT * FROM points_ledger WHERE child_id=? AND award_key=?', input.childId, awardKey);
    if (existing) {
      // A parent's "try again" re-opens the same award for a new recording; anything else is a duplicate.
      if (existing.status === 'retry' && rule.verification === 'parent') {
        await tx.runAsync('UPDATE points_ledger SET status=?,recording_id=?,title=?,created_at=?,decided_at=NULL,note=NULL WHERE id=?', 'pending', input.recordingId ?? null, input.title, now.toISOString(), existing.id);
        return { status: 'pending', entryId: existing.id };
      }
      return { status: 'duplicate', entryId: existing.id };
    }
    if (rule.dailyCap !== undefined) {
      const used = await tx.getFirstAsync<{ total: number | null }>("SELECT SUM(points) AS total FROM points_ledger WHERE child_id=? AND kind=? AND day=? AND status IN ('approved','pending')", input.childId, input.kind, day);
      if ((used?.total ?? 0) + rule.points > rule.dailyCap) return { status: 'capped' };
    }
    const id = newId('pts');
    const status = rule.verification === 'app' ? 'approved' : 'pending';
    await tx.runAsync('INSERT INTO points_ledger(id,child_id,kind,item_ref,title,award_key,day,points,status,verification,recording_id,note,created_at,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      id, input.childId, input.kind, input.itemRef, input.title, awardKey, day, rule.points, status, rule.verification, input.recordingId ?? null, null, now.toISOString(), status === 'approved' ? now.toISOString() : null);
    if (status === 'approved') await this.recompute(tx, input.childId, day);
    return { status, entryId: id };
  }

  async approve(entryId: string, parentAllowed: () => boolean, points?: number): Promise<void> {
    await this.decide(entryId, parentAllowed, 'approved', undefined, points);
  }
  /** "Try again" lets the child record a new attempt for the same item today; "reject" closes it. */
  async reject(entryId: string, parentAllowed: () => boolean, options: { allowRetry: boolean; note?: string }): Promise<void> {
    await this.decide(entryId, parentAllowed, options.allowRetry ? 'retry' : 'rejected', options.note);
  }
  /** Parent correction of an entry's points (0–100). Re-evaluates that day's reward. */
  async correct(entryId: string, points: number, parentAllowed: () => boolean, note?: string): Promise<void> {
    if (!Number.isInteger(points) || points < 0 || points > DAILY_TARGET) throw new Error('Points must be a whole number from 0 to 100.');
    guard(parentAllowed);
    await this.db.withTransactionAsync(async tx => {
      guard(parentAllowed);
      const entry = await tx.getFirstAsync<LedgerEntry>('SELECT * FROM points_ledger WHERE id=?', entryId);
      if (!entry) throw new Error('This activity no longer exists.');
      await tx.runAsync('UPDATE points_ledger SET points=?,note=?,decided_at=? WHERE id=?', points, note?.trim() || entry.note, this.now().toISOString(), entryId);
      await this.recompute(tx, entry.child_id, entry.day);
    });
  }
  /** Signed parent adjustment for a child on a given reward day (defaults to today). */
  async adjust(childId: number, points: number, note: string, parentAllowed: () => boolean, day?: string): Promise<string> {
    if (!Number.isInteger(points) || points === 0 || Math.abs(points) > DAILY_TARGET) throw new Error('Adjust by a whole number between -100 and 100.');
    if (!note.trim()) throw new Error('Add a short note explaining the adjustment.');
    guard(parentAllowed);
    const target = day ?? await this.today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) throw new Error('Invalid day.');
    const id = newId('adj');
    await this.db.withTransactionAsync(async tx => {
      guard(parentAllowed);
      if (!await tx.getFirstAsync('SELECT id FROM children WHERE id=?', childId)) throw new Error('Choose a child profile first.');
      const now = this.now().toISOString();
      await tx.runAsync('INSERT INTO points_ledger(id,child_id,kind,item_ref,title,award_key,day,points,status,verification,recording_id,note,created_at,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        id, childId, 'adjustment', id, 'Parent adjustment', `adjustment:${id}`, target, points, 'approved', 'adjustment', null, note.trim(), now, now);
      await this.recompute(tx, childId, target);
    });
    return id;
  }
  private async decide(entryId: string, parentAllowed: () => boolean, status: 'approved' | 'retry' | 'rejected', note?: string, points?: number): Promise<void> {
    guard(parentAllowed);
    if (points !== undefined && (!Number.isInteger(points) || points < 0 || points > DAILY_TARGET)) throw new Error('Points must be a whole number from 0 to 100.');
    await this.db.withTransactionAsync(async tx => {
      guard(parentAllowed);
      const entry = await tx.getFirstAsync<LedgerEntry>('SELECT * FROM points_ledger WHERE id=?', entryId);
      if (!entry) throw new Error('This activity no longer exists.');
      if (entry.verification !== 'parent') throw new Error('Only recorded activities wait for parent review. Use a correction instead.');
      if (entry.status !== 'pending') throw new Error('This activity was already reviewed.');
      await tx.runAsync('UPDATE points_ledger SET status=?,note=?,decided_at=?,points=? WHERE id=?', status, note?.trim() || null, this.now().toISOString(), points ?? entry.points, entryId);
      await this.recompute(tx, entry.child_id, entry.day);
    });
  }
  /** One $1 reward per child per day at 100 approved points. Paid rewards are never removed. */
  private async recompute(tx: Database, childId: number, day: string): Promise<void> {
    const total = await this.dayPoints(childId, day, tx);
    if (total >= DAILY_TARGET) await tx.runAsync('INSERT OR IGNORE INTO daily_rewards(child_id,day,amount_cents,status,earned_at,payout_id) VALUES (?,?,?,?,?,?)', childId, day, DAILY_REWARD_CENTS, 'unpaid', this.now().toISOString(), null);
    else await tx.runAsync('DELETE FROM daily_rewards WHERE child_id=? AND day=? AND status=?', childId, day, 'unpaid');
  }
  async dayPoints(childId: number, day: string, tx: Database = this.db): Promise<number> {
    const row = await tx.getFirstAsync<{ total: number | null }>("SELECT SUM(points) AS total FROM points_ledger WHERE child_id=? AND day=? AND status='approved'", childId, day);
    return Math.max(0, row?.total ?? 0);
  }

  /** Records that a parent paid every unpaid reward for one child. No money moves through the app. */
  async markPaid(childId: number, parentAllowed: () => boolean, note?: string): Promise<Payout> {
    guard(parentAllowed);
    let payout: Payout | undefined;
    await this.db.withTransactionAsync(async tx => {
      guard(parentAllowed);
      const unpaid = await tx.getAllAsync<DailyReward>('SELECT * FROM daily_rewards WHERE child_id=? AND status=? ORDER BY day', childId, 'unpaid');
      if (!unpaid.length) throw new Error('There are no unpaid rewards for this child.');
      payout = { id: newId('pay'), child_id: childId, amount_cents: unpaid.reduce((sum, reward) => sum + reward.amount_cents, 0), paid_at: this.now().toISOString(), note: note?.trim() || null };
      await tx.runAsync('INSERT INTO reward_payouts(id,child_id,amount_cents,paid_at,note) VALUES (?,?,?,?,?)', payout.id, childId, payout.amount_cents, payout.paid_at, payout.note);
      await tx.runAsync('UPDATE daily_rewards SET status=?,payout_id=? WHERE child_id=? AND status=?', 'paid', payout.id, childId, 'unpaid');
    });
    return payout!;
  }

  async summary(childId: number): Promise<ChildRewardSummary> {
    const day = await this.today();
    const todayPoints = await this.dayPoints(childId, day);
    const rewards = await this.db.getAllAsync<DailyReward>('SELECT * FROM daily_rewards WHERE child_id=? ORDER BY day DESC', childId);
    const payouts = await this.db.getAllAsync<Payout>('SELECT * FROM reward_payouts WHERE child_id=? ORDER BY paid_at DESC', childId);
    const entries = await this.db.getAllAsync<LedgerEntry>('SELECT * FROM points_ledger WHERE child_id=? ORDER BY created_at DESC LIMIT 60', childId);
    const pending = await this.db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM points_ledger WHERE child_id=? AND status='pending'", childId);
    return {
      day, todayPoints, target: DAILY_TARGET, remaining: Math.max(0, DAILY_TARGET - todayPoints),
      earnedTodayCents: rewards.find(reward => reward.day === day)?.amount_cents ?? 0,
      unpaidCents: rewards.filter(reward => reward.status === 'unpaid').reduce((sum, reward) => sum + reward.amount_cents, 0),
      paidCents: payouts.reduce((sum, payout) => sum + payout.amount_cents, 0),
      pendingCount: pending?.count ?? 0, entries, rewards, payouts,
    };
  }
  pending(): Promise<(LedgerEntry & { nickname: string; avatar: string })[]> {
    return this.db.getAllAsync("SELECT p.*,c.nickname,c.avatar FROM points_ledger p JOIN children c ON c.id=p.child_id WHERE p.status='pending' ORDER BY p.created_at");
  }
}

export function formatCents(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }
