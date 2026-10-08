import { useRouter } from 'expo-router';
import { QuranDownloads } from '../features/quran/QuranDownloads';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
export default function Downloads(){const router=useRouter();const {parentUnlocked,settings}=useAppStore();return parentUnlocked?<QuranDownloads networkEnabled={settings.networkEnabled}/>:<PinGate onSuccess={()=>router.replace('/downloads')} onCancel={()=>router.replace('/')}/>;}
