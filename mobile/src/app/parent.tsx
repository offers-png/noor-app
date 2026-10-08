import { useRouter } from 'expo-router';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import ParentDashboard from '../features/parent/ParentDashboard';
export default function Parent(){const router=useRouter();const {parentUnlocked}=useAppStore();return parentUnlocked?<ParentDashboard kids={()=>router.replace('/')} downloads={()=>router.push('/downloads')} sources={()=>router.push('/sources')} progress={()=>router.push('/progress')} review={()=>router.push('/review')}/>:<PinGate onSuccess={()=>router.replace('/parent')} onCancel={()=>router.replace('/')}/>;}
