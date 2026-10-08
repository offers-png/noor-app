import type { Database } from '../../services/database/types';
export interface ChildProfile { id: number; nickname: string; age: number | null; avatar: string; created_at: string }
export interface Progress { child_id: number; lesson_id: string; status: string; score: number | null; attempts: number; last_practiced: string; completed_at: string | null; memorization_level: string | null }
export class FamilyRepository {
  constructor(private db: Database) {}
  children() { return this.db.getAllAsync<ChildProfile>('SELECT * FROM children ORDER BY id'); }
  async addChild(nickname: string, avatar: string, age?: number) {
    if (!nickname.trim() || nickname.trim().length > 32) throw new Error('Use a nickname with 1–32 characters.');
    if (age !== undefined && (!Number.isInteger(age) || age < 1 || age > 18)) throw new Error('Age must be between 1 and 18.');
    const result = await this.db.runAsync('INSERT INTO children (nickname,avatar,age,created_at) VALUES (?,?,?,?)', nickname.trim(),avatar,age ?? null,new Date().toISOString());
    return result.lastInsertRowId;
  }
  progress(childId: number) { return this.db.getAllAsync<Progress>('SELECT * FROM lesson_progress WHERE child_id = ? ORDER BY last_practiced DESC', childId); }
  async saveProgress(childId: number, lessonId: string, score?: number, level?: string) {
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error('Invalid score');
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async tx =>{
      await tx.runAsync(`INSERT INTO lesson_progress (child_id,lesson_id,status,score,attempts,last_practiced,completed_at,memorization_level) VALUES (?,?,'completed',?,1,?,?,?) ON CONFLICT(child_id,lesson_id) DO UPDATE SET status='completed',score=excluded.score,attempts=attempts+1,last_practiced=excluded.last_practiced,completed_at=excluded.completed_at,memorization_level=COALESCE(excluded.memorization_level,memorization_level)`,childId,lessonId,score ?? null,now,now,level ?? null);
      await tx.runAsync('INSERT INTO learning_activity(child_id,lesson_id,practiced_at) VALUES(?,?,?)',childId,lessonId,now);
    });
  }
  async saveMemorization(childId: number, verseKey: string, level: string, rating: string | null) {
    await this.db.runAsync(`INSERT INTO memorization_progress VALUES (?,?,?,?,?) ON CONFLICT(child_id,verse_key) DO UPDATE SET level=excluded.level,rating=excluded.rating,last_practiced=excluded.last_practiced`,childId,verseKey,level,rating,new Date().toISOString());
  }
  async bookmark(childId: number, kind: string, id: string, enabled: boolean) {
    if (enabled) await this.db.runAsync('INSERT OR IGNORE INTO bookmarks VALUES (?,?,?,?)',childId,kind,id,new Date().toISOString());
    else await this.db.runAsync('DELETE FROM bookmarks WHERE child_id=? AND kind=? AND item_id=?',childId,kind,id);
  }
  async setting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.getFirstAsync<{value_json:string}>('SELECT value_json FROM app_settings WHERE key=?',key);
    return row ? JSON.parse(row.value_json) as T : fallback;
  }
  setSetting(key: string, value: unknown) { return this.db.runAsync('INSERT OR REPLACE INTO app_settings VALUES (?,?)',key,JSON.stringify(value)); }
  async resetProgress(childId: number) {
    await this.db.withTransactionAsync(async tx => {
      await tx.runAsync('DELETE FROM lesson_progress WHERE child_id=?',childId);
      await tx.runAsync('DELETE FROM quiz_attempts WHERE child_id=?',childId);
      await tx.runAsync('DELETE FROM memorization_progress WHERE child_id=?',childId);
      await tx.runAsync('DELETE FROM learning_activity WHERE child_id=?',childId);
    });
  }
  deleteChild(childId: number) { return this.db.runAsync('DELETE FROM children WHERE id=?',childId); }
}
