import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import { schemaV2 } from '../src/database/migrations/002';
import type { Database, SqlValue } from '../src/services/database/types';
import { RewardsRepository } from '../src/services/rewards/RewardsRepository';
import { canStartRecording, MIN_FREE_BYTES, RecordingStore, type RecordingFiles } from '../src/services/recordings/RecordingStore';

function database() {
  const native = new DatabaseSync(':memory:'); native.exec(schema); native.exec(schemaV2);
  const db: Database = { execAsync: async sql => { native.exec(sql); }, runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; }, getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null, getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[], withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } } };
  native.exec("INSERT INTO children(nickname,avatar,created_at) VALUES ('Amina','⭐','2026-01-01'),('Yusuf','🌙','2026-01-01')");
  return { db, close: () => native.close() };
}
/** In-memory stand-in for the app's private recordings folder. */
function privateFiles(free = 10 * 1024 * 1024 * 1024) {
  const files = new Map<string, number>(); const removed: string[] = [];
  const api: RecordingFiles = {
    availableBytes: () => free,
    keep: async (tempUri, name) => { const size = files.get(tempUri); if (size === undefined) throw new Error('missing'); files.delete(tempUri); const uri = `file:///data/user/0/app/files/recordings/${name}`; files.set(uri, size); return { uri, size }; },
    remove: uri => { removed.push(uri); files.delete(uri); },
  };
  return { api, files, removed, capture: (bytes = 5_000_000) => { const uri = `file:///cache/Camera/${Math.random()}.mp4`; files.set(uri, bytes); return uri; } };
}
const parent = () => true; const child = () => false;
async function setup() {
  const { db, close } = database(); let now = new Date('2026-10-08T15:00:00Z');
  const rewards = new RewardsRepository(db, () => now);
  await rewards.saveSettings({ timeZone: 'UTC' }, parent);
  const files = privateFiles();
  return { db, close, rewards, files, store: new RecordingStore(db, files.api, rewards, () => now), setNow: (v: string) => { now = new Date(v); } };
}

test('a submitted recording is kept privately and waits for parent review before earning points', async () => {
  const { close, rewards, files, store } = await setup();
  try {
    const temp = files.capture();
    const { recordingId, entryId } = await store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '112', title: 'Al-Ikhlas', tempUri: temp, durationMs: 20000 });
    assert.equal(files.files.has(temp), false, 'temporary camera file is moved, not copied');
    const [row] = await store.list(1);
    assert.equal(row.id, recordingId); assert.match(row.path, /\/files\/recordings\//); assert.equal(row.status, 'pending'); assert.equal(row.ledger_id, entryId);
    assert.equal((await rewards.summary(1)).todayPoints, 0);
    await rewards.approve(entryId, parent);
    assert.equal((await rewards.summary(1)).todayPoints, 20);
    assert.deepEqual(await store.list(2), [], 'another child sees none of these recordings');
  } finally { close(); }
});

test('duplicate recordings are discarded instead of stored or rewarded twice', async () => {
  const { close, files, store } = await setup();
  try {
    await store.submit({ childId: 1, kind: 'dua_recitation', itemRef: 'dua-knowledge', title: 'Knowledge', tempUri: files.capture() });
    const second = files.capture();
    await assert.rejects(store.submit({ childId: 1, kind: 'dua_recitation', itemRef: 'dua-knowledge', title: 'Knowledge', tempUri: second }), /already sent/);
    assert.equal((await store.usage()).count, 1); assert.equal([...files.files.keys()].filter(uri => uri.includes('/recordings/')).length, 1, 'duplicate file removed');
    await assert.rejects(store.submit({ childId: 1, kind: 'quiz', itemRef: 'q', title: 'q', tempUri: files.capture() }), /not reviewed by video/);
  } finally { close(); }
});

test('a "try again" request accepts one new attempt and removes the old video', async () => {
  const { close, rewards, files, store } = await setup();
  try {
    const first = await store.submit({ childId: 1, kind: 'wudu_demonstration', itemRef: 'wudu', title: 'Wudu', tempUri: files.capture() });
    await rewards.reject(first.entryId, parent, { allowRetry: true, note: 'Show the elbows' });
    const second = await store.submit({ childId: 1, kind: 'wudu_demonstration', itemRef: 'wudu', title: 'Wudu', tempUri: files.capture() });
    assert.equal(second.entryId, first.entryId);
    const list = await store.list(1);
    assert.deepEqual(list.map(row => row.id), [second.recordingId]); assert.equal(list[0].status, 'pending');
    assert.ok(files.removed.some(uri => uri.includes(first.recordingId)));
  } finally { close(); }
});

test('only a parent can open or delete recordings; deleting an unreviewed video cancels its points', async () => {
  const { close, rewards, files, store } = await setup();
  try {
    const { recordingId, entryId } = await store.submit({ childId: 1, kind: 'hadith_memorization', itemRef: 'bukhari-1', title: 'Intentions', tempUri: files.capture() });
    await assert.rejects(store.pathForParent(recordingId, child), /PIN/);
    assert.match(await store.pathForParent(recordingId, parent), /recordings/);
    await assert.rejects(store.delete([recordingId], child), /PIN/);
    assert.equal(await store.delete([recordingId], parent), 1);
    assert.equal((await store.usage()).count, 0);
    await assert.rejects(rewards.approve(entryId, parent), /already reviewed/);
    assert.equal((await rewards.summary(1)).todayPoints, 0);
  } finally { close(); }
});

test('approved points survive deleting the video afterwards; bulk delete and per-child delete', async () => {
  const { close, rewards, files, store } = await setup();
  try {
    const a = await store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '1', title: 'Al-Fatihah', tempUri: files.capture(1000) });
    await store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '113', title: 'Al-Falaq', tempUri: files.capture(2000) });
    await store.submit({ childId: 2, kind: 'quran_memorization', itemRef: '1', title: 'Al-Fatihah', tempUri: files.capture(3000) });
    await rewards.approve(a.entryId, parent);
    assert.deepEqual(await store.usage(), { count: 3, bytes: 6000 });
    assert.equal(await store.deleteForChild(1, parent), 2);
    assert.equal((await rewards.summary(1)).todayPoints, 20, 'already verified points are kept');
    assert.deepEqual(await store.usage(), { count: 1, bytes: 3000 });
  } finally { close(); }
});

test('retention removes reviewed recordings after the configured days but keeps unreviewed ones', async () => {
  const { close, rewards, files, store, setNow } = await setup();
  try {
    const reviewed = await store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '1', title: 'Al-Fatihah', tempUri: files.capture() });
    await store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '114', title: 'An-Nas', tempUri: files.capture() });
    await rewards.approve(reviewed.entryId, parent);
    setNow('2026-10-20T15:00:00Z');
    assert.equal(await store.applyRetention(0), 0, '0 keeps everything');
    assert.equal(await store.applyRetention(30), 0);
    assert.equal(await store.applyRetention(7), 1);
    const left = await store.list();
    assert.equal(left.length, 1); assert.equal(left[0].status, 'pending');
  } finally { close(); }
});

test('low storage blocks recording before the camera starts; failed saves leave nothing behind', async () => {
  assert.equal(canStartRecording({ availableBytes: () => MIN_FREE_BYTES - 1 }).ok, false);
  assert.equal(canStartRecording({ availableBytes: () => { throw new Error('x'); } }).ok, false);
  assert.equal(canStartRecording({ availableBytes: () => MIN_FREE_BYTES }).ok, true);
  const { close, files, store } = await setup();
  try {
    await assert.rejects(store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '1', title: 'x', tempUri: 'file:///cache/missing.mp4' }), /could not be saved/);
    const empty = files.capture(0);
    await assert.rejects(store.submit({ childId: 1, kind: 'quran_memorization', itemRef: '1', title: 'x', tempUri: empty }), /empty or interrupted/);
    await assert.rejects(store.submit({ childId: 99, kind: 'quran_memorization', itemRef: '1', title: 'x', tempUri: files.capture() }), /child profile/);
    assert.equal((await store.usage()).count, 0);
    assert.equal([...files.files.keys()].filter(uri => uri.includes('/recordings/')).length, 0);
  } finally { close(); }
});
