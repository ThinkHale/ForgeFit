import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';
import { useStore } from '../store';

import AuthScreen from '../screens/Auth/AuthScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import CoachScreen from '../screens/Coach/CoachScreen';
import NutritionScreen from '../screens/Nutrition/NutritionScreen';
import WorkoutsScreen from '../screens/Workouts/WorkoutsScreen';
import ProgressScreen from '../screens/Progress/ProgressScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠', Coach: '⚡', Nutrition: '🥗', Workouts: '💪', Progress: '📊',
};

function TabBar({ state, descriptors, navigation }: any) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[tabStyles.container, { paddingBottom: bottom || 16 }]}>
      {state.routes.map((route: any, i: number) => {
        const focused = state.index === i;
        return (
          <View key={route.key} style={tabStyles.tab}>
            <Text
              onPress={() => navigation.navigate(route.name)}
              style={[tabStyles.icon, focused && tabStyles.iconFocused]}
            >
              {TAB_ICONS[route.name]}
            </Text>
            <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>
              {route.name}
            </Text>
            {focused && (
              <LinearGradient
                colors={colors.gradients.brand as [string, string]}
                style={tabStyles.activeDot}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Coach"     component={CoachScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Workouts"  component={WorkoutsScreen} />
      <Tab.Screen name="Progress"  component={ProgressScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, profile, isAuthLoading } = useStore();
  const isNew = !profile || profile.sessionCount === 0;

  if (isAuthLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#FF4500" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <Stack.Screen name="Auth"       component={AuthScreen} />
        ) : isNew ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen name="Main"       component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', paddingTop: 8,
    backgroundColor: colors.background.primary,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.08)',
  },
  tab:          { flex: 1, alignItems: 'center', gap: 2, position: 'relative' },
  icon:         { fontSize: 22, opacity: 0.4 },
  iconFocused:  { opacity: 1 },
  label:        { ...typography.label, color: colors.text.tertiary },
  labelFocused: { color: colors.brand.primary },
  activeDot:    { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: -4 },
});
