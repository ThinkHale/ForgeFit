import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { healthService } from '../../services/health';
import { colors, spacing, radius, typography, shadows } from '../../theme';

const { width } = Dimensions.get('window');

// ─── Ring component (Activity rings style) ────────────────────────────────────
function ActivityRing({
  progress, size = 64, strokeWidth = 7,
  color = colors.brand.primary, trackColor = 'rgba(0,0,0,0.06)',
}: {
  progress: number; size?: number; strokeWidth?: number;
  color?: string; trackColor?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(progress, 1);
  return (
    <View style={{ width: size, height: size }}>
      {/* SVG would be used in real app; using View approximation here */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: trackColor,
        position: 'absolute',
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color,
        position: 'absolute',
        opacity: Math.min(progress, 1),
        transform: [{ rotate: `${progress * 360}deg` }],
      }} />
      <View style={{
        position: 'absolute', inset: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color }}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, unit, icon, gradient, progress,
}: {
  label: string; value: string | number; unit?: string;
  icon: string; gradient: string[]; progress?: number;
}) {
  return (
    <View style={[styles.statCard, shadows.md]}>
      <LinearGradient
        colors={gradient as [string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.statCardGradient}
      >
        <View style={styles.statCardHeader}>
          <Text style={styles.statIcon}>{icon}</Text>
          {progress !== undefined && (
            <ActivityRing
              progress={progress}
              size={44}
              strokeWidth={5}
              color="rgba(255,255,255,0.9)"
              trackColor="rgba(255,255,255,0.25)"
            />
          )}
        </View>
        <Text style={styles.statValue}>
          {value}
          {unit && <Text style={styles.statUnit}> {unit}</Text>}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

// ─── Quick action pill ────────────────────────────────────────────────────────
function QuickAction({ icon, label, onPress, accent }: {
  icon: string; label: string; onPress: () => void; accent: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.quickAction}>
      <View style={[styles.quickActionIcon, { backgroundColor: accent + '18' }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: { navigation: any }) {
  const { profile, healthToday, nutritionToday, setHealthToday } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] ?? null;

  async function loadHealthData() {
    try {
      const snapshot = await healthService.getTodaySnapshot();
      setHealthToday(snapshot);
    } catch {}
  }

  useEffect(() => { loadHealthData(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadHealthData();
    setRefreshing(false);
  }

  const calorieProgress = nutritionToday
    ? nutritionToday.totalCalories / (nutritionToday.calorieGoal || 2000)
    : 0;
  const stepProgress = healthToday?.steps ? healthToday.steps / 10000 : 0;
  const caloriesBurned = healthToday?.activeCalories ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Hero gradient background */}
      <LinearGradient
        colors={['#FFF5F0', '#FFFFFF']}
        style={styles.heroBg}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greeting}{firstName ? `, ${firstName}` : ''}.</Text>
              <Text style={styles.subGreeting}>
                {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity style={styles.avatarBtn}>
              <LinearGradient
                colors={colors.gradients.brand as [string, string]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {firstName ? firstName[0].toUpperCase() : '🔥'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Coach bond teaser (if new) */}
          {profile && profile.sessionCount === 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Coach')}
              activeOpacity={0.85}
              style={[styles.welcomeCard, shadows.md]}
            >
              <LinearGradient
                colors={['#FF6B35', '#FF9F1C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.welcomeGradient}
              >
                <View style={styles.welcomeContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.welcomeTitle}>Meet your AI coach ⚡</Text>
                    <Text style={styles.welcomeBody}>
                      Forge learns how you train, what motivates you, and gets smarter every session.
                    </Text>
                  </View>
                  <Text style={{ fontSize: 32 }}>→</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Activity stats */}
          <Text style={styles.sectionTitle}>Today's Activity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
            <StatCard
              icon="👟"
              label="Steps"
              value={healthToday?.steps?.toLocaleString() ?? '0'}
              gradient={['#FF6B35', '#FF9F1C']}
              progress={stepProgress}
            />
            <StatCard
              icon="🔥"
              label="Calories"
              value={caloriesBurned}
              unit="kcal"
              gradient={['#FF3B30', '#FF6B35']}
              progress={caloriesBurned / 500}
            />
            <StatCard
              icon="❤️"
              label="Heart Rate"
              value={healthToday?.heartRateAvg ?? '--'}
              unit="bpm"
              gradient={['#FF2D55', '#FF6B35']}
            />
            <StatCard
              icon="🌙"
              label="Sleep"
              value={healthToday?.sleepHours ? healthToday.sleepHours.toFixed(1) : '--'}
              unit="hrs"
              gradient={['#7B61FF', '#5856D6']}
              progress={healthToday?.sleepHours ? healthToday.sleepHours / 8 : 0}
            />
          </ScrollView>

          {/* Nutrition summary */}
          {nutritionToday && (
            <>
              <Text style={styles.sectionTitle}>Nutrition Today</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Nutrition')}
                activeOpacity={0.85}
                style={[styles.nutritionCard, shadows.sm]}
              >
                {/* Calorie bar */}
                <View style={styles.calorieRow}>
                  <View>
                    <Text style={styles.calorieNum}>{nutritionToday.totalCalories}</Text>
                    <Text style={styles.calorieLabel}>of {nutritionToday.calorieGoal} kcal</Text>
                  </View>
                  <View style={styles.calorieRemain}>
                    <Text style={[styles.calorieNum, { color: colors.brand.primary }]}>
                      {Math.max(0, nutritionToday.calorieGoal - nutritionToday.totalCalories)}
                    </Text>
                    <Text style={styles.calorieLabel}>remaining</Text>
                  </View>
                </View>
                <View style={styles.calorieTrack}>
                  <View style={[
                    styles.calorieFill,
                    { width: `${Math.min(100, calorieProgress * 100)}%` as unknown as number,
                      backgroundColor: calorieProgress > 1 ? colors.error : colors.brand.primary }
                  ]} />
                </View>
                {/* Macros */}
                <View style={styles.macroRow}>
                  {[
                    { label: 'Protein', val: nutritionToday.totalProtein, goal: nutritionToday.proteinGoal, color: colors.brand.electric },
                    { label: 'Carbs',   val: nutritionToday.totalCarbs,   goal: nutritionToday.carbGoal,    color: colors.brand.accent },
                    { label: 'Fat',     val: nutritionToday.totalFat,     goal: nutritionToday.fatGoal,     color: colors.brand.secondary },
                  ].map(m => (
                    <View key={m.label} style={styles.macro}>
                      <Text style={[styles.macroVal, { color: m.color }]}>{m.val}g</Text>
                      <Text style={styles.macroLabel}>{m.label}</Text>
                      <View style={styles.macroTrack}>
                        <View style={[styles.macroFill, { width: `${Math.min(100, (m.val / m.goal) * 100)}%` as unknown as number, backgroundColor: m.color }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Quick actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <QuickAction icon="🤖" label="Ask Coach" onPress={() => navigation.navigate('Coach')} accent={colors.brand.primary} />
            <QuickAction icon="💪" label="Log Workout" onPress={() => navigation.navigate('Workouts')} accent={colors.brand.secondary} />
            <QuickAction icon="🥗" label="Log Meal" onPress={() => navigation.navigate('Nutrition')} accent={colors.brand.accent} />
            <QuickAction icon="📊" label="Progress" onPress={() => navigation.navigate('Progress')} accent={colors.brand.electric} />
          </View>

          {/* Coach bond card (if not new) */}
          {profile && profile.sessionCount > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Coach</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Coach')}
                activeOpacity={0.85}
                style={[styles.coachCard, shadows.sm]}
              >
                <View style={styles.coachCardInner}>
                  <View style={styles.coachAvatar}>
                    <Text style={{ fontSize: 26 }}>⚡</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coachName}>Forge AI Coach</Text>
                    <Text style={styles.coachStage}>
                      {profile.sessionCount} sessions · {profile.relationshipStage === 'new' ? 'Just met' : profile.relationshipStage === 'building' ? 'Getting to know you' : profile.relationshipStage === 'established' ? 'Well acquainted' : 'Deep bond'}
                    </Text>
                    {profile.lastSessionSummary && (
                      <Text style={styles.coachLastSession} numberOfLines={2}>
                        Last: {profile.lastSessionSummary}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: colors.brand.primary, fontSize: 20 }}>›</Text>
                </View>
                {/* Bond bar */}
                <View style={styles.bondTrack}>
                  <LinearGradient
                    colors={colors.gradients.brand as [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.bondFill, { width: `${Math.min(100, (profile.sessionCount / 10) * 100)}%` as unknown as number }]}
                  />
                </View>
                <Text style={styles.bondLabel}>
                  {profile.sessionCount < 10 ? `${10 - profile.sessionCount} sessions to deep bond` : 'Deep coaching bond'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background.primary },
  heroBg:           { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  scroll:           { paddingHorizontal: spacing.md },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg },
  greeting:         { ...typography.h1, color: colors.text.primary },
  subGreeting:      { ...typography.small, color: colors.text.secondary, marginTop: 2 },
  avatarBtn:        {},
  avatar:           { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { ...typography.h4, color: '#fff' },
  sectionTitle:     { ...typography.captionMed, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },
  statsRow:         { marginHorizontal: -spacing.md, paddingHorizontal: spacing.md },
  statCard:         { width: 140, marginRight: spacing.sm, borderRadius: radius.lg, overflow: 'hidden' },
  statCardGradient: { padding: spacing.md, minHeight: 130 },
  statCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  statIcon:         { fontSize: 24 },
  statValue:        { ...typography.h2, color: '#fff', marginTop: spacing.xs },
  statUnit:         { ...typography.small, color: 'rgba(255,255,255,0.8)' },
  statLabel:        { ...typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  welcomeCard:      { borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm },
  welcomeGradient:  { padding: spacing.md },
  welcomeContent:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  welcomeTitle:     { ...typography.h4, color: '#fff', marginBottom: 4 },
  welcomeBody:      { ...typography.small, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  nutritionCard:    { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border.light },
  calorieRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  calorieNum:       { ...typography.h3, color: colors.text.primary },
  calorieLabel:     { ...typography.caption, color: colors.text.secondary },
  calorieRemain:    { alignItems: 'flex-end' },
  calorieTrack:     { height: 6, backgroundColor: colors.background.tertiary, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.md },
  calorieFill:      { height: '100%', borderRadius: 3 },
  macroRow:         { flexDirection: 'row', gap: spacing.md },
  macro:            { flex: 1 },
  macroVal:         { ...typography.smallMed },
  macroLabel:       { ...typography.caption, color: colors.text.secondary, marginTop: 1 },
  macroTrack:       { height: 3, backgroundColor: colors.background.tertiary, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  macroFill:        { height: '100%', borderRadius: 2 },
  quickGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickAction:      { width: (width - spacing.md * 2 - spacing.sm * 3) / 4, alignItems: 'center', gap: spacing.xs },
  quickActionIcon:  { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  coachCard:        { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border.light },
  coachCardInner:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  coachAvatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.glass.brand, alignItems: 'center', justifyContent: 'center' },
  coachName:        { ...typography.bodyMed, color: colors.text.primary },
  coachStage:       { ...typography.caption, color: colors.brand.primary, marginTop: 2 },
  coachLastSession: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  bondTrack:        { height: 4, backgroundColor: colors.background.tertiary, borderRadius: 2, overflow: 'hidden' },
  bondFill:         { height: '100%', borderRadius: 2 },
  bondLabel:        { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xs },
});
