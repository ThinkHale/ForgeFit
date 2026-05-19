import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { healthService } from '../../services/health';
import { colors, spacing, radius, typography, shadows } from '../../theme';

const { width } = Dimensions.get('window');
const BAR_WIDTH = (width - spacing.md * 2 - spacing.lg * 2 - spacing.sm * 6) / 7;

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const GOAL_LABELS: Record<string, string> = {
  lose_weight:     'Lose Weight',
  build_muscle:    'Build Muscle',
  endurance:       'Endurance',
  general_fitness: 'General Fitness',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

function MetricTile({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit?: string; icon: string; color: string;
}) {
  return (
    <View style={[s.metricTile, shadows.sm]}>
      <Text style={s.metricIcon}>{icon}</Text>
      <Text style={[s.metricValue, { color }]}>
        {value}{unit ? <Text style={s.metricUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { profile, healthToday } = useStore();
  const [weeklySteps, setWeeklySteps] = useState<Array<{ date: string; value: number }>>([]);

  useEffect(() => {
    healthService.getWeeklySteps().then(setWeeklySteps).catch(() => {});
  }, []);

  const bondPct = Math.min(100, ((profile?.sessionCount ?? 0) / 10) * 100);
  const maxSteps = Math.max(...weeklySteps.map(d => d.value), 1);

  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return DAYS_SHORT[d.getDay()];
  });

  const stepTotal = weeklySteps.reduce((s, d) => s + d.value, 0);
  const avgSteps = weeklySteps.length ? Math.round(stepTotal / weeklySteps.length) : 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.title}>Progress</Text>

        {/* Weekly steps chart */}
        <View style={[s.card, shadows.sm]}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Weekly Steps</Text>
            <Text style={s.cardMeta}>{avgSteps.toLocaleString()} avg/day</Text>
          </View>
          <View style={s.barChart}>
            {weekDays.map((day, i) => {
              const val = weeklySteps[i]?.value ?? 0;
              const pct = val / maxSteps;
              const isToday = i === 6;
              return (
                <View key={day} style={s.barCol}>
                  <View style={s.barTrack}>
                    {val > 0 ? (
                      <LinearGradient
                        colors={isToday ? colors.gradients.brand as [string, string] : ['#E5E5EA', '#D1D1D6']}
                        style={[s.bar, { height: `${Math.max(pct * 100, 4)}%` as unknown as number }]}
                      />
                    ) : (
                      <View style={[s.bar, s.barEmpty, { height: '4%' as unknown as any }]} />
                    )}
                  </View>
                  <Text style={[s.barLabel, isToday && { color: colors.brand.primary, fontWeight: '700' }]}>{day}</Text>
                </View>
              );
            })}
          </View>
          <View style={s.stepGoalRow}>
            <View style={s.stepGoalBar}>
              <View style={[
                s.stepGoalFill,
                { width: `${Math.min(100, ((healthToday?.steps ?? 0) / 10000) * 100)}%` as unknown as number }
              ]} />
            </View>
            <Text style={s.stepGoalLabel}>{(healthToday?.steps ?? 0).toLocaleString()} / 10,000 steps today</Text>
          </View>
        </View>

        {/* Today's metrics */}
        <Text style={s.sectionTitle}>TODAY'S METRICS</Text>
        <View style={s.metricsGrid}>
          <MetricTile
            icon="🔥" label="Active Cal" unit="kcal"
            value={healthToday?.activeCalories ?? '--'}
            color={colors.brand.primary}
          />
          <MetricTile
            icon="❤️" label="Heart Rate" unit="bpm"
            value={healthToday?.heartRateAvg ?? '--'}
            color="#FF2D55"
          />
          <MetricTile
            icon="😴" label="Sleep" unit="hrs"
            value={healthToday?.sleepHours ? healthToday.sleepHours.toFixed(1) : '--'}
            color={colors.brand.electric}
          />
          <MetricTile
            icon="💓" label="Resting HR" unit="bpm"
            value={healthToday?.heartRateResting ?? '--'}
            color={colors.brand.accent}
          />
        </View>

        {/* Goal + level */}
        <Text style={s.sectionTitle}>YOUR GOAL</Text>
        <View style={[s.goalCard, shadows.sm]}>
          <LinearGradient
            colors={colors.gradients.brandSoft as [string, string]}
            style={s.goalGradient}
          >
            <View style={s.goalRow}>
              <View style={s.goalBadge}>
                <Text style={s.goalBadgeText}>{GOAL_LABELS[profile?.primaryGoal ?? 'general_fitness'] ?? 'General Fitness'}</Text>
              </View>
              <View style={s.goalBadge}>
                <Text style={s.goalBadgeText}>{LEVEL_LABELS[profile?.fitnessLevel ?? 'beginner'] ?? 'Beginner'}</Text>
              </View>
              {profile?.availableDays && (
                <View style={s.goalBadge}>
                  <Text style={s.goalBadgeText}>{profile.availableDays}x / week</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Coach bond */}
        <Text style={s.sectionTitle}>COACH RELATIONSHIP</Text>
        <View style={[s.bondCard, shadows.sm]}>
          <View style={s.bondTop}>
            <LinearGradient colors={colors.gradients.brand as [string, string]} style={s.bondAvatar}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.bondTitle}>Forge AI Coach</Text>
              <Text style={s.bondSub}>{profile?.sessionCount ?? 0} sessions together</Text>
            </View>
            <Text style={[s.bondPct, { color: colors.brand.primary }]}>{Math.round(bondPct)}%</Text>
          </View>
          <View style={s.bondTrack}>
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.bondFill, { width: `${bondPct}%` as unknown as number }]}
            />
          </View>
          <Text style={s.bondHint}>
            {bondPct < 100
              ? `${Math.ceil((10 - (profile?.sessionCount ?? 0)))} more sessions to reach deep bond`
              : 'Maximum coaching bond reached'}
          </Text>
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background.secondary },
  scroll:      { padding: spacing.md },
  title:       { ...typography.h1, color: colors.text.primary, marginTop: spacing.sm, marginBottom: spacing.md },
  sectionTitle:{ ...typography.captionMed, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },

  card:        { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  cardTitle:   { ...typography.h4, color: colors.text.primary },
  cardMeta:    { ...typography.caption, color: colors.text.secondary },

  barChart:    { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: 100, marginBottom: spacing.sm },
  barCol:      { flex: 1, alignItems: 'center', gap: 4 },
  barTrack:    { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar:         { width: '100%', borderRadius: 4 },
  barEmpty:    { backgroundColor: colors.background.tertiary },
  barLabel:    { ...typography.label, color: colors.text.tertiary },

  stepGoalRow: { marginTop: spacing.sm, gap: 4 },
  stepGoalBar: { height: 4, backgroundColor: colors.background.tertiary, borderRadius: 2, overflow: 'hidden' },
  stepGoalFill:{ height: '100%', backgroundColor: colors.brand.primary, borderRadius: 2 },
  stepGoalLabel:{ ...typography.caption, color: colors.text.secondary },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricTile:  { width: '47%', backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'flex-start' },
  metricIcon:  { fontSize: 24, marginBottom: spacing.xs },
  metricValue: { ...typography.h2 },
  metricUnit:  { ...typography.small, color: colors.text.secondary },
  metricLabel: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },

  goalCard:    { borderRadius: radius.lg, overflow: 'hidden' },
  goalGradient:{ padding: spacing.md },
  goalRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  goalBadge:   { backgroundColor: colors.background.primary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border.brand },
  goalBadgeText:{ ...typography.smallMed, color: colors.brand.primary },

  bondCard:    { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md },
  bondTop:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  bondAvatar:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bondTitle:   { ...typography.bodyMed, color: colors.text.primary },
  bondSub:     { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  bondPct:     { ...typography.h3 },
  bondTrack:   { height: 6, backgroundColor: colors.background.tertiary, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.xs },
  bondFill:    { height: '100%', borderRadius: 3 },
  bondHint:    { ...typography.caption, color: colors.text.tertiary },
});
