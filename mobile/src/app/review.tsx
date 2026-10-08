import { useRouter } from 'expo-router';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import { ContentReviewScreen } from '../features/parent/ContentReviewScreen';
export default function Review(){const router=useRouter();const {parentUnlocked}=useAppStore();return parentUnlocked?<ContentReviewScreen onBack={()=>router.back()}/>:<PinGate onSuccess={()=>router.replace('/review')} onCancel={()=>router.replace('/')}/>;}
