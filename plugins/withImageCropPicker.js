const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withImageCropPicker(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];
    
    // Check if UCropActivity already exists
    const hasUCrop = mainApplication.activity?.some(
      (activity) => activity.$['android:name'] === 'com.yalantis.ucrop.UCropActivity'
    );

    if (!hasUCrop) {
      if (!mainApplication.activity) {
        mainApplication.activity = [];
      }
      mainApplication.activity.push({
        $: {
          'android:name': 'com.yalantis.ucrop.UCropActivity',
          'android:screenOrientation': 'portrait',
          'android:theme': '@style/Theme.AppCompat.Light.NoActionBar',
        },
      });
    }

    return config;
  });
};
