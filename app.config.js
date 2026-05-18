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
      bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.forgefit.app',
      buildNumber: process.env.IOS_BUILD_NUMBER || '1',
      infoPlist: {
        NSHealthShareUsageDescription:
          'Forge reads your health data to personalize your workouts and nutrition.',
        NSHealthUpdateUsageDescription:
          'Forge writes workout and nutrition data to Apple Health.',
        NSMotionUsageDescription:
          'Forge uses motion data to detect your activity level.',
      },
      entitlements: {
        'com.apple.developer.healthkit': true,
        'com.apple.developer.healthkit.background-delivery': true,
      },
    },
    plugins: [
      'expo-font',
      'expo-secure-store',
      'expo-apple-authentication',
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
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    },
  },
};
