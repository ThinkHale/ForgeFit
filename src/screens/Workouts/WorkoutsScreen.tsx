import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { healthService } from '../../services/health';
import { colors, spacing, radius, typography, shadows } from '../../theme';

const WORKOUT_TYPES = [
  { id: 'strength',    icon: '🏋️', label: 'Strength',    prompt: 'Build me a strength training workout for today based on my goal and fitness level.' },
  { id: 'cardio',      icon: '🏃', label: 'Cardio',      prompt: 'Give me a cardio session for today. Keep it practical and time-efficient.' },
  { id: 'hiit',        icon: '⚡', label: 'HIIT',        prompt: 'Design a HIIT workout I can do today. Include work/rest intervals.' },
  { id: 'flexibility', icon: '🧘', label: 'Flexibility', prompt: 'Give me a stretching and mobility routine for today.' },
];

const GOAL_FOCUS: Record<string, { label: string; icon: string; tip: string }> = {
  lose_weight:      { label: 'Fat Loss Focus',    icon: '🔥', tip: 'Prioritize compound lifts + cardio finishers to maximize calorie burn.' },
  build_muscle:     { label: 'Muscle Building',   icon: '💪', tip: 'Progressive overload is your friend. Aim for 3–4 sets per exercise at 8–12 reps.' },
  endurance:        { label: 'Endurance Training',icon: '🏃', tip: 'Zone 2 cardio builds your aerobic base. Keep your heart rate conversational.' },
  general_fitness:  { label: 'General Fitness',   icon: '⚡', tip: 'Mix strength and cardio throughout the week for balanced fitness.' },
};

function LogWorkoutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [logging, setLogging] = useState(false);

  async function handleLog() {
    if (!name.trim()) { Alert.alert('Missing info', 'Enter a workout name.'); return; }
    const mins = parseInt(duration) || 30;
    setLogging(true);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - mins * 60 * 1000);
      // ~8 cal/min is a reasonable average across strength and cardio
      await healthService.logWorkout({
        type: name,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        calories: Math.round(mins * 8),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Logged!', `${name} saved to Apple Health.`);
      setName(''); setDuration('');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not log workout. Make sure Apple Health is connected.');
    } finally {
      setLogging(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <TouchableOpacity style={modal.backdrop} onPress={onClose} />
        <View style={modal.sheet}>
          <View style={modal.handle} />
          <Text style={modal.title}>Log Workout</Text>

          <Text style={modal.label}>Workout name</Text>
          <TextInput
            style={modal.input}
            placeholder="e.g. Upper Body, Run, Yoga..."
            placeholderTextColor={colors.text.tertiary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={modal.label}>Duration (minutes)</Text>
          <TextInput
            style={modal.input}
            placeholder="30"
            placeholderTextColor={colors.text.tertiary}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />

          <TouchableOpacity onPress={handleLog} disabled={logging} activeOpacity={0.85} style={modal.btn}>
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={modal.btnGradient}
            >
              <Text style={modal.btnText}>{logging ? 'Saving…' : 'Save to Health'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={modal.cancel}>
            <Text style={modal.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function WorkoutsScreen({ navigation }: { navigation: any }) {
  const { profile, activeWorkout } = useStore();
  const [showLog, setShowLog] = useState(false);

  const focus = GOAL_FOCUS[profile?.primaryGoal ?? 'general_fitness'] ?? GOAL_FOCUS.general_fitness;
  const level = profile?.fitnessLevel ?? 'beginner';
  const days = profile?.availableDays ?? 3;

  function goToCoach(prompt: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Coach', { initialMessage: prompt });
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.title}>Workouts</Text>

        {/* Active workout banner */}
        {activeWorkout && (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('WorkoutActive'); }}
            activeOpacity={0.88}
            style={[s.activeCard, shadows.brand]}
          >
            <LinearGradient
              colors={['#1C1C1E', '#2C2C2E'] as [string, string]}
              style={s.activeGradient}
            >
              <View style={s.activeRow}>
                <View style={s.activePulse} />
                <View style={{ flex: 1 }}>
                  <Text style={s.activeEyebrow}>IN PROGRESS</Text>
                  <Text style={s.activeName}>{activeWorkout.name}</Text>
                  <Text style={s.activeSub}>
                    {activeWorkout.exercises.length} exercises · tap to resume
                  </Text>
                </View>
                <Text style={s.activeArrow}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Today's focus card */}
        <TouchableOpacity
          onPress={() => goToCoach(`${focus.label}: ${focus.tip} Build me today's workout.`)}
          activeOpacity={0.88}
          style={[s.focusCard, shadows.brand]}
        >
          <LinearGradient
            colors={colors.gradients.brand as [string, string]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.focusGradient}
          >
            <View style={s.focusRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.focusEyebrow}>TODAY'S FOCUS</Text>
                <Text style={s.focusTitle}>{focus.icon} {focus.label}</Text>
                <Text style={s.focusTip}>{focus.tip}</Text>
              </View>
              <View style={s.focusCta}>
                <Text style={s.focusCtaText}>Get{'\n'}Workout</Text>
                <Text style={{ color: '#fff', fontSize: 20 }}>→</Text>
              </View>
            </View>
            <View style={s.focusMeta}>
              <Text style={s.focusMetaText}>{level.charAt(0).toUpperCase() + level.slice(1)} · {days} days/week</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Workout types */}
        <Text style={s.sectionTitle}>WORKOUT TYPES</Text>
        <View style={s.grid}>
          {WORKOUT_TYPES.map(w => (
            <TouchableOpacity
              key={w.id}
              onPress={() => goToCoach(w.prompt)}
              activeOpacity={0.8}
              style={[s.typeCard, shadows.sm]}
            >
              <Text style={s.typeIcon}>{w.icon}</Text>
              <Text style={s.typeLabel}>{w.label}</Text>
              <Text style={s.typeHint}>Ask Coach →</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Log workout */}
        <Text style={s.sectionTitle}>QUICK LOG</Text>
        <TouchableOpacity
          onPress={() => setShowLog(true)}
          activeOpacity={0.85}
          style={[s.logCard, shadows.sm]}
        >
          <View style={s.logIcon}>
            <Text style={{ fontSize: 26 }}>📝</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.logTitle}>Log a Workout</Text>
            <Text style={s.logSub}>Save to Apple Health to track your history.</Text>
          </View>
          <Text style={{ color: colors.brand.primary, fontSize: 20 }}>+</Text>
        </TouchableOpacity>

        {/* Coaching tip */}
        <View style={[s.tipCard, shadows.sm]}>
          <Text style={s.tipLabel}>COACH TIP</Text>
          <Text style={s.tipText}>
            Talk to your AI coach to get workouts personalized to your equipment, schedule, and recovery. The more sessions you have, the smarter the recommendations get.
          </Text>
          <TouchableOpacity
            onPress={() => goToCoach('What workout should I do today?')}
            style={s.tipBtn}
          >
            <Text style={s.tipBtnText}>Ask Forge →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <LogWorkoutModal visible={showLog} onClose={() => setShowLog(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background.secondary },
  scroll:       { padding: spacing.md },
  title:        { ...typography.h1, color: colors.text.primary, marginTop: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { ...typography.captionMed, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },

  activeCard:     { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
  activeGradient: { padding: spacing.md },
  activeRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  activePulse:    { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  activeEyebrow:  { ...typography.label, color: colors.success, letterSpacing: 1, marginBottom: 2 },
  activeName:     { ...typography.h4, color: '#fff' },
  activeSub:      { ...typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  activeArrow:    { fontSize: 22, color: '#fff' },

  focusCard:     { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.sm },
  focusGradient: { padding: spacing.lg },
  focusRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  focusEyebrow:  { ...typography.label, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 4 },
  focusTitle:    { ...typography.h3, color: '#fff', marginBottom: spacing.sm },
  focusTip:      { ...typography.small, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  focusCta:      { alignItems: 'center', gap: 4 },
  focusCtaText:  { ...typography.captionMed, color: '#fff', textAlign: 'center' },
  focusMeta:     { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: spacing.sm },
  focusMetaText: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard:  { width: '47%', backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md },
  typeIcon:  { fontSize: 32, marginBottom: spacing.sm },
  typeLabel: { ...typography.h4, color: colors.text.primary, marginBottom: 4 },
  typeHint:  { ...typography.caption, color: colors.brand.primary },

  logCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md },
  logIcon:   { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.glass.brand, alignItems: 'center', justifyContent: 'center' },
  logTitle:  { ...typography.bodyMed, color: colors.text.primary },
  logSub:    { ...typography.caption, color: colors.text.secondary, marginTop: 2 },

  tipCard:   { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
  tipLabel:  { ...typography.captionMed, color: colors.text.tertiary, letterSpacing: 0.8, marginBottom: spacing.sm },
  tipText:   { ...typography.small, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.md },
  tipBtn:    { alignSelf: 'flex-start' },
  tipBtnText: { ...typography.smallMed, color: colors.brand.primary },
});

const modal = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:      { backgroundColor: colors.background.primary, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, paddingBottom: 40 },
  handle:     { width: 36, height: 4, backgroundColor: colors.border.medium, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title:      { ...typography.h3, color: colors.text.primary, marginBottom: spacing.md },
  label:      { ...typography.smallMed, color: colors.text.secondary, marginBottom: spacing.xs },
  input:      { backgroundColor: colors.background.secondary, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text.primary, marginBottom: spacing.md },
  btn:        { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.sm },
  btnGradient:{ padding: spacing.md, alignItems: 'center' },
  btnText:    { ...typography.h4, color: '#fff' },
  cancel:     { padding: spacing.md, alignItems: 'center' },
  cancelText: { ...typography.bodyMed, color: colors.text.secondary },
});
