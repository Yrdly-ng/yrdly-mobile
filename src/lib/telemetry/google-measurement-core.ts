import { conversions, UUID, HASH, purchaseParams, verifiedPurchase, type Conversion } from './google-measurement-policy';
type Driver = { consent: (allowed:boolean) => Promise<void>; collection: (allowed:boolean) => Promise<void>; event: (name:string,params:Record<string,unknown>) => Promise<void>; };
type Storage = { get:(key:string)=>Promise<string|null>; set:(key:string,value:string)=>Promise<void>; remove:(key:string)=>Promise<void> };
const CONSENT='yrdly.google.analytics.consent.v1';
/** Single serialized controller; withdrawal stops queued work immediately. */
export function createMeasurementController(deps: {driver:()=>Promise<Driver|null>; storage:Storage; hash:(value:string)=>Promise<string>}) {
  let allowed=false, initialized=false, available=false, epoch=0;
  let serial:Promise<unknown>=Promise.resolve();
  function enqueue<T>(work:()=>Promise<T>):Promise<T> {
    const next=serial.then(work,work);
    serial=next.catch(()=>{});
    return next;
  }
  async function configure(enable:boolean):Promise<boolean> {
    const sdk=await deps.driver();
    if (!sdk) {available=false;return false;}
    available=true;
    if (enable) { await sdk.consent(true); await sdk.collection(true); }
    else { try {await sdk.collection(false);} finally {await sdk.consent(false);} }
    return true;
  }
  function initialize():Promise<boolean> {
    return enqueue(async()=>{
      if(initialized)return allowed;
      const version=epoch;
      try {
        const consent=await deps.storage.get(CONSENT);
        const enable=consent==='granted' && version===epoch;
        const ready=await configure(enable);
        allowed=ready&&enable&&version===epoch;
        initialized=true;
      } catch {allowed=false; initialized=true; try {await configure(false);}catch{}}
      return allowed;
    });
  }
  function choose(enable:boolean):Promise<boolean> {
    const version=++epoch; allowed=false;
    return enqueue(async()=>{
      try {
        if(!enable) {
          // Disable native collection even if persisting the choice fails.
          try {await configure(false);} finally {await deps.storage.set(CONSENT,'denied');}
          initialized=true;
          return false;
        }
        if(version!==epoch)return false;
        await deps.storage.set(CONSENT,'granted');
        const ready=await configure(true);
        allowed=ready&&version===epoch;
        initialized=true;
        if(!allowed) await configure(false);
        return allowed;
      } catch {allowed=false;try {await configure(false);}catch{};try {await deps.storage.set(CONSENT,'denied');}catch{};return false;}
    });
  }
  function once(event:string, id:string, build:(hash:string)=>Record<string,unknown>):Promise<boolean> {
    if(!allowed||!UUID.test(id))return Promise.resolve(false);
    const version=epoch;
    return enqueue(async()=>{
      if(!allowed||version!==epoch)return false;
      try {
        const hash=await deps.hash(`yrdly-ga4-${event}:${id.toLowerCase()}`);
        if(!HASH.test(hash)||!allowed||version!==epoch)return false;
        const key=`yrdly.google.sent.${event}.${hash}`;
        if(await deps.storage.get(key))return true;
        const sdk=await deps.driver();
        if(!sdk||!allowed||version!==epoch)return false;
        await deps.storage.set(key,'1');
        if(!allowed||version!==epoch){await deps.storage.remove(key);return false;}
        try {await sdk.event(event,build(hash));return true;}
        catch {await deps.storage.remove(key);return false;}
      } catch {return false;}
    });
  }
  return {initialize,choose,allowed:()=>allowed,available:()=>available,
    conversion(event:Conversion,id:string) {return conversions.has(event)?once(event,id,()=>({})):Promise.resolve(false);},
    purchase(path:string,result:unknown) {const p=verifiedPurchase(path,result);return p?once('purchase',p.id,hash=>purchaseParams(hash,p.amount,p.kind)):Promise.resolve(false);},
  };
}
