import { sourceReadingCatalog } from '../../content/lessons/sourceReadings';
import { visibleLessons } from '../../content/lessons/approval';
import { loadStoredLessons, seedReviewLessons } from '../../content/lessons/storage';
import type { Database } from '../../services/database/types';
import type { SourceReadingRecord } from '../../types/lessons';

export async function hasAvailableEditorialLessons(db: Database, category: 'hadith' | 'duas', developmentContent: boolean, childAge?: number | null): Promise<boolean> {
  if (developmentContent) await seedReviewLessons(db);
  return visibleLessons(await loadStoredLessons(db), developmentContent, childAge).some(lesson => lesson.category === category);
}

/** Local activity only. This repository never edits or approves religious source text. */
export class SourceReadingRepository {
  constructor(private readonly db: Database) {}

  private reading(childId: number, id: string): SourceReadingRecord {
    if (!Number.isInteger(childId) || childId <= 0) throw new Error('Choose a child profile before saving.');
    const record = sourceReadingCatalog.find(item => item.id === id);
    if (!record) throw new Error('This reading is not in the published source catalog.');
    return record;
  }

  async savedIds(childId: number, category: 'hadith' | 'duas'): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ item_id: string }>(
      'SELECT item_id FROM bookmarks WHERE child_id=? AND kind=? ORDER BY created_at DESC', childId, category === 'duas' ? 'dua' : 'hadith');
    return rows.map(row => row.item_id).filter(id => sourceReadingCatalog.some(record => record.category === category && record.id === id));
  }

  async setSaved(childId: number, id: string, saved: boolean): Promise<void> {
    const record = this.reading(childId, id);
    const kind = record.category === 'duas' ? 'dua' : 'hadith';
    if (saved) await this.db.runAsync('INSERT INTO bookmarks(child_id,kind,item_id,created_at) VALUES(?,?,?,?) ON CONFLICT(child_id,kind,item_id) DO NOTHING', childId, kind, id, new Date().toISOString());
    else await this.db.runAsync('DELETE FROM bookmarks WHERE child_id=? AND kind=? AND item_id=?', childId, kind, id);
  }

  async markMemorized(childId: number, id: string): Promise<void> {
    const record = this.reading(childId, id);
    if (record.category !== 'duas') throw new Error('Choose a dua for memory practice.');
    await this.db.runAsync('INSERT INTO memorization_progress(child_id,verse_key,level,rating,last_practiced) VALUES(?,?,?,?,?) ON CONFLICT(child_id,verse_key) DO UPDATE SET level=excluded.level,rating=excluded.rating,last_practiced=excluded.last_practiced',
      childId, record.id, 'COMPLETE', 'self-marked', new Date().toISOString());
  }
}
