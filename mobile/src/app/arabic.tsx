import { ArabicScreen } from '../features/arabic/ArabicScreen';
import { useAppStore } from '../state/appStore';
import { Body,Screen } from '../components/Common/ui';
import { useRouter } from 'expo-router';
export default function Arabic(){const router=useRouter();const {selectedChildId,settings,saveProgress}=useAppStore();if(!selectedChildId||!settings.modules.arabic)return <Screen title="Arabic"><Body>Ask a parent to enable Arabic and choose a profile.</Body></Screen>;return <ArabicScreen key={selectedChildId} onComplete={(id,score)=>saveProgress(id,score,selectedChildId)} fontSize={settings.fontSize} narrationEnabled={settings.audioEnabled} onOpenQuran={()=>router.push('/quran')}/>;}
