import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, RefreshControl, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Text as SvgText, G } from 'react-native-svg';
import { useStore } from '../../store';
import { healthService } from '../../services/health';
import { supabase } from '../../services/supabase';
import { colors, spacing, radius, typography, shadows } from '../../theme';

const { width } = Dimensions.get('window');

// Apple Health on iOS, Health Connect on Android.
const HEALTH_PROVIDER = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

// ─── Simple bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, color }: { data: Array<{ label: string; value: number }>; color: string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const chartH = 90;
  const barW = 20;
  const gap = 10;
  const totalW = data.length * (barW + gap) - gap;

  return (
    <Svg width={totalW} height={chartH + 18}>
      {data.map((d, i) => {
        const h = Math.max((d.value / maxVal) * chartH, d.value > 0 ? 3 : 0);
        const x = i * (barW + gap);
        const y = chartH - h;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={h} rx={3} fill={color} opacity={0.85} />
            <SvgText x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize={9} fill="rgba(0,0,0,0.35)">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Activity Ring ────────────────────────────────────────────────────────────
function ActivityRing({ progress, size = 44, strokeWidth = 5 }: {
  progress: number; size?: number; strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(Math.max(progress, 0), 1);
  const cx = size / 2;
  const cy = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={strokeWidth} fill="none" />
      {progress > 0 && (
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.9)" strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90, ${cx}, ${cy})`} />
      )}
    </Svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, icon, gradient, progress, onPress }: {
  label: string; value: string | number; unit?: string;
  icon: string; gradient: string[]; progress?: number; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.statCard, shadows.md]} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
      <LinearGradient
        colors={gradient as [string, string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.statCardGradient}
      >
        <View style={styles.statCardHeader}>
          <Text style={styles.statIcon}>{icon}</Text>
          {progress !== undefined && (
            <ActivityRing progress={progress} />
          )}
        </View>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
          {unit && <Text style={styles.statUnit}> {unit}</Text>}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Activity Detail Modal ────────────────────────────────────────────────────
type DetailType = 'steps' | 'calories' | 'heart_rate';

function ActivityDetailModal({ type, healthToday, onClose }: {
  type: DetailType;
  healthToday: any;
  onClose: () => void;
}) {
  const [weeklyData, setWeeklyData] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (type === 'steps') {
          const raw = await healthService.getWeeklySteps();
          setWeeklyData(raw.map(d => ({
            label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' }),
            value: d.value,
          })));
        } else if (type === 'calories') {
          const raw = await healthService.getWeeklyActiveCalories();
          setWeeklyData(raw.map(d => ({
            label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' }),
            value: d.value,
          })));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [type]);

  const config: Record<DetailType, { title: string; icon: string; color: string; gradient: string[] }> = {
    steps:      { title: 'Steps',        icon: '👟', color: '#FF6B35', gradient: ['#FF6B35', '#FF9F1C'] },
    calories:   { title: 'Active Cals',  icon: '🔥', color: '#FF3B30', gradient: ['#FF3B30', '#FF6B35'] },
    heart_rate: { title: 'Heart Rate',   icon: '❤️', color: '#FF2D55', gradient: ['#FF2D55', '#FF6B35'] },
  };
  const c = config[type];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={detail.overlay}>
        <TouchableOpacity style={detail.backdrop} onPress={onClose} />
        <View style={detail.sheet}>
          <View style={detail.handle} />

          {/* Header */}
          <LinearGradient colors={c.gradient as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={detail.header}>
            <Text style={detail.headerIcon}>{c.icon}</Text>
            <Text style={detail.headerTitle}>{c.title}</Text>
          </LinearGradient>

          {type === 'heart_rate' ? (
            <View style={detail.hrSection}>
              <View style={detail.hrRow}>
                <View style={detail.hrStat}>
                  <Text style={[detail.hrVal, { color: c.color }]}>
                    {healthToday?.heartRateAvg || '--'}
                  </Text>
                  <Text style={detail.hrLabel}>Current (bpm)</Text>
                </View>
                <View style={detail.hrDivider} />
                <View style={detail.hrStat}>
                  <Text style={[detail.hrVal, { color: colors.brand.secondary }]}>
                    {healthToday?.heartRateResting || '--'}
                  </Text>
                  <Text style={detail.hrLabel}>Resting (bpm)</Text>
                </View>
              </View>
              <Text style={detail.hrNote}>
                Heart rate data synced from {HEALTH_PROVIDER}. Latest reading from the past 24 hours.
              </Text>
              {(!healthToday?.heartRateAvg && !healthToday?.heartRateResting) && (
                <Text style={detail.hrNote}>
                  {Platform.OS === 'ios'
                    ? 'No heart rate data today. Make sure your Apple Watch is worn and Health permissions are granted.'
                    : `No heart rate data today. Make sure your wearable is syncing and ${HEALTH_PROVIDER} permissions are granted.`}
                </Text>
              )}
            </View>
          ) : (
            <View style={detail.chartSection}>
              <Text style={detail.chartTitle}>Last 7 Days</Text>
              {loading ? (
                <View style={detail.chartPlaceholder}>
                  <Text style={{ color: colors.text.tertiary }}>Loading…</Text>
                </View>
              ) : weeklyData.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                  <BarChart data={weeklyData} color={c.color} />
                </ScrollView>
              ) : (
                <View style={detail.chartPlaceholder}>
                  <Text style={{ color: colors.text.tertiary }}>No data yet. Connect {HEALTH_PROVIDER} to sync.</Text>
                </View>
              )}

              {/* Summary stats */}
              {weeklyData.length > 0 && (
                <View style={detail.summaryRow}>
                  <View style={detail.summaryStat}>
                    <Text style={[detail.summaryVal, { color: c.color }]}>
                      {type === 'steps'
                        ? (healthToday?.steps ?? 0).toLocaleString()
                        : (healthToday?.activeCalories ?? 0)}
                    </Text>
                    <Text style={detail.summaryLabel}>Today</Text>
                  </View>
                  <View style={detail.summaryDivider} />
                  <View style={detail.summaryStat}>
                    <Text style={[detail.summaryVal, { color: c.color }]}>
                      {weeklyData.length > 0
                        ? (type === 'steps'
                          ? Math.round(weeklyData.reduce((s, d) => s + d.value, 0) / weeklyData.length).toLocaleString()
                          : Math.round(weeklyData.reduce((s, d) => s + d.value, 0) / weeklyData.length))
                        : '--'}
                    </Text>
                    <Text style={detail.summaryLabel}>7-Day Avg</Text>
                  </View>
                  <View style={detail.summaryDivider} />
                  <View style={detail.summaryStat}>
                    <Text style={[detail.summaryVal, { color: c.color }]}>
                      {weeklyData.length > 0
                        ? (type === 'steps'
                          ? Math.max(...weeklyData.map(d => d.value)).toLocaleString()
                          : Math.max(...weeklyData.map(d => d.value)))
                        : '--'}
                    </Text>
                    <Text style={detail.summaryLabel}>Best Day</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={detail.closeBtn} activeOpacity={0.8}>
            <Text style={detail.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  const { profile, healthToday, nutritionToday, setHealthToday, user } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [healthConnected, setHealthConnected] = useState(healthService.isConnected);
  const [detailCard, setDetailCard] = useState<DetailType | null>(null);
  const [calorieStreak, setCalorieStreak] = useState(0);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.name?.split(' ')[0] ?? null;

  async function loadHealthData() {
    try {
      const snapshot = await healthService.getTodaySnapshot();
      setHealthToday(snapshot);
      setHealthConnected(healthService.isConnected);
    } catch {}
  }

  async function loadCalorieStreak() {
    if (!user) return;
    try {
      const goal = profile?.dailyCalorieGoal ?? 2000;
      const today = new Date().toISOString().split('T')[0];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const { data } = await supabase
        .from('meal_entries')
        .select('date, food_item, servings')
        .eq('user_id', user.id)
        .lt('date', today)
        .gte('date', cutoff.toISOString().split('T')[0]);

      if (!data?.length) return;

      const byDate: Record<string, number> = {};
      for (const entry of data) {
        const cal = ((entry.food_item as any)?.calories ?? 0) * ((entry.servings as number) ?? 1);
        byDate[entry.date] = (byDate[entry.date] ?? 0) + cal;
      }

      let streak = 0;
      const d = new Date();
      d.setDate(d.getDate() - 1);
      for (let i = 0; i < 30; i++) {
        const ds = d.toISOString().split('T')[0];
        const dayCal = byDate[ds] ?? null;
        if (dayCal === null || dayCal > goal) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
      setCalorieStreak(streak);
    } catch {}
  }

  useEffect(() => {
    loadHealthData();
    loadCalorieStreak();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadHealthData(), loadCalorieStreak()]);
    setRefreshing(false);
  }

  const calorieProgress = nutritionToday
    ? nutritionToday.totalCalories / (nutritionToday.calorieGoal || 2000)
    : 0;
  const stepProgress    = healthToday?.steps ? healthToday.steps / 10000 : 0;
  const caloriesBurned  = healthToday?.activeCalories ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#FFF5F0', '#FFFFFF']} style={styles.heroBg} />

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
            <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Settings')}>
              <LinearGradient colors={colors.gradients.brand as [string, string]} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {firstName ? firstName[0].toUpperCase() : '🔥'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Coach bond teaser */}
          {profile && profile.sessionCount === 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Coach')} activeOpacity={0.85} style={[styles.welcomeCard, shadows.md]}>
              <LinearGradient colors={['#FF6B35', '#FF9F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.welcomeGradient}>
                <View style={styles.welcomeContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.welcomeTitle}>Meet your AI coach ⚡</Text>
                    <Text style={styles.welcomeBody}>Forge learns how you train, what motivates you, and gets smarter every session.</Text>
                  </View>
                  <Text style={{ fontSize: 32 }}>→</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Health connection nudge */}
          {!healthConnected && (
            <TouchableOpacity
              onPress={async () => {
                const granted = await healthService.initialize();
                setHealthConnected(granted);
                if (granted) loadHealthData();
              }}
              activeOpacity={0.85}
              style={[styles.healthNudge, shadows.sm]}
            >
              <Text style={styles.healthNudgeIcon}>❤️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.healthNudgeTitle}>Connect {HEALTH_PROVIDER}</Text>
                <Text style={styles.healthNudgeSub}>Tap to sync steps, heart rate & activity</Text>
              </View>
              <Text style={{ color: colors.brand.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          )}

          {/* Calorie streak badge */}
          {calorieStreak >= 2 && (
            <View style={[styles.streakBadge, shadows.sm]}>
              <Text style={styles.streakFire}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakTitle}>{calorieStreak}-Day Calorie Streak!</Text>
                <Text style={styles.streakSub}>Under your calorie goal {calorieStreak} days in a row</Text>
              </View>
            </View>
          )}

          {/* Activity stats — 3-column, tappable */}
          <Text style={styles.sectionTitle}>Today's Activity</Text>
          <View style={styles.statsRow}>
            <StatCard
              icon="👟" label="Steps"
              value={healthToday?.steps?.toLocaleString() ?? '0'}
              gradient={['#FF6B35', '#FF9F1C']}
              progress={stepProgress}
              onPress={() => setDetailCard('steps')}
            />
            <StatCard
              icon="🔥" label="Active Cal"
              value={caloriesBurned} unit="kcal"
              gradient={['#FF3B30', '#FF6B35']}
              progress={caloriesBurned / 500}
              onPress={() => setDetailCard('calories')}
            />
            <StatCard
              icon="❤️" label="Heart Rate"
              value={healthToday?.heartRateAvg || '--'} unit={healthToday?.heartRateAvg ? 'bpm' : undefined}
              gradient={['#FF2D55', '#FF6B35']}
              onPress={() => setDetailCard('heart_rate')}
            />
          </View>

          {/* Nutrition summary */}
          {nutritionToday && (
            <>
              <Text style={styles.sectionTitle}>Nutrition Today</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Nutrition')}
                activeOpacity={0.85}
                style={[styles.nutritionCard, shadows.sm]}
              >
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

          {/* Coach bond card */}
          {profile && profile.sessionCount > 0 && (
            <>
              <Text style={styles.sectionTitle}>Your Coach</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Coach')} activeOpacity={0.85} style={[styles.coachCard, shadows.sm]}>
                <View style={styles.coachCardInner}>
                  <View style={styles.coachAvatar}>
                    <Text style={{ fontSize: 26 }}>⚡</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coachName}>Forge AI Coach</Text>
                    <Text style={styles.coachStage}>
                      {profile.sessionCount} sessions · {
                        profile.relationshipStage === 'new' ? 'Just met' :
                        profile.relationshipStage === 'building' ? 'Getting to know you' :
                        profile.relationshipStage === 'established' ? 'Well acquainted' : 'Deep bond'
                      }
                    </Text>
                    {profile.lastSessionSummary && (
                      <Text style={styles.coachLastSession} numberOfLines={2}>Last: {profile.lastSessionSummary}</Text>
                    )}
                  </View>
                  <Text style={{ color: colors.brand.primary, fontSize: 20 }}>›</Text>
                </View>
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

      {detailCard && (
        <ActivityDetailModal
          type={detailCard}
          healthToday={healthToday}
          onClose={() => setDetailCard(null)}
        />
      )}
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
  statsRow:         { flexDirection: 'row', gap: spacing.sm },
  statCard:         { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  statCardGradient: { padding: spacing.sm, minHeight: 120 },
  statCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  statIcon:         { fontSize: 20 },
  statValue:        { ...typography.h3, color: '#fff', marginTop: 2, fontSize: 18 },
  statUnit:         { ...typography.caption, color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  statLabel:        { ...typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontSize: 11 },
  healthNudge:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.glass.brand, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border.brand },
  healthNudgeIcon:  { fontSize: 22 },
  healthNudgeTitle: { ...typography.smallMed, color: colors.brand.primary },
  healthNudgeSub:   { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  welcomeCard:      { borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm },
  welcomeGradient:  { padding: spacing.md },
  welcomeContent:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  welcomeTitle:     { ...typography.h4, color: '#fff', marginBottom: 4 },
  welcomeBody:      { ...typography.small, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  streakBadge:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF5F0', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: '#FFD4B8' },
  streakFire:       { fontSize: 28 },
  streakTitle:      { ...typography.smallMed, color: colors.brand.primary },
  streakSub:        { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
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

const detail = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end' },
  backdrop:      { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:         { backgroundColor: colors.background.primary, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingBottom: 40, overflow: 'hidden' },
  handle:        { width: 36, height: 4, backgroundColor: colors.border.medium, borderRadius: 2, alignSelf: 'center', marginTop: spacing.sm, marginBottom: 0 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md },
  headerIcon:    { fontSize: 26 },
  headerTitle:   { ...typography.h3, color: '#fff' },
  chartSection:  { padding: spacing.lg, paddingTop: spacing.sm },
  chartTitle:    { ...typography.captionMed, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.md },
  chartPlaceholder: { height: 108, alignItems: 'center', justifyContent: 'center' },
  summaryRow:    { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.light },
  summaryStat:   { flex: 1, alignItems: 'center' },
  summaryVal:    { ...typography.h3 },
  summaryLabel:  { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border.light },
  hrSection:     { padding: spacing.lg },
  hrRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  hrStat:        { flex: 1, alignItems: 'center' },
  hrVal:         { ...typography.h1 },
  hrLabel:       { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  hrDivider:     { width: 1, height: 48, backgroundColor: colors.border.light },
  hrNote:        { ...typography.small, color: colors.text.tertiary, lineHeight: 20, marginBottom: spacing.xs },
  closeBtn:      { marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.background.secondary, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  closeBtnText:  { ...typography.bodyMed, color: colors.text.primary },
});
