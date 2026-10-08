import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getDb } from '../../services/database/database';
import { checkContentConnection, saveContentConnection } from '../../services/quran/ContentConnection';
import { configuredContentConnection } from '../../services/quran/config';
import { useAppStore } from '../../state/appStore';

export function ContentConnection({networkEnabled,onChanged,disabled=false}:{networkEnabled:boolean;onChanged?:()=>void;disabled?:boolean}) {
  const [url,setUrl]=useState('');const [environment,setEnvironment]=useState<'production'|'prelive'>('production');
  const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const running=useRef(false);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;void configuredContentConnection().then(value=>{if(mounted.current&&value){setUrl(value.url);setEnvironment(value.environment);}}).catch(()=>{if(mounted.current)setStatus('Check or replace your saved content server address.');});return()=>{mounted.current=false;};},[]);
  const parentAllowed=()=>mounted.current&&useAppStore.getState().parentUnlocked;
  const allowed=()=>parentAllowed()&&useAppStore.getState().settings.networkEnabled;
  async function run(check:boolean){
    if(running.current||disabled)return;running.current=true;setBusy(true);setStatus('');
    try{
      if(!parentAllowed())throw new Error('Enter your parent PIN before changing the connection.');
      if(check){const result=await checkContentConnection({url,environment},allowed,fetch,__DEV__);if(mounted.current)setStatus(`Server reachable (${result.environment}). ${result.quranConfigured?'Quran credentials are present; sync still needs to verify authorization.':'Quran audio and tafsir need approved credentials on this server.'} ${result.publisherDownloads.includes('tanzil-transliteration')?'Licensed Tanzil text downloads are supported.':''}`);}
      else{await saveContentConnection(await getDb(),{url,environment},parentAllowed,__DEV__);if(mounted.current){setStatus('Connection saved. Check the server, then choose content to download. No API keys are stored in the app.');onChanged?.();}}
    }catch(error){if(mounted.current)setStatus(error instanceof Error?error.message:'The connection could not be saved.');}
    finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  return <View style={styles.card}><Text style={styles.title}>Content server connection</Text><Text style={styles.body}>Enter your content server’s HTTPS address. API credentials stay on the server. Your five included surahs remain available offline.</Text><TextInput accessibilityLabel="Content server address" autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy&&!disabled} value={url} onChangeText={value=>{setUrl(value);setStatus('');}} placeholder="https://your-server.example/content" style={styles.input}/><View style={styles.row}>{(['production','prelive'] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:environment===value,disabled:busy||disabled}} disabled={busy||disabled} onPress={()=>{setEnvironment(value);setStatus('');}} style={[styles.option,environment===value&&styles.selected]}><Text style={styles.body}>{value==='production'?'Production':'Prelive test'}</Text></Pressable>)}</View><View style={styles.row}><Action label="Save connection" onPress={()=>void run(false)} disabled={busy||disabled||!url.trim()}/><Action label="Check server connection" onPress={()=>void run(true)} disabled={busy||disabled||!url.trim()||!networkEnabled}/></View>{busy&&<ActivityIndicator/>}{!!status&&<Text accessibilityRole="alert" style={styles.body}>{status}</Text>}</View>;
}
function Action({label,onPress,disabled}:{label:string;onPress:()=>void;disabled:boolean}) {return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,disabled&&{opacity:0.45}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;}
const styles=StyleSheet.create({card:{padding:18,borderWidth:1,borderColor:'#D8E1D5',backgroundColor:'white',borderRadius:20,gap:12},title:{fontSize:20,fontWeight:'700',color:'#173E38'},body:{fontSize:15,lineHeight:25,color:'#34534A'},input:{padding:14,minHeight:48,borderWidth:1,borderColor:'#BACFC0',borderRadius:12,backgroundColor:'white',fontSize:17},row:{flexDirection:'row',flexWrap:'wrap',gap:10},option:{padding:14,borderRadius:14,borderWidth:1,borderColor:'#BACFC0'},selected:{backgroundColor:'#EBF3E9',borderColor:'#17645B',borderWidth:2},button:{padding:16,minHeight:50,borderRadius:14,backgroundColor:'#17645B'},buttonText:{fontSize:15,fontWeight:'700',color:'white'}});
