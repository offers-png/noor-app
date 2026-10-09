import { Redirect,useFocusEffect,useRouter } from 'expo-router';
import { useCallback } from 'react';
import HomeScreen from '../features/home/HomeScreen';
import { useAppStore,type ModuleName } from '../state/appStore';
import { Screen,Body,Button } from '../components/Common/ui';
export default function Home(){const router=useRouter();const {selectedChildId,lock,parentUnlocked}=useAppStore();useFocusEffect(useCallback(()=>{if(selectedChildId)lock();},[lock,selectedChildId]));const open=(module:ModuleName|'progress'|'rewards')=>{if(module==='hadith'||module==='duas'||module==='islam')router.push({pathname:'/lessons',params:{category:module}});else router.push(`/${module}`);};if(!selectedChildId&&parentUnlocked)return <Redirect href="/parent"/>;return selectedChildId?<HomeScreen open={open} parent={()=>router.push('/parent')}/>:<Screen title="Welcome to Kids Islam"><Body>Add a nickname in Parent Mode to begin.</Body><Button label="Parent mode" onPress={()=>{lock();router.push('/parent');}}/></Screen>;}
