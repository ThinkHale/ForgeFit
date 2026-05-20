import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { ActiveWorkoutExercise } from '../../types';

// ─── Rest Timer ───────────────────────────────────────────────────────────────
function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 0, duration: seconds * 1000, useNativeDriver: false }).start();
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(interval); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDone(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={rt.container}>
      <Text style={rt.label}>REST</Text>
      <Text style={rt.timer}>{remaining}s</Text>
      <View style={rt.track}>
        <Animated.View style={[rt.fill, {
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as unknown as number,
        }]} />
      </View>
      <TouchableOpacity onPress={onDone} style={rt.skipBtn}>
        <Text style={rt.skipText}>Skip Rest →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Set Row ──────────────────────────────────────────────────────────────────
function SetRow({ set, setIdx, repsTarget, onComplete }: {
  set: { reps?: number; weight?: number; completed: boolean };
  setIdx: number;
  repsTarget: string;
  onComplete: (reps?: number, weight?: number) => void;
}) {
  const [reps, setReps] = useState(String(set.reps ?? ''));
  const [weight, setWeight] = useState(String(set.weight ?? ''));

  return (
    <View style={[sr.row, set.completed && sr.rowDone]}>
      <Text style={sr.setNum}>{setIdx + 1}</Text>
      <Text style={sr.target}>{repsTarget}</Text>
      <TextInput
        style={sr.input}
        value={weight}
        onChangeText={setWeight}
        placeholder="lbs"
        placeholderTextColor={colors.text.tertiary}
        keyboardType="decimal-pad"
        editable={!set.completed}
      />
      <TextInput
        style={sr.input}
        value={reps}
        onChangeText={setReps}
        placeholder={repsTarget}
        placeholderTextColor={colors.text.tertiary}
        keyboardType="number-pad"
        editable={!set.completed}
      />
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onComplete(reps ? parseInt(reps) : undefined, weight ? parseFloat(weight) : undefined);
        }}
        disabled={set.completed}
        style={[sr.checkBtn, set.completed && sr.checkBtnDone]}
      >
        <Text style={[sr.checkIcon, set.completed && { color: '#fff' }]}>
          {set.completed ? '✓' : '○'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────
function ExerciseCard({
  exercise, exerciseIdx, isActive, onSetComplete,
}: {
  exercise: ActiveWorkoutExercise;
  exerciseIdx: number;
  isActive: boolean;
  onSetComplete: (exerciseIdx: number, setIdx: number, result: { reps?: number; weight?: number }) => void;
}) {
  const allDone = exercise.setResults.every(s => s.completed);

  return (
    <View style={[ec.card, shadows.sm, isActive && ec.cardActive]}>
      <View style={ec.header}>
        <View style={{ flex: 1 }}>
          <Text style={ec.name}>{exercise.name}</Text>
          {exercise.notes && <Text style={ec.notes}>{exercise.notes}</Text>}
        </View>
        <View style={ec.badge}>
          <Text style={ec.badgeText}>{exercise.sets} × {exercise.reps}</Text>
        </View>
        {allDone && (
          <LinearGradient colors={colors.gradients.success as [string, string]} style={ec.donePill}>
            <Text style={ec.donePillText}>Done ✓</Text>
          </LinearGradient>
        )}
      </View>

      {/* Set table header */}
      <View style={ec.tableHeader}>
        <Text style={[ec.col, { flex: 0.4 }]}>SET</Text>
        <Text style={[ec.col, { flex: 1 }]}>TARGET</Text>
        <Text style={ec.col}>WEIGHT</Text>
        <Text style={ec.col}>REPS</Text>
        <Text style={[ec.col, { flex: 0.5 }]}></Text>
      </View>

      {exercise.setResults.map((set, si) => (
        <SetRow
          key={si}
          set={set}
          setIdx={si}
          repsTarget={exercise.reps}
          onComplete={(reps, weight) => onSetComplete(exerciseIdx, si, { reps, weight })}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WorkoutActiveScreen({ navigation }: { navigation: any }) {
  const { activeWorkout, updateSetResult, finishWorkout, cancelWorkout } = useStore();
  const [restTimer, setRestTimer] = useState<{ exerciseIdx: number; restSeconds: number } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!activeWorkout) {
    navigation.goBack();
    return null;
  }

  const totalSets   = activeWorkout.exercises.reduce((s, e) => s + e.sets, 0);
  const doneSets    = activeWorkout.exercises.reduce((s, e) => s + e.setResults.filter(r => r.completed).length, 0);
  const progressPct = totalSets > 0 ? doneSets / totalSets : 0;
  const elapsed     = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

  function handleSetComplete(exerciseIdx: number, setIdx: number, result: { reps?: number; weight?: number }) {
    updateSetResult(exerciseIdx, setIdx, result);
    const ex = activeWorkout!.exercises[exerciseIdx];
    const nextSetIdx = setIdx + 1;
    const allSetsInExDone = nextSetIdx >= ex.sets;
    // Show rest timer unless this was the last set of the last exercise
    const isLastExercise = exerciseIdx === activeWorkout!.exercises.length - 1;
    if (!allSetsInExDone || !isLastExercise) {
      setRestTimer({ exerciseIdx, restSeconds: ex.restSeconds });
    }
  }

  async function handleFinish() {
    Alert.alert(
      'Finish Workout?',
      `${doneSets}/${totalSets} sets completed · ${elapsed}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish & Log',
          onPress: async () => {
            await finishWorkout();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.goBack();
          },
        },
      ]
    );
  }

  function handleCancel() {
    Alert.alert('Cancel Workout?', 'Progress will not be saved.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Cancel Workout', style: 'destructive', onPress: () => { cancelWorkout(); navigation.goBack(); } },
    ]);
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.workoutName} numberOfLines={1}>{activeWorkout.name}</Text>
          <Text style={s.elapsed}>{elapsed}</Text>
        </View>
        <TouchableOpacity onPress={handleFinish} style={s.finishBtn}>
          <LinearGradient colors={colors.gradients.brand as [string, string]} style={s.finishBtnGrad}>
            <Text style={s.finishBtnText}>Finish</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <LinearGradient
          colors={colors.gradients.brand as [string, string]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[s.progressFill, { width: `${progressPct * 100}%` as unknown as number }]}
        />
      </View>
      <Text style={s.progressLabel}>{doneSets} / {totalSets} sets</Text>

      {/* Rest timer overlay */}
      {restTimer && (
        <View style={s.restOverlay}>
          <RestTimer
            seconds={restTimer.restSeconds}
            onDone={() => setRestTimer(null)}
          />
        </View>
      )}

      {/* Exercise list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {activeWorkout.exercises.map((ex, i) => (
          <ExerciseCard
            key={i}
            exercise={ex}
            exerciseIdx={i}
            isActive={ex.setResults.some(s => !s.completed) && activeWorkout.exercises.slice(0, i).every(e => e.setResults.every(s => s.completed))}
            onSetComplete={handleSetComplete}
          />
        ))}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background.secondary },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background.primary, borderBottomWidth: 0.5, borderBottomColor: colors.border.light },
  cancelText:   { ...typography.body, color: colors.text.secondary },
  headerCenter: { flex: 1, alignItems: 'center' },
  workoutName:  { ...typography.h4, color: colors.text.primary },
  elapsed:      { ...typography.caption, color: colors.text.secondary, marginTop: 1 },
  finishBtn:    { borderRadius: radius.full, overflow: 'hidden' },
  finishBtnGrad:{ paddingHorizontal: spacing.md, paddingVertical: 6 },
  finishBtnText:{ ...typography.smallMed, color: '#fff' },
  progressTrack:{ height: 3, backgroundColor: colors.background.tertiary },
  progressFill: { height: '100%' },
  progressLabel:{ ...typography.caption, color: colors.text.tertiary, textAlign: 'center', paddingVertical: 4 },
  scroll:       { padding: spacing.md, gap: spacing.sm },
  restOverlay:  { position: 'absolute', left: spacing.md, right: spacing.md, top: 80, zIndex: 10, ...shadows.lg },
});

const rt = StyleSheet.create({
  container: { backgroundColor: colors.background.primary, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', ...shadows.lg },
  label:     { ...typography.captionMed, color: colors.text.tertiary, letterSpacing: 1, marginBottom: spacing.xs },
  timer:     { ...typography.display, color: colors.brand.primary, marginBottom: spacing.md },
  track:     { width: '100%', height: 6, backgroundColor: colors.background.tertiary, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.md },
  fill:      { height: '100%', backgroundColor: colors.brand.primary, borderRadius: 3 },
  skipBtn:   { padding: spacing.sm },
  skipText:  { ...typography.smallMed, color: colors.brand.primary },
});

const ec = StyleSheet.create({
  card:        { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive:  { borderColor: colors.brand.primary },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  name:        { ...typography.h4, color: colors.text.primary },
  notes:       { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  badge:       { backgroundColor: colors.glass.brand, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText:   { ...typography.caption, color: colors.brand.primary, fontWeight: '600' },
  donePill:    { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  donePillText:{ ...typography.caption, color: '#fff', fontWeight: '600' },
  tableHeader: { flexDirection: 'row', marginBottom: spacing.xs },
  col:         { flex: 1, ...typography.label, color: colors.text.tertiary, textAlign: 'center', letterSpacing: 0.5 },
});

const sr = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.xs },
  rowDone:     { opacity: 0.5 },
  setNum:      { flex: 0.4, ...typography.smallMed, color: colors.text.secondary, textAlign: 'center' },
  target:      { flex: 1, ...typography.small, color: colors.text.secondary, textAlign: 'center' },
  input:       { flex: 1, backgroundColor: colors.background.secondary, borderRadius: radius.sm, padding: spacing.xs + 2, ...typography.smallMed, color: colors.text.primary, textAlign: 'center' },
  checkBtn:    { flex: 0.5, alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border.medium },
  checkBtnDone:{ backgroundColor: colors.success, borderColor: colors.success },
  checkIcon:   { fontSize: 16, color: colors.text.tertiary },
});
