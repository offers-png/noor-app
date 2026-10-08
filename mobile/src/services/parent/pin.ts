export interface PinStore { get(key: string): Promise<string|null>; set(key: string,value: string): Promise<void> }
export interface PinCrypto { random(): Promise<string>; derive(pin: string,salt: string): Promise<string> }
export function validPin(pin: string) { return /^\d{6}$/.test(pin); }
export class ParentPin {
  constructor(private store: PinStore, private crypto: PinCrypto, private now=()=>Date.now()) {}
  async configured() { return Boolean(await this.store.get('parent-pin')); }
  async set(pin: string) {
    if (!validPin(pin)) throw new Error('Choose a six-digit PIN.');
    const salt = await this.crypto.random();
    await this.store.set('parent-pin',JSON.stringify({salt,hash:await this.crypto.derive(pin,salt)}));
    await this.store.set('pin-lock',JSON.stringify({fails:0,until:0}));
  }
  async verify(pin: string) {
    const lock = JSON.parse(await this.store.get('pin-lock') || '{"fails":0,"until":0}') as {fails:number;until:number};
    if (lock.until > this.now()) throw new Error('Too many attempts. Please wait a minute.');
    const raw = await this.store.get('parent-pin');
    if (!raw) return false;
    const value = JSON.parse(raw) as {salt:string;hash:string};
    const hash = await this.crypto.derive(pin,value.salt);
    let diff = hash.length ^ value.hash.length;
    for (let i=0;i<Math.max(hash.length,value.hash.length);i++) diff |= (hash.charCodeAt(i)||0) ^ (value.hash.charCodeAt(i)||0);
    const ok = validPin(pin) && diff===0;
    const fails = ok ? 0 : lock.fails + 1;
    await this.store.set('pin-lock',JSON.stringify({fails,until:fails >= 5 ? this.now()+60000 : 0}));
    return ok;
  }
}
