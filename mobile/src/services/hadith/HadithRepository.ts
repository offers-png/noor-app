import type { Database } from '../database/database';
import type { HadithRecord } from '../../types/lessons';
import type { HadithProvider } from './HadithProvider';

export class HadithRepository {
  constructor(private readonly db: Database, private readonly provider: HadithProvider) {}
  async get(collection: string, number: string): Promise<HadithRecord> {
    const id = `${collection}:${number}${this.provider.kind === 'development' ? ':excerpt' : ''}`;
    const cached = await this.db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM hadiths WHERE id = ?', id);
    if (cached) {
      const value = JSON.parse(cached.payload_json) as HadithRecord;
      if (value.id !== id || value.developmentOnly !== (this.provider.kind === 'development')) throw new Error('The cached Hadith belongs to a different content pack.');
      return value;
    }
    const value = await this.provider.getHadith(collection, number);
    await this.db.runAsync('INSERT INTO hadiths (id, canonical_text, source_json, payload_json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
      value.id, value.canonicalText, JSON.stringify(value.source), JSON.stringify(value));
    return value;
  }
  async save(childId: number, hadithId: string): Promise<void> {
    if (!Number.isInteger(childId) || childId <= 0) throw new Error('Choose a child profile before saving.');
    await this.db.runAsync("INSERT INTO bookmarks (child_id, kind, item_id, created_at) VALUES (?, 'hadith', ?, ?) ON CONFLICT(child_id,kind,item_id) DO NOTHING", childId, hadithId, new Date().toISOString());
  }
  async unsave(childId: number, hadithId: string): Promise<void> {
    await this.db.runAsync("DELETE FROM bookmarks WHERE child_id = ? AND kind = 'hadith' AND item_id = ?", childId, hadithId);
  }
  async savedIds(childId: number): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ item_id: string }>("SELECT item_id FROM bookmarks WHERE child_id = ? AND kind = 'hadith' ORDER BY created_at DESC", childId);
    return rows.map(row => row.item_id);
  }
}
