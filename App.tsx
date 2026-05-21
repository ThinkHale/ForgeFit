import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import AppNavigator from './src/navigation';
import { authService, supabase } from './src/services/supabase';
import { healthService } from './src/services/health';
import { notificationService } from './src/services/notifications';
import { useStore } from './src/store';

export default function App() {
  const { setUser, loadProfile, loadNutritionToday } = useStore();

  useEffect(() => {
    healthService.autoInitialize();
    notificationService.areNotificationsEnabled().then(enabled => {
      if (enabled) notificationService.scheduleDefaultReminders();
    });
  }, []);

  // Handle email confirmation deep links (forgefitness://auth/callback#access_token=...)
  useEffect(() => {
    async function handleUrl(url: string) {
      // Supabase appends tokens as a hash fragment; parse it as query params
      const parsed = Linking.parse(url);
      const fragment = (parsed as any).fragment ?? '';
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      }
    }

    // App opened via deep link while not running
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });

    // App already running when deep link arrives
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Listen for auth state changes.
    // Only reload profile on SIGNED_IN — not on TOKEN_REFRESHED, which fires whenever
    // the app returns from background (e.g. after a HealthKit permission dialog) and
    // would race with an in-progress saveProfile call, resetting sessionCount to 0.
    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.name ?? '',
          createdAt: session.user.created_at,
        });
        // INITIAL_SESSION fires on cold launch; SIGNED_IN fires on explicit login.
        // TOKEN_REFRESHED is excluded — it fires when returning from background (e.g.
        // after a HealthKit permission dialog) and would race with an in-progress
        // saveProfile call, resetting sessionCount back to 0.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          await loadProfile();
          loadNutritionToday();
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
