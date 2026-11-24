const {withAndroidManifest,AndroidConfig}=require('expo/config-plugins');
module.exports=function withGoogleAnalyticsPrivacy(config){
  return withAndroidManifest(config,config=>{
    const application=AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const enabled=process.env.EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS==='true' && process.env.EXPO_PUBLIC_APP_ENV==='production';
    const flags={firebase_analytics_collection_enabled:false,firebase_analytics_collection_deactivated:!enabled,
      google_analytics_adid_collection_enabled:false,google_analytics_ssaid_collection_enabled:false,
      google_analytics_automatic_screen_reporting_enabled:false,google_analytics_default_allow_analytics_storage:false,
      google_analytics_default_allow_ad_storage:false,google_analytics_default_allow_ad_user_data:false,
      google_analytics_default_allow_ad_personalization_signals:false};
    for(const [key,value] of Object.entries(flags)){
      application['meta-data']=(application['meta-data']||[]).filter(x=>x.$['android:name']!==key);
      application['meta-data'].push({$: {'android:name':key,'android:value':String(value)}});
    }
    return config;
  });
};
