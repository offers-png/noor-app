import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '../state/appStore';
import PinGate from '../features/parent/PinGate';
import GuideApprove from '../features/salah/GuideApprove';
export default function GuideApproveRoute(){const router=useRouter();const {id}=useLocalSearchParams<{id?:string}>();const {parentUnlocked,lock}=useAppStore();const guide=id==='guide-wudu'?'guide-wudu':'guide-salah';const tile=guide==='guide-wudu'?'/wudu':'/salah';return parentUnlocked?<GuideApprove id={guide} back={()=>router.back()} done={()=>{lock();router.replace(tile);}}/>:<PinGate onSuccess={()=>router.replace({pathname:'/guide-approve',params:{id:guide}})} onCancel={()=>router.back()}/>;}
