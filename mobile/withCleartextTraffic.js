const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Expo Config Plugin to permit HTTP (cleartext) traffic on Android
 * Sets android:usesCleartextTraffic="true" on <application> in AndroidManifest.xml
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    if (
      androidManifest &&
      androidManifest.manifest &&
      androidManifest.manifest.application &&
      androidManifest.manifest.application[0]
    ) {
      if (!androidManifest.manifest.application[0].$) {
        androidManifest.manifest.application[0].$ = {};
      }
      androidManifest.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }
    return config;
  });
};
