import { useRouter } from 'expo-router';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import VideosAdmin from '../features/videos/VideosAdmin';
export default function VideosAdminRoute(){const router=useRouter();const {parentUnlocked}=useAppStore();return parentUnlocked?<VideosAdmin back={()=>router.back()}/>:<PinGate onSuccess={()=>router.replace('/videos-admin')} onCancel={()=>router.replace('/')}/>;}
