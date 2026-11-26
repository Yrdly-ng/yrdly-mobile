const { withGradleProperties } = require('expo/config-plugins');

// Android Gradle Plugin 8.12+ supports optimized resource shrinking when
// R8 minification and resource shrinking are enabled. Keep the opt-in in
// generated gradle.properties so clean Expo prebuilds retain it.
module.exports = function withOptimizedResourceShrinking(config) {
  return withGradleProperties(config, (config) => {
    const key = 'android.r8.optimizedResourceShrinking';
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === key
    );

    if (existing) existing.value = 'true';
    else config.modResults.push({ type: 'property', key, value: 'true' });

    return config;
  });
};
