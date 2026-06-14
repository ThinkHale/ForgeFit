const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// react-native-health-connect's own Expo plugin only adds the
// ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter. It does NOT declare the
// Health Connect <uses-permission> entries, the <queries> package visibility,
// or the Android 14+ rationale activity-alias — without these, calling
// requestPermission() crashes the app. This local plugin fills that gap.
//
// Keep this list in sync with PERMISSIONS in src/services/health.android.ts.
const HEALTH_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.WRITE_STEPS',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.WRITE_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.WRITE_WEIGHT',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.WRITE_EXERCISE',
  'android.permission.health.READ_SLEEP',
];

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

const withHealthConnectPermissions = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // 1. <uses-permission> for each health data type we read/write.
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of HEALTH_PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === name,
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    // 2. <queries> so the app can see/launch the Health Connect app on Android 13-.
    manifest.queries = manifest.queries || [];
    const hasQuery = manifest.queries.some((q) =>
      (q.package || []).some(
        (pkg) => pkg.$ && pkg.$['android:name'] === HEALTH_CONNECT_PACKAGE,
      ),
    );
    if (!hasQuery) {
      manifest.queries.push({
        package: [{ $: { 'android:name': HEALTH_CONNECT_PACKAGE } }],
      });
    }

    // 3. Android 14+ rationale: an activity-alias that surfaces the permissions
    //    rationale when users tap the privacy-policy link in the HC permission UI.
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    application['activity-alias'] = application['activity-alias'] || [];
    const aliasName = 'ViewPermissionUsageActivity';
    const hasAlias = application['activity-alias'].some(
      (a) => a.$ && a.$['android:name'] === aliasName,
    );
    if (!hasAlias) {
      application['activity-alias'].push({
        $: {
          'android:name': aliasName,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } },
            ],
            category: [
              { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } },
            ],
          },
        ],
      });
    }

    return config;
  });

module.exports = withHealthConnectPermissions;
