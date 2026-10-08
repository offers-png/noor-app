import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Screen, Body, Card } from '../components/Common/ui';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import { lessonSourceRegistry } from '../content/lessons/catalog';
import { sourceReadingSourceRegistry } from '../content/lessons/sourceReadings';
import { QURAN_SOURCE_REGISTRY } from '../content/fixtures/QuranSources';
import { getDb } from '../services/database/database';
import { installedTanzilText, type InstalledTanzilText } from '../services/quran/QuranLicensedText';
import { isEnglishTafsir, tafsirCoverage } from '../services/quran/QuranTafsir';
import type { ResourceSnapshot } from '../types/quran';

const sources = [...QURAN_SOURCE_REGISTRY, ...lessonSourceRegistry, ...sourceReadingSourceRegistry];
const uniqueSources = sources.filter((source, index) => sources.findIndex(item => item.sourceName === source.sourceName && item.sourceReference === source.sourceReference) === index);
interface InstalledSources { texts: InstalledTanzilText[]; tafsirs: { environment: string; resource: ResourceSnapshot }[]; error: string; loading: boolean }

export default function Sources() {
  const router = useRouter();
  const { parentUnlocked } = useAppStore();
  const [installed, setInstalled] = useState<InstalledSources>({ texts: [], tafsirs: [], error: '', loading: true });
  useEffect(() => {
    if (!parentUnlocked) return;
    let current = true;
    void (async () => {
      const db = await getDb();
      const texts = [await installedTanzilText(db, 'arabic'), await installedTanzilText(db, 'transliteration')].filter((text): text is InstalledTanzilText => !!text);
      const rows = await db.getAllAsync<{ resource: string; payload_json: string }>('SELECT resource,payload_json FROM quran_resources WHERE resource LIKE ?', 'qf:%:tafsirs');
      const tafsirs = rows.map(row => ({ environment: row.resource.split(':')[1], resource: JSON.parse(row.payload_json) as ResourceSnapshot }));
      if (current) setInstalled({ texts, tafsirs, error: '', loading: false });
    })().catch(error => { if (current) setInstalled({ texts: [], tafsirs: [], error: error instanceof Error ? error.message : 'Installed source information could not be read.', loading: false }); });
    return () => { current = false; };
  }, [parentUnlocked]);
  if (!parentUnlocked) return <PinGate onSuccess={() => router.replace('/sources')} onCancel={() => router.replace('/')} />;
  return <Screen title="About our sources" back={() => router.back()}>
    {uniqueSources.map(source => <Card key={`${source.sourceName}:${source.sourceReference}`}>
      <Body>{source.sourceName} · {source.sourceReference}</Body>
      <Body>{source.sourceUrl}</Body>
      <Body>{source.license}</Body>
    </Card>)}
    {installed.loading && <Body>Reading installed publisher editions…</Body>}
    {!!installed.error && <Body>{installed.error}</Body>}
    {installed.texts.map(text => <Card key={text.kind}>
      <Body>Installed full {text.kind === 'arabic' ? 'Arabic' : 'whole-ayah transliteration'} edition · {text.source.name}</Body>
      <Body>Edition: {text.source.version} · {text.chapterCount} surahs · {text.verseCount.toLocaleString()} ayahs</Body>
      <Body>{text.source.translator ? `Publisher credit: ${text.source.translator}` : text.source.reference}</Body>
      <Body>{text.source.license}</Body>
      <Body>Publisher terms: {text.licenseUrl}</Body>
      <Body>Installed: {text.installedAt} · Original file: {text.bytes.toLocaleString()} bytes</Body>
      <Body>SHA256: {text.sha256}</Body>
      <Body>Original publisher notice, retained with the unchanged edition:</Body>
      <Body>{text.notice}</Body>
    </Card>)}
    {installed.tafsirs.map(({ environment, resource }) => {
      const source = resource.attribution;
      const coverage = tafsirCoverage(resource);
      return <Card key={`${environment}:${resource.resource_id}`}>
        <Body>Installed tafsir · {source?.name ?? `Quran Foundation resource ${resource.resource_id}`}</Body>
        <Body>Publisher author: {source?.author ?? source?.translator ?? 'Not supplied by this saved source'}</Body>
        <Body>Language: {source?.language ?? 'Not supplied by this saved source'} · Environment: {environment}</Body>
        <Body>Resource ID: {resource.resource_id} · Content Sync schema {resource.schema_version}, sequence {resource.sync_sequence}</Body>
        <Body>Published coverage: {coverage.verseCount.toLocaleString()} of {coverage.totalVerseCount.toLocaleString()} ayahs in {coverage.passageCount.toLocaleString()} passages{coverage.complete ? ' (complete)' : ' (partial)'}</Body>
        <Body>{source?.license ?? 'Quran Foundation Developer Terms; permitted local copies maintained through Content Sync.'}</Body>
        <Body>{source?.url ?? 'https://quran.com/'}</Body>
        <Body>{isEnglishTafsir(resource) ? 'Publisher commentary is shown verbatim as a separate tafsir layer. Read dense English together with your child; ask a qualified teacher about religious questions.' : 'This saved resource has no verified English publisher metadata and is withheld from the English tafsir reader. Refresh its metadata in Parent Downloads.'}</Body>
      </Card>;
    })}
    <Body>Original educational explanations stay in review mode until a qualified reviewer approves and a parent publishes the exact version. Published translations and their notes are distinct from tafsir. The app supports instruction and practice; ask a qualified teacher about religious questions.</Body>
  </Screen>;
}
