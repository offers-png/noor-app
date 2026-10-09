import { useRouter } from 'expo-router';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import LibraryImport from '../features/parent/LibraryImport';
export default function LibraryRoute(){const router=useRouter();const {parentUnlocked}=useAppStore();return parentUnlocked?<LibraryImport back={()=>router.back()}/>:<PinGate onSuccess={()=>router.replace('/library')} onCancel={()=>router.replace('/')}/>;}
