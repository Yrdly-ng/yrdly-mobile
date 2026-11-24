import { useEffect,useState } from 'react';
import { Switch,Text,View } from 'react-native';
import { googleMeasurement,googleMeasurementConfigured } from '@/lib/telemetry/google-measurement';
import { clearListings } from '@/lib/telemetry/google-listings';
export function GoogleMeasurementPreference({owner,color,muted,accent}:{owner?:string;color:string;muted:string;accent:string}) {
  const [allowed,setAllowed]=useState(false);
  const [busy,setBusy]=useState(true);
  useEffect(()=>{let current=true;if(googleMeasurementConfigured)void googleMeasurement.initialize().then(value=>{if(current){setAllowed(value);setBusy(false);}});return()=>{current=false;};},[]);
  if(!googleMeasurementConfigured)return null;
  return <View style={{paddingVertical:16,flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{flex:1}}>
      <Text style={{color,fontSize:15,fontWeight:'600'}}>Optional Google Analytics</Text>
      <Text style={{color:muted,fontSize:12,lineHeight:18}}>Allow app usage and completed purchase measurement. Advertising personalization is disabled. Change this choice in Privacy settings.</Text>
    </View>
    <Switch accessibilityLabel="Optional Google Analytics" value={allowed} disabled={busy} trackColor={{true:accent}} onValueChange={value=>{
      setBusy(true);void googleMeasurement.choose(value).then(async enabled=>{if(!enabled&&owner)await clearListings(owner);setAllowed(enabled);}).finally(()=>setBusy(false));
    }}/>
  </View>;
}
