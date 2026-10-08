import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex,utf8ToBytes } from '@noble/hashes/utils.js';
export function derivePin(pin:string,salt:string) { return bytesToHex(pbkdf2(sha256,utf8ToBytes(pin),utf8ToBytes(salt),{c:100000,dkLen:32})); }
