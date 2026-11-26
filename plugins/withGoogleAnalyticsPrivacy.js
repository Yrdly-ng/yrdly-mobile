const {withAndroidManifest,AndroidConfig}=require('expo/config-plugins');
module.exports=function withGoogleAnalyticsPrivacy(config){
  return withAndroidManifest(config,config=>{
    const manifest=config.modResults.manifest;
    // Declare tools namespace so we can explicitly override Firebase Analytics
    // library metadata. The library's manifest defaults this flag to false;
    // YRDLY intentionally deactivates collection until production opt-in.
    manifest.$['xmlns:tools']='http://schemas.android.com/tools';
    const application=AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const enabled=process.env.EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS==='true' && process.env.EXPO_PUBLIC_APP_ENV==='production';
    const flags={firebase_analytics_collection_enabled:false,firebase_analytics_collection_deactivated:!enabled,
      google_analytics_adid_collection_enabled:false,google_analytics_ssaid_collection_enabled:false,
      google_analytics_automatic_screen_reporting_enabled:false,google_analytics_default_allow_analytics_storage:false,
      google_analytics_default_allow_ad_storage:false,google_analytics_default_allow_ad_user_data:false,
      google_analytics_default_allow_ad_personalization_signals:false};
    for(const [key,value] of Object.entries(flags)){
      application['meta-data']=(application['meta-data']||[]).filter(x=>x.$['android:name']!==key);
      const metadata={$:{'android:name':key,'android:value':String(value)}};
      if(key==='firebase_analytics_collection_deactivated'){
        metadata.$['tools:replace']='android:value';
      }
      application['meta-data'].push(metadata);
    }
    return config;
  });
};
