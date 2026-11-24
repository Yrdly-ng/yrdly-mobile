import * as SecureStore from 'expo-secure-store';
import { googleMeasurement } from './google-measurement';
import { approvedListing, UUID } from './google-measurement-policy';
const MAX=15, AGE=30*24*60*60*1000;
// One bounded device-wide queue ensures consent withdrawal clears every account.
const key='yrdly.google.pending.listings.v2';
type Entry={id:string; owner:string; at:number};
let serial:Promise<unknown>=Promise.resolve();
function queue(action:()=>Promise<void>):Promise<void>{const next=serial.then(action,action);serial=next.catch(()=>{});return next;}
async function read():Promise<Entry[]> {
  try {const data=JSON.parse(await SecureStore.getItemAsync(key) || '[]');
    return Array.isArray(data)?data.filter((e:Entry)=>e&&typeof e.id==='string'&&UUID.test(e.id)&&typeof e.owner==='string'&&UUID.test(e.owner)&&Number.isFinite(e.at)&&e.at<=Date.now()&&Date.now()-e.at<=AGE).slice(-MAX):[];
  }catch{return [];}
}
async function save(entries:Entry[]) {
  if(entries.length) await SecureStore.setItemAsync(key,JSON.stringify(entries.slice(-MAX)));
  else await SecureStore.deleteItemAsync(key);
}
export function rememberListing(row:unknown,owner:string):Promise<void>{
  if(!googleMeasurement.allowed())return Promise.resolve();
  const p=approvedListing(row,owner);if(!p)return Promise.resolve();
  return queue(async()=>{
    if(!googleMeasurement.allowed())return;
    const entries=await read();
    if(!p.pending&&await googleMeasurement.conversion('listing_published',p.id)) {
      await save(entries.filter(e=>e.id!==p.id||e.owner!==owner));return;
    }
    if(googleMeasurement.allowed()&&!entries.some(e=>e.id===p.id&&e.owner===owner))await save([...entries,{id:p.id,owner,at:Date.now()}]);
  }).catch(()=>{});
}
export function recoverListings(owner:string,isCurrent:()=>boolean,lookup:(id:string)=>Promise<unknown>):Promise<void>{
  if(!UUID.test(owner))return Promise.resolve();
  return queue(async()=>{
    if(!googleMeasurement.allowed()||!isCurrent())return;
    for(const entry of (await read()).filter(e=>e.owner===owner)){
      if(!googleMeasurement.allowed()||!isCurrent())return;
      try {const row=await lookup(entry.id);
        if(!googleMeasurement.allowed()||!isCurrent())return;
        const p=approvedListing(row,owner);
        if(!p||(!p.pending&&await googleMeasurement.conversion('listing_published',entry.id)))await save((await read()).filter(e=>e.id!==entry.id||e.owner!==owner));
      }catch(error){if((error as {status?:number})?.status===404)await save((await read()).filter(e=>e.id!==entry.id||e.owner!==owner));}
    }
  }).catch(()=>{});
}
export function clearListings():Promise<void>{return queue(()=>SecureStore.deleteItemAsync(key)).catch(()=>{});}
