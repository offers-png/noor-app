import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import { schemaV2 } from '../src/database/migrations/002';
import type { Database, SqlValue } from '../src/services/database/types';
import { ACTIVITY_RULES, RewardsRepository, rewardDay } from '../src/services/rewards/RewardsRepository';

function database() {
  const native = new DatabaseSync(':memory:'); native.exec(schema); native.exec(schemaV2);
  const db: Database = { execAsync: async sql => { native.exec(sql); }, runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; }, getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null, getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[], withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } } };
  native.exec("INSERT INTO children(nickname,avatar,created_at) VALUES ('Amina','⭐','2026-01-01'),('Yusuf','🌙','2026-01-01')");
  return { db, close: () => native.close() };
}
const parent = () => true;
const child = () => false;
/** Clock the tests can move; parent time zone pinned to New York. */
async function setup(start = '2026-10-08T15:00:00Z') {
  const { db, close } = database(); let now = new Date(start);
  const repo = new RewardsRepository(db, () => now);
  await repo.saveSettings({ timeZone: 'America/New_York' }, parent);
  return { db, close, repo, setNow: (value: string) => { now = new Date(value); } };
}
const video = (repo: RewardsRepository, childId: number, kind: 'quran_memorization' | 'dua_recitation' | 'hadith_memorization' | 'wudu_demonstration' | 'salah_demonstration', itemRef: string) =>
  repo.submit({ childId, kind, itemRef, title: itemRef, recordingId: `rec-${kind}-${itemRef}` });

test('the reward day follows the parent time zone, resetting at local midnight', () => {
  assert.equal(rewardDay(new Date('2026-10-09T03:59:00Z'), 'America/New_York'), '2026-10-08');
  assert.equal(rewardDay(new Date('2026-10-09T04:00:00Z'), 'America/New_York'), '2026-10-09');
  assert.equal(rewardDay(new Date('2026-10-08T22:30:00Z'), 'Asia/Karachi'), '2026-10-09');
});

test('100 approved points earn exactly $1 per child per day, and nothing more', async () => {
  const { close, repo } = await setup();
  try {
    for (const surah of ['1', '112', '113', '114', '107']) { const result = await video(repo, 1, 'quran_memorization', surah); assert.equal(result.status, 'pending'); await repo.approve(result.entryId!, parent); }
    let summary = await repo.summary(1);
    assert.equal(summary.todayPoints, 100); assert.equal(summary.remaining, 0); assert.equal(summary.earnedTodayCents, 100); assert.equal(summary.unpaidCents, 100);
    const more = await video(repo, 1, 'dua_recitation', 'dua-knowledge'); await repo.approve(more.entryId!, parent);
    summary = await repo.summary(1);
    assert.equal(summary.todayPoints, 115); assert.equal(summary.earnedTodayCents, 100, 'Maximum $1 per day'); assert.equal(summary.unpaidCents, 100);
    assert.equal((await repo.summary(2)).todayPoints, 0, 'Other children are unaffected');
  } finally { close(); }
});

test('only verified points count: pending recordings earn nothing until a parent approves', async () => {
  const { close, repo } = await setup();
  try {
    const pending = await video(repo, 1, 'hadith_memorization', 'bukhari-1');
    assert.equal(pending.status, 'pending'); assert.equal((await repo.summary(1)).todayPoints, 0); assert.equal((await repo.summary(1)).pendingCount, 1);
    await assert.rejects(repo.submit({ childId: 1, kind: 'dua_recitation', itemRef: 'x', title: 'x' }), /recording/);
    await assert.rejects(repo.submit({ childId: 1, kind: 'quiz', itemRef: 'q', title: 'q', recordingId: 'r' }), /do not take recordings/);
    const quiz = await repo.submit({ childId: 1, kind: 'quiz', itemRef: 'islam-salah', title: 'Quiz' });
    assert.equal(quiz.status, 'approved'); assert.equal((await repo.summary(1)).todayPoints, 10);
  } finally { close(); }
});

test('duplicate submissions and repeated rewards are refused', async () => {
  const { close, repo } = await setup();
  try {
    const first = await video(repo, 1, 'quran_memorization', '112');
    assert.equal((await video(repo, 1, 'quran_memorization', '112')).status, 'duplicate', 'same item, same day');
    await repo.approve(first.entryId!, parent);
    await assert.rejects(repo.approve(first.entryId!, parent), /already reviewed/, 'cannot be approved twice');
    assert.equal((await repo.summary(1)).todayPoints, 20);
    assert.equal((await repo.submit({ childId: 1, kind: 'revision', itemRef: 'a', title: 'a' })).status, 'approved');
    assert.equal((await repo.submit({ childId: 1, kind: 'revision', itemRef: 'b', title: 'b' })).status, 'duplicate', 'one revision award per day');
    for (const id of ['q1', 'q2', 'q3']) assert.equal((await repo.submit({ childId: 1, kind: 'quiz', itemRef: id, title: id })).status, 'approved');
    assert.equal((await repo.submit({ childId: 1, kind: 'quiz', itemRef: 'q4', title: 'q4' })).status, 'capped', 'quiz points are capped at 30 per day');
    assert.equal((await repo.submit({ childId: 1, kind: 'quiz', itemRef: 'q1', title: 'q1' })).status, 'duplicate');
    assert.equal((await repo.summary(1)).todayPoints, 20 + 10 + 30);
    // Another child can earn the same items independently.
    assert.equal((await video(repo, 2, 'quran_memorization', '112')).status, 'pending');
  } finally { close(); }
});

test('points reset at midnight in the parent time zone; earned dollars accumulate', async () => {
  const { close, repo, setNow } = await setup('2026-10-09T03:00:00Z'); // 11pm Oct 8 in New York
  try {
    for (const surah of ['1', '112', '113', '114', '107']) await repo.approve((await video(repo, 1, 'quran_memorization', surah)).entryId!, parent);
    assert.equal((await repo.summary(1)).day, '2026-10-08');
    setNow('2026-10-09T04:30:00Z'); // 12:30am Oct 9 in New York
    let summary = await repo.summary(1);
    assert.equal(summary.day, '2026-10-09'); assert.equal(summary.todayPoints, 0); assert.equal(summary.earnedTodayCents, 0); assert.equal(summary.unpaidCents, 100);
    for (const surah of ['1', '112', '113', '114', '107']) await repo.approve((await video(repo, 1, 'quran_memorization', surah)).entryId!, parent);
    summary = await repo.summary(1);
    assert.equal(summary.todayPoints, 100, 'the same surahs can be shown again on a new day'); assert.equal(summary.unpaidCents, 200);
  } finally { close(); }
});

test('late approval counts toward the day the child submitted', async () => {
  const { close, repo, setNow } = await setup('2026-10-08T20:00:00Z');
  try {
    const entries = [];
    for (const surah of ['1', '112', '113', '114', '107']) entries.push((await video(repo, 1, 'quran_memorization', surah)).entryId!);
    setNow('2026-10-09T14:00:00Z');
    for (const id of entries) await repo.approve(id, parent);
    const summary = await repo.summary(1);
    assert.equal(summary.todayPoints, 0); assert.deepEqual(summary.rewards.map(reward => reward.day), ['2026-10-08']);
  } finally { close(); }
});

test('parent approve, retry, reject and corrections; children cannot approve or change balances', async () => {
  const { close, repo } = await setup();
  try {
    const entry = await video(repo, 1, 'dua_recitation', 'dua-before-eating');
    await assert.rejects(repo.approve(entry.entryId!, child), /PIN/);
    await assert.rejects(repo.adjust(1, 100, 'gift', child), /PIN/);
    await assert.rejects(repo.markPaid(1, child), /PIN/);
    await assert.rejects(repo.saveSettings({ timeZone: 'UTC' }, child), /PIN/);
    await repo.reject(entry.entryId!, parent, { allowRetry: true, note: 'Try the last word again' });
    assert.equal((await repo.summary(1)).todayPoints, 0);
    const retry = await video(repo, 1, 'dua_recitation', 'dua-before-eating');
    assert.deepEqual(retry, { status: 'pending', entryId: entry.entryId }, 'a retry re-opens the same award');
    await repo.reject(entry.entryId!, parent, { allowRetry: false });
    assert.equal((await video(repo, 1, 'dua_recitation', 'dua-before-eating')).status, 'duplicate', 'a rejected item cannot be resubmitted the same day');
    const other = await video(repo, 1, 'wudu_demonstration', 'wudu');
    await repo.approve(other.entryId!, parent, 10);
    assert.equal((await repo.summary(1)).todayPoints, 10, 'parent can approve with corrected points');
    await repo.correct(other.entryId!, 15, parent, 'Full marks after review');
    assert.equal((await repo.summary(1)).todayPoints, 15);
    await assert.rejects(repo.correct(other.entryId!, 500, parent), /0 to 100/);
    await assert.rejects(repo.approve((await repo.submit({ childId: 1, kind: 'quiz', itemRef: 'q', title: 'q' })).entryId!, parent), /Only recorded/);
  } finally { close(); }
});

test('corrections remove an unpaid reward but never a paid one; payouts record history without moving money', async () => {
  const { close, repo } = await setup();
  try {
    await repo.adjust(1, 100, 'Helped teach a sibling', parent);
    assert.equal((await repo.summary(1)).unpaidCents, 100);
    const correction = await repo.adjust(1, -30, 'Counted twice by mistake', parent);
    assert.ok(correction); assert.equal((await repo.summary(1)).unpaidCents, 0, 'unpaid reward withdrawn below 100 points');
    await repo.adjust(1, 30, 'Restored', parent);
    const payout = await repo.markPaid(1, parent, 'Cash');
    assert.equal(payout.amount_cents, 100);
    await assert.rejects(repo.markPaid(1, parent), /no unpaid/);
    await repo.adjust(1, -50, 'Later correction', parent);
    const summary = await repo.summary(1);
    assert.equal(summary.paidCents, 100); assert.equal(summary.rewards[0].status, 'paid', 'paid history is kept'); assert.equal(summary.unpaidCents, 0);
    await assert.rejects(repo.adjust(1, 0, 'x', parent), /between/); await assert.rejects(repo.adjust(1, 5, ' ', parent), /note/);
  } finally { close(); }
});

test('deleting a child removes only that child’s points and rewards', async () => {
  const { db, close, repo } = await setup();
  try {
    await repo.adjust(1, 100, 'a', parent); await repo.adjust(2, 100, 'b', parent);
    await db.runAsync('PRAGMA foreign_keys=ON'); await db.runAsync('DELETE FROM children WHERE id=?', 1);
    assert.equal((await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM daily_rewards'))?.c, 1);
    assert.equal((await repo.summary(2)).unpaidCents, 100);
  } finally { close(); }
});

test('suggested point values match the parent-agreed table', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ACTIVITY_RULES).map(([kind, rule]) => [kind, rule.points])), {
    quran_memorization: 20, dua_recitation: 15, hadith_memorization: 15, salah_demonstration: 15, wudu_demonstration: 15, salah_lesson: 15, quiz: 10, revision: 10,
  });
});

test('settings validate time zone and retention', async () => {
  const { close, repo } = await setup();
  try {
    await assert.rejects(repo.saveSettings({ timeZone: 'Mars/Base' }, parent), /time zone/);
    await assert.rejects(repo.saveSettings({ retentionDays: -1 }, parent), /0 to 365/);
    const saved = await repo.saveSettings({ retentionDays: 7, salahApproach: 'hanafi' }, parent);
    assert.equal(saved.timeZone, 'America/New_York'); assert.equal(saved.retentionDays, 7); assert.equal(saved.salahApproach, 'hanafi');
  } finally { close(); }
});
