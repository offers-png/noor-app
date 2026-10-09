import type { Database } from '../database/types';
import type { HadithRecord } from '../../types/lessons';
import type { QuizQuestion } from '../../types/quiz';

/**
 * Parent-added Hadith and Dua readings. The text is always the unchanged Sunnah.com source record
 * fetched through the content server; a parent reads it, picks a category and confirms before it
 * appears for children. Nothing here is written by the app.
 */
export const HADITH_CATEGORIES = ['Parents', 'Respect for mothers', 'Kindness', 'Honesty', 'Prayer', 'Cleanliness', 'Generosity', 'Patience', 'Good manners'] as const;
export const DUA_CATEGORIES = ['Eating', 'Sleeping and waking', 'Bathroom', 'Home', 'Wudu', 'Travel', 'Forgiveness', 'Parents', 'Protection', 'Knowledge', 'Morning and evening', 'Other daily duas'] as const;
export type ImportKind = 'hadith' | 'dua';

/** Collections the parent can look up. Availability depends on the server's Sunnah.com access. */
export const COLLECTIONS: readonly { id: string; title: string }[] = Object.freeze([
  { id: 'bukhari', title: 'Sahih al-Bukhari' }, { id: 'muslim', title: 'Sahih Muslim' }, { id: 'riyadussalihin', title: 'Riyad as-Salihin' },
  { id: 'abudawud', title: 'Sunan Abi Dawud' }, { id: 'tirmidhi', title: 'Jami` at-Tirmidhi' }, { id: 'nasai', title: 'Sunan an-Nasa\'i' },
  { id: 'ibnmajah', title: 'Sunan Ibn Majah' }, { id: 'adab', title: 'Al-Adab Al-Mufrad' }, { id: 'nawawi40', title: '40 Hadith Nawawi' },
]);
/**
 * Starting points for a parent's search. These are lookup references only: the app shows the source
 * text Sunnah.com returns and the parent confirms it matches the topic before adding it.
 */
export const SUGGESTED_HADITH: readonly { category: typeof HADITH_CATEGORIES[number]; collection: string; number: string }[] = Object.freeze([
  { category: 'Respect for mothers', collection: 'bukhari', number: '5971' },
  { category: 'Honesty', collection: 'bukhari', number: '6094' },
  { category: 'Prayer', collection: 'bukhari', number: '528' },
  { category: 'Cleanliness', collection: 'muslim', number: '223' },
  { category: 'Generosity', collection: 'muslim', number: '2588' },
  { category: 'Patience', collection: 'bukhari', number: '6114' },
  { category: 'Good manners', collection: 'bukhari', number: '6035' },
  { category: 'Kindness', collection: 'bukhari', number: '6013' },
]);

export interface ImportedReading { id: string; kind: ImportKind; category: string; record: HadithRecord; addedAt: string; attestation: { parentReadSource: true; recordedAt: string } }
function guard(parentAllowed: () => boolean) { if (!parentAllowed()) throw new Error('Enter your parent PIN to continue.'); }
export function collectionTitle(id: string): string { return COLLECTIONS.find(item => item.id === id)?.title ?? id; }

export class ImportedLibrary {
  constructor(private readonly db: Database, private readonly now: () => Date = () => new Date()) {}
  async add(record: HadithRecord, kind: ImportKind, category: string, confirmation: { parentReadSource: boolean }, parentAllowed: () => boolean): Promise<ImportedReading> {
    guard(parentAllowed);
    const categories: readonly string[] = kind === 'hadith' ? HADITH_CATEGORIES : DUA_CATEGORIES;
    if (!categories.includes(category)) throw new Error('Choose a category.');
    if (confirmation.parentReadSource !== true) throw new Error('Confirm that you read the source text and it suits your child.');
    if (record.developmentOnly || record.textScope !== 'complete-source-record' || !record.canonicalText.trim() || !record.translation.trim() || !/^[a-z0-9_-]+:[0-9]+[a-z]?$/.test(record.id)) throw new Error('Only complete records fetched from Sunnah.com can be added.');
    const recordedAt = this.now().toISOString();
    const reading: ImportedReading = { id: `${kind}:${record.id}`, kind, category, record, addedAt: recordedAt, attestation: { parentReadSource: true, recordedAt } };
    await this.db.runAsync('INSERT OR REPLACE INTO imported_sources(id,kind,category,payload_json,added_at) VALUES (?,?,?,?,?)', reading.id, kind, category, JSON.stringify(reading), recordedAt);
    return reading;
  }
  async list(kind: ImportKind): Promise<ImportedReading[]> {
    const rows = await this.db.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM imported_sources WHERE kind=? ORDER BY category, added_at', kind);
    return rows.map(row => JSON.parse(row.payload_json) as ImportedReading).filter(item => item.attestation?.parentReadSource === true && item.record?.textScope === 'complete-source-record');
  }
  async remove(id: string, parentAllowed: () => boolean): Promise<void> {
    guard(parentAllowed);
    await this.db.runAsync('DELETE FROM imported_sources WHERE id=?', id);
  }
}

/** Questions built only from the source record's own metadata, so nothing religious is invented. */
export function sourceQuiz(reading: ImportedReading, others: ImportedReading[]): QuizQuestion[] {
  const title = collectionTitle(reading.record.collection);
  const distractors = [...new Set(COLLECTIONS.map(item => item.title).filter(item => item !== title))].slice(0, 2);
  const questions: QuizQuestion[] = [{ id: `${reading.id}:collection`, type: 'multiple-choice', prompt: `Which collection is this ${reading.kind === 'dua' ? 'dua' : 'hadith'} from?`,
    options: [{ id: '0', label: distractors[0] }, { id: '1', label: title }, { id: '2', label: distractors[1] }], correctOptionId: '1', explanation: `It is from ${title}, number ${reading.record.hadithNumber}.` }];
  const category = others.find(item => item.category !== reading.category)?.category;
  if (category) questions.push({ id: `${reading.id}:category`, type: 'multiple-choice', prompt: 'Which topic is this about?',
    options: [{ id: '0', label: category }, { id: '1', label: reading.category }], correctOptionId: '1', explanation: `Your parent added it under ${reading.category}.` });
  return questions;
}
