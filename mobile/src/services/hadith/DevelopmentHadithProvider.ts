import { hadithFixtures } from '../../content/fixtures/hadith';
import { HadithProviderError, type HadithProvider } from './HadithProvider';

export class DevelopmentHadithProvider implements HadithProvider {
  readonly kind = 'development' as const;
  async getCollections() {
    return [{ id: 'bukhari', title: 'Sahih al-Bukhari • 3 review excerpts', arabicTitle: 'صحيح البخاري', available: hadithFixtures.length }];
  }
  async getHadith(collection: string, number: string) {
    const record = hadithFixtures.find(h => h.collection === collection && h.hadithNumber === number);
    if (!record) throw new HadithProviderError('This reference is not in the development teaching pack.', 'not_found', 404);
    return record;
  }
}
