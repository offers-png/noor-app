import type { HadithRecord } from '../../types/lessons';
import { sunnahSource } from '../../content/lessons/sources';
import { HadithProviderError, type HadithProvider, type HadithCollection } from './HadithProvider';

type Fetcher = typeof fetch;
type SourceLanguage = { lang: string; body: string; grades?: { grade: string; graded_by: string }[] };
/** Only a parent-authorized backend is called; API keys never belong in this adapter. */
export class SunnahProvider implements HadithProvider {
  readonly kind = 'sunnah' as const;
  constructor(private readonly baseUrl: string, private readonly options: { networkAllowed: boolean; fetcher?: Fetcher; timeoutMs?: number }) {}
  private async request(path: string): Promise<unknown> {
    if (!this.options.networkAllowed) throw new HadithProviderError('A parent must enable optional network content.', 'network_disabled');
    let url: URL;
    try { url = new URL(this.baseUrl); } catch { throw new HadithProviderError('Set the parent-configured content proxy URL.', 'configuration'); }
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)
      || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname))) {
      throw new HadithProviderError('Use HTTPS for production or localhost / Android emulator HTTP for development.', 'configuration');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15000);
    try {
      const response = await (this.options.fetcher ?? fetch)(`${this.baseUrl.replace(/\/$/, '')}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new HadithProviderError(response.status === 404 ? 'This hadith is unavailable from the source.' : 'The Hadith service is unavailable. Please try again.', response.status === 404 ? 'not_found' : 'http', response.status);
      try { return await response.json(); } catch { throw new HadithProviderError('The Hadith service returned unreadable data.', 'invalid_response'); }
    } catch (error) {
      if (error instanceof HadithProviderError) throw error;
      throw new HadithProviderError('Could not reach the Hadith service. Saved lessons remain available.', 'network');
    } finally { clearTimeout(timeout); }
  }
  async getCollections(): Promise<HadithCollection[]> {
    const result = await this.request('/api/hadith/collections') as { data?: unknown[] };
    if (!Array.isArray(result?.data)) throw new HadithProviderError('Collection data is invalid.', 'invalid_response');
    return result.data.map(item => {
      const record = item as { name?: string; collection?: { lang: string; title: string }[]; totalAvailableHadith?: number };
      if (typeof record?.name !== 'string' || !record.name || !Array.isArray(record.collection)
        || record.collection.some(v => !v || typeof v.lang !== 'string' || typeof v.title !== 'string')) throw new HadithProviderError('Collection data is invalid.', 'invalid_response');
      return { id: record.name, title: record.collection.find(v => v.lang === 'en')?.title ?? record.name,
        arabicTitle: record.collection.find(v => v.lang === 'ar')?.title ?? '', available: record.totalAvailableHadith ?? 0 };
    });
  }
  async getHadith(collection: string, number: string): Promise<HadithRecord> {
    if (!/^[a-z][a-z0-9_-]*$/.test(collection) || !/^[0-9]+[a-z]?$/.test(number)) throw new HadithProviderError('Invalid hadith reference.', 'configuration');
    const data = await this.request(`/api/hadith/${encodeURIComponent(collection)}/${encodeURIComponent(number)}`) as { collection?: string; hadithNumber?: string | number; hadith?: SourceLanguage[] };
    if (data?.collection !== collection || String(data.hadithNumber) !== number || !Array.isArray(data.hadith)
      || data.hadith.some(v => !v || typeof v.lang !== 'string' || typeof v.body !== 'string')) throw new HadithProviderError('Hadith reference does not match the source response.', 'invalid_response');
    const ar = data.hadith.find(v => v.lang === 'ar'); const en = data.hadith.find(v => v.lang === 'en');
    if (typeof ar?.body !== 'string' || !ar.body || typeof en?.body !== 'string' || !en.body) throw new HadithProviderError('Source Arabic or translation is missing.', 'invalid_response');
    if (en.grades !== undefined && (!Array.isArray(en.grades) || en.grades.some(g => !g || typeof g.grade !== 'string' || typeof g.graded_by !== 'string'))) throw new HadithProviderError('Source grade metadata is invalid.', 'invalid_response');
    // Preserve source bodies exactly, including whitespace, harakat, and source HTML.
    return Object.freeze({ id: `${collection}:${number}`, collection, hadithNumber: number,
      canonicalText: ar.body, translation: en.body, narrator: null,
      grades: (en.grades ?? []).map(g => ({ grade: g.grade, gradedBy: g.graded_by })),
      source: { ...sunnahSource(`${collection} ${number}`, `${collection}:${number}`), contentVersion: `api-v1-snapshot:${new Date().toISOString()}`, verifiedAt: '' },
      textScope: 'complete-source-record', sourceFormat: /<[^>]+>/.test(ar.body + en.body) ? 'source-html' : 'plain-text', developmentOnly: false });
  }
}
