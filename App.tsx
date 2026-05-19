import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation';
import { authService } from './src/services/supabase';
import { useStore } from './src/store';

export default function App() {
  const { setUser, loadProfile, loadNutritionToday } = useStore();

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
