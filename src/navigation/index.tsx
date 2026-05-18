import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, typography } from '../theme';
import { useStore } from '../store';

// Screens
import AuthScreen from '../screens/Auth/AuthScreen';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import CoachScreen from '../screens/Coach/CoachScreen';
import NutritionScreen from '../screens/Nutrition/NutritionScreen';

// Placeholder screens
function WorkoutsScreen() { return <View style={p.c}><Text style={p.t}>Workouts</Text></View>; }
function ProgressScreen() { return <View style={p.c}><Text style={p.t}>Progress</Text></View>; }
const p = StyleSheet.create({ c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, t: { fontSize: 24, fontWeight: '700', color: colors.text.primary } });

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠', Coach: '⚡', Nutrition: '🥗', Workouts: '💪', Progress: '📊',
};

function TabBar({ state, descriptors, navigation }: any) {
  return (
    <BlurView intensity={80} tint="light" style={tabStyles.container}>
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
    </BlurView>
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
  const { user, profile } = useStore();
  const isNew = !profile || profile.sessionCount === 0;

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
    flexDirection: 'row', paddingBottom: 24, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.08)',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  tab:          { flex: 1, alignItems: 'center', gap: 2, position: 'relative' },
  icon:         { fontSize: 22, opacity: 0.4 },
  iconFocused:  { opacity: 1 },
  label:        { ...typography.label, color: colors.text.tertiary },
  labelFocused: { color: colors.brand.primary },
  activeDot:    { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: -4 },
});
