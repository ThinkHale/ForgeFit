import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  TextInput, ScrollView, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { healthService } from '../../services/health';
import { watchService } from '../../services/watch';
import { colors, spacing, radius, typography, shadows } from '../../theme';

const { width } = Dimensions.get('window');

// ─── Step definitions ─────────────────────────────────────────────────────────
const GOALS = [
  { id: 'lose_weight',    icon: '🔥', label: 'Lose weight',     sub: 'Burn fat, get lean' },
  { id: 'build_muscle',   icon: '💪', label: 'Build muscle',    sub: 'Get stronger & bigger' },
  { id: 'endurance',      icon: '🏃', label: 'Improve endurance', sub: 'Run further, last longer' },
  { id: 'general_fitness',icon: '⚡', label: 'General fitness', sub: 'Feel great & stay active' },
];

const FITNESS_LEVELS = [
  { id: 'beginner',     icon: '🌱', label: 'New to fitness',    sub: 'Just getting started' },
  { id: 'intermediate', icon: '🌿', label: 'Some experience',   sub: '1-2 years working out' },
  { id: 'advanced',     icon: '🌳', label: 'Very experienced',  sub: '3+ years, serious training' },
];

const DAYS = [2, 3, 4, 5, 6];

// ─── Pill select button ───────────────────────────────────────────────────────
function OptionCard({ icon, label, sub, selected, onPress }: {
  icon: string; label: string; sub: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[
      styles.optionCard,
      selected && styles.optionCardSelected,
      selected ? shadows.brand : shadows.sm,
    ]}>
      {selected && (
        <LinearGradient
          colors={['rgba(255,107,53,0.06)', 'rgba(255,159,28,0.06)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={styles.optionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <View style={[styles.optionCheck, selected && styles.optionCheckSelected]}>
        {selected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.step, i <= current && styles.stepActive]}>
          {i <= current && (
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          )}
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const { saveProfile, profile } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [healthPermission, setHealthPermission] = useState<boolean | null>(null);

  const STEPS = 4;

  async function requestHealthKit() {
    const granted = await healthService.initialize();
    setHealthPermission(granted);
    await Haptics.notificationAsync(
      granted ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
  }

  async function finish() {
    await saveProfile({
      name: name.trim() || null,
      primaryGoal: goal as any,
      fitnessLevel: level as any,
      availableDays: days,
    });
    // Initialize watch
    await watchService.initialize();
    navigation.replace('Main');
  }

  function next() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS - 1) setStep(s => s + 1);
    else finish();
  }

  const canProgress = [
    name.trim().length > 0,
    goal !== null,
    level !== null,
    days !== null,
  ][step];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#FFF5F0', '#FFFFFF', '#F0F8FF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />

      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <LinearGradient colors={colors.gradients.brand as [string, string]} style={styles.logoIcon}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
          </LinearGradient>
          <Text style={styles.logoText}>Forge</Text>
        </View>

        <Steps total={STEPS} current={step} />

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Step 0: Name */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What should{'\n'}Forge call you?</Text>
              <Text style={styles.stepSub}>Your coach will use this to personalize everything.</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Your first name"
                placeholderTextColor={colors.text.tertiary}
                value={name}
                onChangeText={setName}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => name.trim() && next()}
              />
            </View>
          )}

          {/* Step 1: Goal */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>What's your{'\n'}main goal?</Text>
              <Text style={styles.stepSub}>This shapes your workouts, meals, and coaching style.</Text>
              <View style={styles.options}>
                {GOALS.map(g => (
                  <OptionCard key={g.id} {...g} selected={goal === g.id} onPress={() => setGoal(g.id)} />
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Level */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Your current{'\n'}fitness level?</Text>
              <Text style={styles.stepSub}>Be honest -- Forge adapts to where you actually are.</Text>
              <View style={styles.options}>
                {FITNESS_LEVELS.map(l => (
                  <OptionCard key={l.id} {...l} selected={level === l.id} onPress={() => setLevel(l.id)} />
                ))}
              </View>
            </View>
          )}

          {/* Step 3: Days + Health permission */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Days per week{'\n'}you can train?</Text>
              <Text style={styles.stepSub}>Pick what's realistic -- consistency beats perfection.</Text>
              <View style={styles.daysRow}>
                {DAYS.map(d => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => { setDays(d); Haptics.selectionAsync(); }}
                    style={[styles.dayChip, days === d && styles.dayChipSelected]}
                    activeOpacity={0.8}
                  >
                    {days === d && (
                      <LinearGradient
                        colors={colors.gradients.brand as [string, string]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[styles.dayNum, days === d && styles.dayNumSelected]}>{d}</Text>
                    <Text style={[styles.dayLabel, days === d && styles.dayLabelSelected]}>days</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Apple Health connect */}
              <View style={[styles.healthCard, shadows.sm]}>
                <View style={styles.healthHeader}>
                  <Text style={{ fontSize: 28 }}>❤️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.healthTitle}>Connect Apple Health</Text>
                    <Text style={styles.healthSub}>Sync steps, heart rate, sleep, and workouts. Forge gets smarter with your real data.</Text>
                  </View>
                </View>
                {healthPermission === null ? (
                  <TouchableOpacity onPress={requestHealthKit} style={styles.healthBtn} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#FF2D55', '#FF6B35']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.healthBtnGradient}
                    >
                      <Text style={styles.healthBtnText}>Connect Apple Health</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : healthPermission ? (
                  <View style={styles.healthConnected}>
                    <Text style={{ color: colors.success, fontSize: 16 }}>✓</Text>
                    <Text style={styles.healthConnectedText}>Connected</Text>
                  </View>
                ) : (
                  <Text style={styles.healthSkipped}>You can connect later in Settings.</Text>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            onPress={next}
            disabled={!canProgress}
            activeOpacity={0.85}
            style={{ opacity: canProgress ? 1 : 0.4 }}
          >
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.ctaBtn, shadows.brand]}
            >
              <Text style={styles.ctaBtnText}>
                {step === STEPS - 1 ? `Let's go, ${name || 'you'} →` : 'Continue →'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  inner:       { flex: 1, paddingHorizontal: spacing.lg },
  logoRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.lg },
  logoIcon:    { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText:    { ...typography.h2, color: colors.text.primary },
  stepRow:     { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xl },
  step:        { flex: 1, height: 4, backgroundColor: colors.background.tertiary, borderRadius: 2, overflow: 'hidden' },
  stepActive:  { backgroundColor: colors.brand.primary },
  stepContent: { paddingTop: spacing.sm },
  stepTitle:   { ...typography.display, fontSize: 38, color: colors.text.primary, marginBottom: spacing.sm },
  stepSub:     { ...typography.body, color: colors.text.secondary, marginBottom: spacing.xl, lineHeight: 24 },
  nameInput:   { backgroundColor: colors.background.secondary, borderRadius: radius.xl, padding: spacing.lg, ...typography.h3, color: colors.text.primary, borderWidth: 1.5, borderColor: 'transparent' },
  options:     { gap: spacing.sm },
  optionCard:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: colors.border.light, overflow: 'hidden' },
  optionCardSelected: { borderColor: colors.brand.primary },
  optionIcon:  { fontSize: 28 },
  optionLabel: { ...typography.bodyMed, color: colors.text.primary },
  optionLabelSelected: { color: colors.brand.primary },
  optionSub:   { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  optionCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border.medium, alignItems: 'center', justifyContent: 'center' },
  optionCheckSelected: { borderColor: colors.brand.primary, backgroundColor: colors.brand.primary },
  daysRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  dayChip:     { flex: 1, aspectRatio: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border.light, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.primary, overflow: 'hidden' },
  dayChipSelected: { borderColor: 'transparent' },
  dayNum:      { ...typography.h2, color: colors.text.primary },
  dayNumSelected: { color: '#fff' },
  dayLabel:    { ...typography.caption, color: colors.text.secondary },
  dayLabelSelected: { color: 'rgba(255,255,255,0.8)' },
  healthCard:  { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border.light },
  healthHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  healthTitle: { ...typography.h4, color: colors.text.primary, marginBottom: 4 },
  healthSub:   { ...typography.small, color: colors.text.secondary, lineHeight: 20 },
  healthBtn:   { borderRadius: radius.lg, overflow: 'hidden' },
  healthBtnGradient: { padding: spacing.md, alignItems: 'center' },
  healthBtnText: { ...typography.bodyMed, color: '#fff' },
  healthConnected: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, justifyContent: 'center' },
  healthConnectedText: { ...typography.bodyMed, color: colors.success },
  healthSkipped: { ...typography.small, color: colors.text.tertiary, textAlign: 'center', padding: spacing.sm },
  cta:         { paddingVertical: spacing.lg, gap: spacing.sm },
  ctaBtn:      { borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' },
  ctaBtnText:  { ...typography.h4, color: '#fff' },
  backBtn:     { alignItems: 'center', padding: spacing.sm },
  backBtnText: { ...typography.bodyMed, color: colors.text.secondary },
});
