import { useRouter } from 'expo-router';
import ProgressScreen from '../features/progress/ProgressScreen';
export default function Progress(){const router=useRouter();return <ProgressScreen back={()=>router.back()}/>;}
