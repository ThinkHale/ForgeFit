const path = require('path');

// Load .env if present (development only — never commit .env)
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch (_) {
  // dotenv not yet installed; env vars must be set in the shell
}

module.exports = {
  expo: {
    name: 'Forge',
    slug: 'forge-fitness',
    scheme: 'forgefitness',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#14141E',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.thinkhale.forgefitness',
      buildNumber: process.env.IOS_BUILD_NUMBER || '1',
      infoPlist: {
        NSHealthShareUsageDescription:
          'Forge reads your health data to personalize your workouts and nutrition.',
        NSHealthUpdateUsageDescription:
          'Forge writes workout and nutrition data to Apple Health.',
        NSMotionUsageDescription:
          'Forge uses motion data to detect your activity level.',
        NSCameraUsageDescription:
          'Forge uses your camera to scan food barcodes for quick nutrition logging.',
      },
      entitlements: {
        'com.apple.developer.healthkit': true,
        'com.apple.developer.healthkit.background-delivery': true,
      },
    },
    android: {
      package: process.env.ANDROID_PACKAGE || 'com.thinkhale.forgefit',
      versionCode: Number(process.env.ANDROID_VERSION_CODE || 1),
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#14141E',
      },
      // The react-native-health-connect plugin only adds the permissions-rationale
      // intent-filter — the actual Health Connect permissions must be declared here.
      // These mirror the read/write record types requested in health.android.ts.
      // CAMERA is for barcode scanning.
      permissions: [
        'CAMERA',
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
      ],
    },
    plugins: [
      'expo-font',
      'expo-secure-store',
      'expo-apple-authentication',
      'expo-camera',
      'react-native-health-connect',
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            // Health Connect pulls in Jetpack Compose, whose compiler 1.5.15
            // requires Kotlin 1.9.25 (Expo SDK 52 defaults to 1.9.24).
            kotlinVersion: '1.9.25',
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF6B35',
          sounds: [],
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
      eas: {
        projectId: '69585c22-2f6c-4945-8103-0e53065fe6a8',
      },
    },
    owner: 'haleinnovation',
  },
};
