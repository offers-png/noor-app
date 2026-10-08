import { QuranScreen } from '../features/quran/QuranScreen';
import { useAppStore } from '../state/appStore';
import { Body,Screen } from '../components/Common/ui';
export default function Quran(){const {selectedChildId,settings,saveProgress}=useAppStore();if(!selectedChildId||!settings.modules.quran)return <Screen title="Qur’an"><Body>Ask a parent to enable this module and select a profile.</Body></Screen>;return <QuranScreen key={selectedChildId} childId={selectedChildId} networkEnabled={settings.networkEnabled} audioEnabled={settings.audioEnabled} fontSize={settings.fontSize} onComplete={(id,score)=>saveProgress(id,score,selectedChildId)}/>;}
