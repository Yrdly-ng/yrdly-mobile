const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAROptional(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults;
    let application = androidManifest.manifest.application[0];
    
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    
    const arCoreMetaData = application['meta-data'].find(
      (item) => item.$['android:name'] === 'com.google.ar.core'
    );

    if (arCoreMetaData) {
      arCoreMetaData.$['android:value'] = 'optional';
    } else {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.ar.core',
          'android:value': 'optional'
        }
      });
    }

    return config;
  });
};
