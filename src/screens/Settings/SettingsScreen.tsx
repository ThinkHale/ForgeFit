import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Switch, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { healthService } from '../../services/health';
import { authService } from '../../services/supabase';
import { notificationService } from '../../services/notifications';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { UserProfile } from '../../types';

type GoalId = NonNullable<UserProfile['primaryGoal']>;
type LevelId = NonNullable<UserProfile['fitnessLevel']>;

const GOALS: Array<{ id: GoalId; label: string; icon: string }> = [
  { id: 'lose_weight',    label: 'Lose Weight',   icon: '🔥' },
  { id: 'build_muscle',   label: 'Build Muscle',  icon: '💪' },
  { id: 'endurance',      label: 'Endurance',     icon: '🏃' },
  { id: 'general_fitness',label: 'General',       icon: '⚡' },
];

const LEVELS: Array<{ id: LevelId; label: string }> = [
  { id: 'beginner',     label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced',     label: 'Advanced' },
];

const DAYS = [2, 3, 4, 5, 6];

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={[s.sectionCard, shadows.sm]}>{children}</View>
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function Row({ label, children, first, last }: {
  label: string; children: React.ReactNode; first?: boolean; last?: boolean;
}) {
  return (
    <View style={[s.row, !first && s.rowBorder]}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>{children}</View>
    </View>
  );
}

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { profile, saveProfile, healthToday, setHealthToday } = useStore();

  // ── Local state (mirrors profile) ────────────────────────────────────────────
  const [name,     setName]     = useState(profile?.name     ?? '');
  const [goal,     setGoal]     = useState<GoalId | null>(profile?.primaryGoal  ?? null);
  const [level,    setLevel]    = useState<LevelId | null>(profile?.fitnessLevel ?? null);
  const [days,     setDays]     = useState<number | null>(profile?.availableDays ?? null);
  const [calories, setCalories] = useState(String(profile?.dailyCalorieGoal ?? 2000));
  const [protein,  setProtein]  = useState(String(profile?.dailyProteinGoal  ?? 150));
  const [carbs,    setCarbs]    = useState(String(profile?.dailyCarbGoal     ?? 200));
  const [fat,      setFat]      = useState(String(profile?.dailyFatGoal      ?? 65));
  const [saving,   setSaving]   = useState(false);
  const [healthConnected, setHealthConnected] = useState(healthService.isConnected);
  const [notifsEnabled,   setNotifsEnabled]   = useState(false);

  useEffect(() => {
    notificationService.areNotificationsEnabled().then(setNotifsEnabled);
  }, []);

  async function handleSave() {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await saveProfile({
        name:              name.trim() || null,
        primaryGoal:       goal,
        fitnessLevel:      level,
        availableDays:     days,
        dailyCalorieGoal:  parseInt(calories) || 2000,
        dailyProteinGoal:  parseInt(protein)  || 150,
        dailyCarbGoal:     parseInt(carbs)    || 200,
        dailyFatGoal:      parseInt(fat)      || 65,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save settings. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectHealth() {
    const granted = await healthService.initialize();
    setHealthConnected(granted);
    if (granted) {
      const snapshot = await healthService.getTodaySnapshot();
      setHealthToday(snapshot);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleNotifToggle(enabled: boolean) {
    if (enabled) {
      const ok = await notificationService.requestPermissions();
      if (ok) {
        await notificationService.scheduleDefaultReminders();
        setNotifsEnabled(true);
      } else {
        Alert.alert('Permission needed', 'Enable notifications in iOS Settings to receive reminders.');
      }
    } else {
      await notificationService.cancelAll();
      setNotifsEnabled(false);
    }
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveBtn}>
          <Text style={[s.saveBtnText, saving && { opacity: 0.5 }]}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Profile ── */}
        <Section title="PROFILE">
          <Row label="Name" first>
            <TextInput
              style={s.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="words"
            />
          </Row>
          <Row label="Primary Goal">
            <View style={s.chips}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => { setGoal(g.id); Haptics.selectionAsync(); }}
                  style={[s.chip, goal === g.id && s.chipActive]}
                >
                  <Text style={[s.chipText, goal === g.id && s.chipTextActive]}>
                    {g.icon} {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>
          <Row label="Fitness Level">
            <View style={s.chips}>
              {LEVELS.map(l => (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => { setLevel(l.id); Haptics.selectionAsync(); }}
                  style={[s.chip, level === l.id && s.chipActive]}
                >
                  <Text style={[s.chipText, level === l.id && s.chipTextActive]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>
          <Row label="Days / Week" last>
            <View style={s.chips}>
              {DAYS.map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => { setDays(d); Haptics.selectionAsync(); }}
                  style={[s.chip, s.chipSquare, days === d && s.chipActive]}
                >
                  <Text style={[s.chipText, days === d && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>
        </Section>

        {/* ── Nutrition Goals ── */}
        <Section title="DAILY NUTRITION GOALS">
          {[
            { label: 'Calories (kcal)', val: calories, set: setCalories },
            { label: 'Protein (g)',     val: protein,  set: setProtein },
            { label: 'Carbs (g)',       val: carbs,    set: setCarbs },
            { label: 'Fat (g)',         val: fat,      set: setFat },
          ].map((f, i) => (
            <Row key={f.label} label={f.label} first={i === 0}>
              <TextInput
                style={[s.textInput, s.numberInput]}
                value={f.val}
                onChangeText={f.set}
                keyboardType="number-pad"
                selectTextOnFocus
              />
            </Row>
          ))}
        </Section>

        {/* ── Health ── */}
        <Section title="HEALTH & FITNESS">
          <Row label="Apple Health" first last>
            <TouchableOpacity
              onPress={healthConnected ? undefined : handleConnectHealth}
              style={[s.healthBtn, healthConnected && s.healthBtnConnected]}
            >
              <Text style={[s.healthBtnText, healthConnected && s.healthBtnTextConnected]}>
                {healthConnected ? '✓ Connected' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </Row>
        </Section>

        {/* ── Notifications ── */}
        <Section title="NOTIFICATIONS">
          <Row label="Daily Reminders" first last>
            <Switch
              value={notifsEnabled}
              onValueChange={handleNotifToggle}
              trackColor={{ false: colors.background.tertiary, true: colors.brand.primary }}
              thumbColor="#fff"
            />
          </Row>
        </Section>

        {/* ── Account ── */}
        <Section title="ACCOUNT">
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => authService.signOut() },
              ]);
            }}
            style={s.signOutRow}
          >
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </Section>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.background.secondary },
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background.primary, borderBottomWidth: 0.5, borderBottomColor: colors.border.light },
  backBtn:             {},
  backIcon:            { fontSize: 28, color: colors.brand.primary, fontWeight: '300', lineHeight: 32 },
  headerTitle:         { ...typography.h4, color: colors.text.primary },
  saveBtn:             {},
  saveBtnText:         { ...typography.bodyMed, color: colors.brand.primary },
  scroll:              { padding: spacing.md },
  section:             { marginBottom: spacing.lg },
  sectionTitle:        { ...typography.captionMed, color: colors.text.tertiary, letterSpacing: 0.8, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  sectionCard:         { backgroundColor: colors.background.primary, borderRadius: radius.lg, overflow: 'hidden' },
  row:                 { padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  rowBorder:           { borderTopWidth: 0.5, borderTopColor: colors.border.light },
  rowLabel:            { ...typography.body, color: colors.text.primary, flex: 1 },
  rowRight:            { flex: 2, alignItems: 'flex-end' },
  textInput:           { ...typography.body, color: colors.text.primary, textAlign: 'right', minWidth: 80 },
  numberInput:         { minWidth: 60 },
  chips:               { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'flex-end' },
  chip:                { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.background.secondary, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.light },
  chipSquare:          { paddingHorizontal: spacing.sm },
  chipActive:          { backgroundColor: colors.glass.brand, borderColor: colors.brand.primary },
  chipText:            { ...typography.caption, color: colors.text.secondary },
  chipTextActive:      { color: colors.brand.primary, fontWeight: '600' },
  healthBtn:           { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.glass.brand, borderRadius: radius.full, borderWidth: 1, borderColor: colors.brand.primary },
  healthBtnConnected:  { backgroundColor: 'rgba(52,199,89,0.1)', borderColor: colors.success },
  healthBtnText:       { ...typography.smallMed, color: colors.brand.primary },
  healthBtnTextConnected: { color: colors.success },
  signOutRow:          { padding: spacing.md, alignItems: 'center' },
  signOutText:         { ...typography.bodyMed, color: colors.error },
});
