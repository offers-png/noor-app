import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { serializeDatabase, type DatabaseDriver } from '../src/services/database/serialized';
import { schema } from '../src/database/migrations/001';
import { FamilyRepository } from '../src/database/repositories/FamilyRepository';
import type { SqlValue } from '../src/services/database/types';

function database() {
  const native = new DatabaseSync(':memory:');
  const driver: DatabaseDriver = {
    execAsync: async sql => { native.exec(sql); },
    runAsync: async (sql, ...params: SqlValue[]) => {
      const result = native.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => (native.prepare(sql).get(...params) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[],
    withTransactionAsync: async work => {
      native.exec('BEGIN');
      try { await work(); native.exec('COMMIT'); }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    },
  };
  return { db: serializeDatabase(driver), native, close: () => native.close() };
}

test('a failed async transaction cannot roll back unrelated queued writes or poison later transactions', async () => {
  const { db, native, close } = database();
  let release!: () => void;
  let signalStarted!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  try {
    await db.execAsync('CREATE TABLE events (name TEXT)');
    const failed = db.withTransactionAsync(async tx => {
      await tx.runAsync('INSERT INTO events VALUES (?)', 'rolled-back');
      signalStarted();
      await blocked;
      throw new Error('fixture failure');
    });
    const rejection = assert.rejects(failed, /fixture failure/);
    await started;
    const outside = db.runAsync('INSERT INTO events VALUES (?)', 'outside');
    const later = db.withTransactionAsync(async tx => {
      await tx.runAsync('INSERT INTO events VALUES (?)', 'later');
    });
    await Promise.resolve();
    assert.deepEqual(native.prepare('SELECT name FROM events').all().map(row => row.name), ['rolled-back']);
    release();
    await rejection;
    await Promise.all([outside, later]);
    assert.deepEqual((await db.getAllAsync<{ name: string }>('SELECT name FROM events ORDER BY rowid')).map(row => row.name), ['outside', 'later']);
  } finally { release(); close(); }
});

test('concurrent child progress transactions retain every attempt and practice event', async () => {
  const { db, close } = database();
  try {
    await db.execAsync(schema);
    const family = new FamilyRepository(db);
    const child = await family.addChild('Yusuf', 'star', 8);
    await Promise.all([
      family.saveProgress(child, 'arabic-alif', 80),
      family.saveProgress(child, 'arabic-alif', 100),
      family.saveProgress(child, 'quran-1', 90),
    ]);
    const progress = await family.progress(child);
    assert.equal(progress.find(row => row.lesson_id === 'arabic-alif')?.attempts, 2);
    assert.equal(progress.find(row => row.lesson_id === 'arabic-alif')?.score, 100);
    assert.equal(progress.find(row => row.lesson_id === 'quran-1')?.attempts, 1);
    assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM learning_activity WHERE child_id=?', child))?.count, 3);
  } finally { close(); }
});
