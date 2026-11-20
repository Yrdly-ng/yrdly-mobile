const { withAndroidManifest } = require('expo/config-plugins');

const optionalFeatures = [
  'android.hardware.screen.portrait',
  'android.hardware.wifi',
];

module.exports = function withAndroidOptionalFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';

    const features = (manifest['uses-feature'] ?? []).filter(
      (feature) => !optionalFeatures.includes(feature.$['android:name'])
    );

    for (const name of optionalFeatures) {
      features.push({
        $: {
          'android:name': name,
          'android:required': 'false',
          // A dependency's required feature would otherwise win the manifest merge.
          'tools:node': 'replace',
        },
      });
    }

    manifest['uses-feature'] = features;
    return config;
  });
};
