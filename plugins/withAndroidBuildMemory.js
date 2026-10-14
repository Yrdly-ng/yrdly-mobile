const { withGradleProperties } = require('expo/config-plugins');

// D8 ran out of its default Java heap while merging the release dex files.
// Apply this after expo-build-properties so clean EAS prebuilds retain it.
module.exports = function withAndroidBuildMemory(config) {
  return withGradleProperties(config, (config) => {
    const properties = {
      'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8',
      'org.gradle.workers.max': '2',
      'org.gradle.parallel': 'false',
    };
    for (const [key, value] of Object.entries(properties)) {
      const existing = config.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) existing.value = value;
      else config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};
