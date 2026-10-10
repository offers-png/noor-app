import { useEffect,useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '../state/appStore';
import { parentPin } from '../services/parent/securePin';
import PinGate from '../features/parent/PinGate';
import { Screen,Body,Button } from '../components/Common/ui';
import { refreshQuranIfDue } from '../services/quran/config';
import { kidsLock, shouldHoldScreen } from '../services/parent/kidsLock';
/** Keeps Kids Mode on screen when the parent turned the lock on. */
function holdScreenIfNeeded(){const {settings,selectedChildId,lockSuspended}=useAppStore.getState();if(shouldHoldScreen({enabled:settings.kidsLock,childSelected:!!selectedChildId,suspendedByParent:lockSuspended}))void kidsLock.hold().catch(()=>undefined);}
let refreshing=false;
async function refreshPermittedContent(){if(refreshing)return;refreshing=true;try{await refreshQuranIfDue(useAppStore.getState().settings.networkEnabled,()=>useAppStore.getState().settings.networkEnabled);}finally{refreshing=false;}}
export default function Layout(){
  const {ready,error,initialize,lock,parentUnlocked,settings,selectedChildId,lockSuspended}=useAppStore();const [hasPin,setHasPin]=useState<boolean|null>(null);const [pinError,setPinError]=useState('');
  useEffect(()=>{void initialize();parentPin.configured().then(setHasPin).catch(e=>setPinError(String(e)));const listener=AppState.addEventListener('change',state=>{if(state!=='active')lock();else{holdScreenIfNeeded();void refreshPermittedContent().catch(()=>{});}});return()=>listener.remove();},[initialize,lock]);
  useEffect(()=>{if(!ready||!settings.networkEnabled)return;void refreshPermittedContent().catch(()=>{});const retry=setInterval(()=>{if(AppState.currentState==='active')void refreshPermittedContent().catch(()=>{});},300000);return()=>clearInterval(retry);},[ready,settings.networkEnabled]);
  useEffect(()=>{if(ready)holdScreenIfNeeded();},[ready,settings.kidsLock,selectedChildId,lockSuspended]);
  useEffect(()=>{if(!parentUnlocked)return;const timeout=setTimeout(lock,120000);return()=>clearTimeout(timeout);},[parentUnlocked,lock]);
  if(pinError)return <Screen title="Parent settings unavailable"><Body>{pinError}</Body></Screen>;
  if(error)return <Screen title="Storage needs attention"><Body>{error}</Body><Button label="Try again" onPress={()=>void initialize()}/></Screen>;
  if(!ready||hasPin===null)return <Screen title="Kids Islam"><Body>Opening your learning space…</Body></Screen>;
  if(!hasPin)return <PinGate onCancel={()=>{}} onSuccess={()=>setHasPin(true)}/>;
  return <><StatusBar style="dark"/><Stack screenOptions={{animation:settings.reducedMotion?'none':'default',headerStyle:{backgroundColor:'#f7f3e8'},headerTintColor:'#203d30',contentStyle:{backgroundColor:'#f7f3e8'}}}><Stack.Screen name="index" options={{headerShown:false}}/><Stack.Screen name="parent" options={{title:'Parent mode'}}/><Stack.Screen name="quran" options={{title:'Qur’an'}}/><Stack.Screen name="arabic" options={{title:'Arabic School'}}/><Stack.Screen name="lessons" options={{title:'Learning'}}/><Stack.Screen name="progress" options={{title:'My progress'}}/><Stack.Screen name="sources" options={{title:'Sources'}}/><Stack.Screen name="review" options={{title:'Content review'}}/><Stack.Screen name="downloads" options={{title:'Content downloads'}}/><Stack.Screen name="salah" options={{title:'Salah'}}/><Stack.Screen name="wudu" options={{title:'Wudu'}}/><Stack.Screen name="rewards" options={{title:'My rewards'}}/><Stack.Screen name="record" options={{title:'Record'}}/><Stack.Screen name="review-center" options={{title:'Review center'}}/><Stack.Screen name="library" options={{title:'Hadith & Dua library'}}/><Stack.Screen name="videos" options={{title:'Story videos'}}/><Stack.Screen name="videos-admin" options={{title:'Story videos'}}/></Stack></>;
}
