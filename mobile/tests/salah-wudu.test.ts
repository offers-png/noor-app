import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../src/database/migrations/001';
import { schemaV2 } from '../src/database/migrations/002';
import type { Database, SqlValue } from '../src/services/database/types';
import { PRAYERS, RECITATIONS, rakahDifferences, rakahPlan, WUDU_STEPS, WUDU_TOPICS, SCHOOL_DIFFERENCES } from '../src/content/salah/salahGuide';
import { SEEDED_AYAHS } from '../src/services/quran/FixtureQuranProvider';
import audioManifest from '../src/content/fixtures/quran-audio-manifest.json';
import { allLessons } from '../src/content/lessons/catalog';
import { canParentPublishLesson, isPublishedForFamily, visibleLessons } from '../src/content/lessons/approval';
import { awardForProgress } from '../src/services/rewards/progressAwards';
import { RewardsRepository } from '../src/services/rewards/RewardsRepository';

const prayer = (id: string) => PRAYERS.find(item => item.id === id)!;
const ids = (plan: ReturnType<typeof rakahPlan>[number]) => plan.steps.map(step => step.id.replace(/^r\d-/, ''));

test('the five obligatory prayers have the correct number of rak‘ahs', () => {
  assert.deepEqual(PRAYERS.map(item => [item.id, item.rakahs]), [['fajr', 2], ['dhuhr', 4], ['asr', 4], ['maghrib', 3], ['isha', 4]]);
  for (const item of PRAYERS) assert.equal(rakahPlan(item).length, item.rakahs);
});

test('each rak‘ah has Al-Fatihah, one ruku and two sujud; only rak‘ah 1 opens with takbir', () => {
  for (const item of PRAYERS) for (const rakah of rakahPlan(item)) {
    const steps = ids(rakah);
    assert.equal(steps.filter(id => id === 'fatihah').length, 1);
    assert.equal(steps.filter(id => id === 'ruku').length, 1);
    assert.deepEqual(steps.filter(id => id.startsWith('sujud')), ['sujud1', 'sujud2']);
    assert.equal(steps.includes('takbir'), rakah.number === 1);
    assert.equal(steps.includes('surah'), rakah.number <= 2, 'extra surah only in rak‘ahs 1 and 2');
  }
});

test('tashahhud placement: Fajr ends after 2; Maghrib sits after 2 and ends after 3; four-rak‘ah prayers sit after 2 and end after 4', () => {
  const fajr = rakahPlan(prayer('fajr'));
  assert.ok(!ids(fajr[1]).includes('first-tashahhud')); assert.deepEqual(ids(fajr[1]).slice(-4), ['final-tashahhud', 'salawat', 'dua', 'taslim']);
  const maghrib = rakahPlan(prayer('maghrib'));
  assert.ok(ids(maghrib[1]).includes('first-tashahhud')); assert.ok(!ids(maghrib[1]).includes('taslim'));
  assert.deepEqual(ids(maghrib[2]).slice(-4), ['final-tashahhud', 'salawat', 'dua', 'taslim']);
  for (const id of ['dhuhr', 'asr', 'isha']) {
    const plan = rakahPlan(prayer(id));
    assert.ok(ids(plan[1]).includes('first-tashahhud')); assert.ok(!ids(plan[2]).some(step => step.includes('tashahhud')));
    assert.equal(ids(plan[3]).at(-1), 'taslim');
    assert.equal(plan.flatMap(ids).filter(step => step === 'taslim').length, 1);
  }
  assert.match(rakahDifferences(prayer('isha')).join(' '), /3 and 4: Al-Fatihah only/);
});

test('Qur’an recited in the guide is the bundled verified text with bundled audio; other words carry a reference', () => {
  for (const recitation of Object.values(RECITATIONS)) {
    assert.ok(recitation.reference.trim(), `${recitation.id} has a reference`);
    for (const key of recitation.quranKeys ?? []) { assert.ok(SEEDED_AYAHS.some(ayah => ayah.key === key), `${key} is bundled`); assert.ok(audioManifest.clips.some(clip => clip.key === key) && readFileSync(new URL(`../assets/quran/${key.replace(':', '-')}.mp3`, import.meta.url)).byteLength > 1000, `${key} has bundled audio`); }
  }
  assert.equal(RECITATIONS.fatihah.quranKeys!.length, 7);
  const tashahhud = RECITATIONS.tashahhud as { arabic?: string };
  assert.equal(tashahhud.arabic, undefined, 'no unverified Arabic for non-Qur’anic words');
  assert.ok(SCHOOL_DIFFERENCES.length >= 3);
});

test('wudu: ten steps in the Qur’anic order with counts; topics cover invalidators, mistakes, water and ghusl', () => {
  assert.equal(WUDU_STEPS.length, 10);
  const order = WUDU_STEPS.map(step => step.id);
  assert.ok(order.indexOf('face') < order.indexOf('arms') && order.indexOf('arms') < order.indexOf('head') && order.indexOf('head') < order.indexOf('feet'));
  assert.equal(WUDU_STEPS.find(step => step.id === 'head')!.count, 'Once');
  for (const id of ['hands', 'mouth', 'nose', 'face']) assert.equal(WUDU_STEPS.find(step => step.id === id)!.count, '3 times');
  assert.deepEqual(WUDU_TOPICS.map(topic => topic.title), ['How many times?', 'What breaks wudu', 'Common mistakes', 'Save water', 'What is ghusl?']);
  assert.ok(WUDU_STEPS.every(step => step.reference));
  assert.ok(!WUDU_STEPS.some(step => /dua for|supplication for (each|the) (hand|arm|face|foot)/i.test(step.action)), 'no invented per-limb duas');
});

test('the Salah and Wudu guides stay hidden until a parent publishes the reviewed version', () => {
  const guides = allLessons.filter(lesson => lesson.id.startsWith('guide-'));
  assert.deepEqual(guides.map(lesson => lesson.id), ['guide-salah', 'guide-wudu']);
  for (const guide of guides) { assert.equal(isPublishedForFamily(guide), false); assert.equal(canParentPublishLesson(guide), true); assert.ok(guide.quiz.length >= 3); }
  assert.equal(visibleLessons(guides, false).length, 0);
});

function database() {
  const native = new DatabaseSync(':memory:'); native.exec(schema); native.exec(schemaV2);
  const db: Database = { execAsync: async sql => { native.exec(sql); }, runAsync: async (sql, ...params: SqlValue[]) => { const result = native.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; }, getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).get(...params) as T ?? null, getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[], withTransactionAsync: async work => { native.exec('BEGIN'); try { await work(db); native.exec('COMMIT'); } catch (error) { native.exec('ROLLBACK'); throw error; } } };
  native.exec("INSERT INTO children(nickname,avatar,created_at) VALUES ('Amina','⭐','2026-01-01')");
  return { db, close: () => native.close() };
}
test('progress awards: passed quizzes, Salah lessons and revision earn app-verified points; failed quizzes and self-marking do not', async () => {
  const { db, close } = database();
  try {
    const repo = new RewardsRepository(db, () => new Date('2026-10-08T12:00:00Z'));
    await repo.saveSettings({ timeZone: 'UTC' }, () => true);
    assert.equal(await awardForProgress(db, 1, 'hadith-1', 60, repo), undefined);
    assert.equal(await awardForProgress(db, 1, 'dua-knowledge', undefined, repo), undefined, 'self-marked memorization earns nothing');
    assert.equal((await awardForProgress(db, 1, 'hadith-1', 100, repo))?.status, 'approved');
    assert.equal((await awardForProgress(db, 1, 'salah:fajr', 100, repo))?.status, 'approved');
    assert.equal((await awardForProgress(db, 1, 'salah:isha', 100, repo))?.status, 'duplicate', 'one Salah lesson award per day');
    assert.equal((await awardForProgress(db, 1, 'quran:memorize:1:1-1:7', undefined, repo))?.status, 'approved');
    const summary = await repo.summary(1);
    assert.equal(summary.todayPoints, 10 + 15 + 10);
    assert.deepEqual(summary.entries.map(entry => entry.kind).sort(), ['quiz', 'revision', 'salah_lesson']);
  } finally { close(); }
});

test('Android permissions: camera and microphone are requested only for recording; other sensitive permissions stay blocked', () => {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const blocked: string[] = config.android.blockedPermissions;
  assert.ok(!blocked.includes('android.permission.CAMERA')); assert.ok(!blocked.includes('android.permission.RECORD_AUDIO'));
  for (const permission of ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW']) assert.ok(blocked.includes(permission));
  const camera = config.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-camera');
  assert.ok(camera); assert.equal(camera[1].recordAudioAndroid, true); assert.equal(camera[1].barcodeScannerEnabled, false);
  assert.match(camera[1].cameraPermission, /stay on this device/);
  assert.equal(config.android.allowBackup, false, 'recordings are not copied into cloud backups');
});
