const {test}=require('node:test');
const assert=require('node:assert/strict');

function loadPlugin(){
  let mod;
  const mocked=requireName=>{
    if(requireName==='expo/config-plugins')return {
      withAndroidManifest:(config,mod)=>mod(config),
      AndroidConfig:{Manifest:{getMainApplicationOrThrow:result=>result.manifest.application[0]}}
    };
    return require(requireName);
  };
  const exports={};
  new Function('module','require',require('node:fs').readFileSync('plugins/withGoogleAnalyticsPrivacy.js','utf8'))(
    {exports},mocked
  );
  mod=exports;
  return mod;
}
function build(env){
  const old={...process.env};
  for(const k of ['EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS','EXPO_PUBLIC_APP_ENV'])delete process.env[k];
  Object.assign(process.env,env);
  try{
    const config={modResults:{manifest:{$:{'xmlns:android':'http://schemas.android.com/apk/res/android'},application:[{'meta-data':[]} ]}}};
    loadPlugin()(config);
    return config.modResults.manifest;
  }finally{
    for(const k of ['EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS','EXPO_PUBLIC_APP_ENV'])delete process.env[k];
    Object.assign(process.env,old);
  }
}
test('analytics collection is deactivated by default and explicitly overrides Firebase library metadata',()=>{
  const m=build({EXPO_PUBLIC_APP_ENV:'production'});
  const item=m.application[0]['meta-data'].find(x=>x.$['android:name']==='firebase_analytics_collection_deactivated');
  assert.equal(item.$['android:value'],'true');
  assert.equal(item.$['tools:replace'],'android:value');
  assert.equal(m.$['xmlns:tools'],'http://schemas.android.com/tools');
});
test('collection deactivation is false only for opted-in production analytics builds',()=>{
  const m=build({EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS:'true'});
  const item=m.application[0]['meta-data'].find(x=>x.$['android:name']==='firebase_analytics_collection_deactivated');
  assert.equal(item.$['android:value'],'false');
  assert.equal(item.$['tools:replace'],'android:value');
  const preview=build({EXPO_PUBLIC_APP_ENV:'preview',EXPO_PUBLIC_YRDLY_GOOGLE_ANALYTICS:'true'});
  const previewItem=preview.application[0]['meta-data'].find(x=>x.$['android:name']==='firebase_analytics_collection_deactivated');
  assert.equal(previewItem.$['android:value'],'true');
});
