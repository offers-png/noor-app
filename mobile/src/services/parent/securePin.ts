import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import { derivePin } from './pinCrypto';
import { ParentPin } from './pin';
export const parentPin = new ParentPin({get:SecureStore.getItemAsync,set:SecureStore.setItemAsync},{
  random:async()=>bytesToHex(await Crypto.getRandomBytesAsync(16)),
  derive:async(pin,salt)=>derivePin(pin,salt),
});
