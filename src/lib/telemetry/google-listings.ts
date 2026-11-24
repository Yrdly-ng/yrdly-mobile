import * as SecureStore from 'expo-secure-store';
import { googleMeasurement } from './google-measurement';
import { approvedListing, UUID } from './google-measurement-policy';
const MAX=20, AGE=30*24*60*60*1000;
type Entry={id:string; at:number};
const key=(owner:string)=>`yrdly.google.pending.${owner}`;
let serial:Promise<unknown>=Promise.resolve();
function queue(action:()=>Promise<void>):Promise<void>{const next=serial.then(action,action);serial=next.catch(()=>{});return next;}
async function read(owner:string):Promise<Entry[]> {
  try {const data=JSON.parse(await SecureStore.getItemAsync(key(owner)) || '[]');
    return Array.isArray(data)?data.filter((e:Entry)=>e&&typeof e.id==='string'&&UUID.test(e.id)&&Number.isFinite(e.at)&&e.at<=Date.now()&&Date.now()-e.at<=AGE).slice(-MAX):[];
  }catch{return [];}
}
async function save(owner:string,entries:Entry[]) {
  if(entries.length) await SecureStore.setItemAsync(key(owner),JSON.stringify(entries.slice(-MAX)));
  else await SecureStore.deleteItemAsync(key(owner));
}
export function rememberListing(row:unknown,owner:string):Promise<void>{
  if(!googleMeasurement.allowed())return Promise.resolve();
  const p=approvedListing(row,owner);if(!p)return Promise.resolve();
  return queue(async()=>{
    if(!googleMeasurement.allowed())return;
    const entries=await read(owner);
    if(!p.pending&&await googleMeasurement.conversion('listing_published',p.id)) {
      await save(owner,entries.filter(e=>e.id!==p.id));return;
    }
    if(googleMeasurement.allowed()&&!entries.some(e=>e.id===p.id))await save(owner,[...entries,{id:p.id,at:Date.now()}]);
  }).catch(()=>{});
}
export function recoverListings(owner:string,isCurrent:()=>boolean,lookup:(id:string)=>Promise<unknown>):Promise<void>{
  if(!UUID.test(owner))return Promise.resolve();
  return queue(async()=>{
    if(!googleMeasurement.allowed()||!isCurrent())return;
    for(const entry of await read(owner)){
      if(!googleMeasurement.allowed()||!isCurrent())return;
      try {const row=await lookup(entry.id);
        if(!googleMeasurement.allowed()||!isCurrent())return;
        const p=approvedListing(row,owner);
        if(!p||(!p.pending&&await googleMeasurement.conversion('listing_published',entry.id)))await save(owner,(await read(owner)).filter(e=>e.id!==entry.id));
      }catch(error){if((error as {status?:number})?.status===404)await save(owner,(await read(owner)).filter(e=>e.id!==entry.id));}
    }
  }).catch(()=>{});
}
export function clearListings(owner:string):Promise<void>{return UUID.test(owner)?queue(()=>SecureStore.deleteItemAsync(key(owner))).catch(()=>{}):Promise.resolve();}
