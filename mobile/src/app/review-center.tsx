import { useRouter } from 'expo-router';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import ReviewCenter from '../features/parent/ReviewCenter';
export default function ReviewCenterRoute(){const router=useRouter();const {parentUnlocked}=useAppStore();return parentUnlocked?<ReviewCenter back={()=>router.back()}/>:<PinGate onSuccess={()=>router.replace('/review-center')} onCancel={()=>router.replace('/')}/>;}
