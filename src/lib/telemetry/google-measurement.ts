import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { productionMeasurementAllowed } from './google-measurement-policy';
import { createMeasurementController } from './google-measurement-core';
export const googleMeasurementConfigured = process.env.EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS === 'true' &&
  process.env.EXPO_PUBLIC_APP_ENV === 'production' && !__DEV__ && ['android','ios'].includes(Platform.OS);
const storage={get:SecureStore.getItemAsync,set:SecureStore.setItemAsync,remove:SecureStore.deleteItemAsync};
export const googleMeasurement = createMeasurementController({
  storage,
  hash:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value),
  driver:async()=>{
    if(!googleMeasurementConfigured)return null;
    try {
      const appSdk=await import('@react-native-firebase/app');
      const sdk=await import('@react-native-firebase/analytics');
      const app=appSdk.getApp();
      if(!productionMeasurementAllowed({enabled:process.env.EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS,env:process.env.EXPO_PUBLIC_APP_ENV,
        platform:Platform.OS,development:__DEV__,apiOrigin:(process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://app.yrdly.ng').replace(/\/+$/,''),
        database:process.env.EXPO_PUBLIC_SUPABASE_URL,firebaseProject:app.options.projectId}))return null;
      const analytics=sdk.getAnalytics(app);
      return {
        consent:allowed=>sdk.setConsent(analytics,{analytics_storage:allowed,ad_storage:false,ad_user_data:false,ad_personalization:false}),
        collection:allowed=>sdk.setAnalyticsCollectionEnabled(analytics,allowed),
        event:(name,params)=>sdk.logEvent(analytics,name,params),
      };
    }catch{return null;}
  },
});
