import type { Database } from '../database/types';
import type { ResourceGroup, ResourceSnapshot } from '../../types/quran';
import { QuranProviderError } from './QuranProvider';

export const QURAN_ACTIVE_GROUPS = ['translations','recitations','word_by_word_translations','word_by_word_transliterations','tafsirs'] as const;
export type ActiveQuranGroup = typeof QURAN_ACTIVE_GROUPS[number];
export type QuranResourcePreferences = Partial<Record<ActiveQuranGroup, number>>;
const preferenceKey = (environment: string) => `quran:active-resources:${environment}`;

export async function readQuranResourcePreferences(db: Database, environment: string): Promise<QuranResourcePreferences> {
  const stored = await db.getFirstAsync<{value_json:string}>('SELECT value_json FROM app_settings WHERE key=?', preferenceKey(environment));
  if (!stored) return {};
  const data = JSON.parse(stored.value_json) as QuranResourcePreferences;
  return Object.fromEntries(QURAN_ACTIVE_GROUPS.filter(group => Number.isSafeInteger(data[group]) && Number(data[group]) > 0).map(group => [group, data[group]]));
}

export function selectActiveQuranResource(resources: ResourceSnapshot[], group: ResourceGroup, preferences: QuranResourcePreferences): ResourceSnapshot | undefined {
  const selected = preferences[group as ActiveQuranGroup];
  return resources.find(resource => resource.resource_group === group && (selected === undefined || resource.resource_id === selected));
}

/** Called only by the parent download flow after a successful, consented sync/download. */
export async function saveQuranResourcePreferences(db: Database, environment: string, selection: QuranResourcePreferences, networkAllowed: () => boolean): Promise<void> {
  if (!networkAllowed()) throw new QuranProviderError('Parent-enabled network access is required to select downloaded content.');
  const previous = await readQuranResourcePreferences(db, environment);
  for (const [group, id] of Object.entries(selection)) {
    if (!QURAN_ACTIVE_GROUPS.includes(group as ActiveQuranGroup) || !Number.isSafeInteger(id) || id < 1) throw new QuranProviderError('Invalid active Quran resource selection.');
    const resource = await db.getFirstAsync('SELECT resource_id FROM quran_resources WHERE resource=? AND resource_id=?', `qf:${environment}:${group}`, String(id));
    if (!resource) throw new QuranProviderError(`The selected ${group} resource is not downloaded or publicly available.`);
  }
  if (!networkAllowed()) throw new QuranProviderError('Network permission changed; the previous content selection was kept.');
  await db.runAsync('INSERT OR REPLACE INTO app_settings(key,value_json) VALUES (?,?)', preferenceKey(environment), JSON.stringify({...previous, ...selection}));
}
