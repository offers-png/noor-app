import { useRouter } from 'expo-router';
import { Screen,Body,Card } from '../components/Common/ui';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import { lessonSourceRegistry } from '../content/lessons/catalog';
import { sourceReadingSourceRegistry } from '../content/lessons/sourceReadings';
import { QURAN_SOURCE_REGISTRY } from '../content/fixtures/QuranSources';
const sources = [...QURAN_SOURCE_REGISTRY, ...lessonSourceRegistry, ...sourceReadingSourceRegistry];
const uniqueSources = sources.filter((source, index) => sources.findIndex(item => item.sourceName === source.sourceName && item.sourceReference === source.sourceReference) === index);
export default function Sources(){const router=useRouter();const {parentUnlocked}=useAppStore();if(!parentUnlocked)return <PinGate onSuccess={()=>router.replace('/sources')} onCancel={()=>router.replace('/')}/>;return <Screen title="About our sources">{uniqueSources.map(source=><Card key={`${source.sourceName}:${source.sourceReference}`}><Body>{source.sourceName} · {source.sourceReference}</Body><Body>{source.sourceUrl}</Body><Body>{source.license}</Body></Card>)}<Body>Original educational explanations stay in review mode until a qualified reviewer approves and publishes them. The app supports instruction and practice; ask a qualified teacher about religious questions.</Body></Screen>;}
