import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Screen, Button, Field, Body } from '../../components/Common/ui';
import { parentPin } from '../../services/parent/securePin';
import { useAppStore } from '../../state/appStore';
export default function PinGate({onSuccess,onCancel}:{onSuccess:()=>void;onCancel:()=>void}) {
  const [configured,setConfigured]=useState<boolean|null>(null),[pin,setPin]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const generation=useRef(0),mounted=useRef(true),submitting=useRef(false);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  useEffect(()=>{
    mounted.current=true;
    parentPin.configured().then(value=>{if(mounted.current)setConfigured(value);}).catch(e=>{if(mounted.current)setError(String(e));});
    const listener=AppState.addEventListener('change',state=>{if(state!=='active')invalidate();});
    return()=>{mounted.current=false;invalidate();listener.remove();};
  },[invalidate]);
  const submit=async()=>{
    if(submitting.current||configured===null)return;
    submitting.current=true;
    const attempt=generation.current;
    setBusy(true);setError('');
    try{
      if(!configured){
        if(pin!==confirm)throw new Error('PINs must match.');
        await parentPin.set(pin);
        if(mounted.current)setConfigured(true);
      }else if(!await parentPin.verify(pin)){throw new Error('Incorrect PIN. Please try again.');}
      if(!mounted.current)return;
      if(generation.current!==attempt||AppState.currentState!=='active')throw new Error('Please enter your PIN again after returning to the app.');
      useAppStore.getState().unlock();onSuccess();
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Unable to unlock');}
    finally{submitting.current=false;if(mounted.current)setBusy(false);}
  };
  const cancel=()=>{invalidate();onCancel();};
  return <Screen title={configured?'Parent mode':'Welcome, parent'} back={cancel}><Body>{configured?'Enter your PIN to manage learning.':'Create a six-digit parent PIN. Keep it somewhere safe; local device storage is not an account recovery service.'}</Body><Field label="Parent PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6}/>{configured===false&&<Field label="Confirm PIN" value={confirm} onChangeText={setConfirm} keyboardType="number-pad" secureTextEntry maxLength={6}/>}<Body>{error}</Body><Button label={busy?'Please wait…':configured?'Unlock':'Create PIN'} disabled={busy||configured===null||pin.length!==6} onPress={()=>void submit()}/></Screen>;
}
