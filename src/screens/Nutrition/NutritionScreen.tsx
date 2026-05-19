import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { parseNaturalLanguageFood } from '../../services/coach';
import { healthService } from '../../services/health';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { MealType, MealEntry } from '../../types';
import { format } from 'date-fns';

const MEAL_SECTIONS: { type: MealType; label: string; icon: string; timeHint: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: '🌅', timeHint: 'Morning fuel' },
  { type: 'lunch',     label: 'Lunch',     icon: '☀️', timeHint: 'Midday energy' },
  { type: 'dinner',    label: 'Dinner',    icon: '🌙', timeHint: 'Evening recovery' },
  { type: 'snack',     label: 'Snacks',    icon: '🍎', timeHint: 'Between meals' },
];

// ─── AI Food Logger ───────────────────────────────────────────────────────────
function AIFoodLogger({ mealType, onClose, onAdd }: {
  mealType: MealType; onClose: () => void;
  onAdd: (entry: Omit<MealEntry, 'id' | 'userId' | 'date' | 'loggedAt'>) => void;
}) {
  const [input, setInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<{
    name: string; calories: number; protein: number; carbs: number; fat: number;
    servingSize: number; servingUnit: string;
  } | null>(null);
  const [servings, setServings] = useState('1');

  async function handleParse() {
    if (!input.trim()) return;
    setParsing(true);
    try {
      const result = await parseNaturalLanguageFood(input);
      if (result) {
        setParsed(result);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Could not parse', 'Try describing the food differently, like "2 scrambled eggs with cheese".');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to AI. Check your connection.');
    } finally {
      setParsing(false);
    }
  }

  function handleAdd() {
    if (!parsed) return;
    const sv = parseFloat(servings) || 1;
    onAdd({
      foodItem: {
        id: Date.now().toString(),
        name: parsed.name,
        servingSize: parsed.servingSize,
        servingUnit: parsed.servingUnit,
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
      },
      mealType,
      servings: sv,
    });
    onClose();
  }

  return (
    <View style={logStyles.sheet}>
      <View style={logStyles.handle} />
      <Text style={logStyles.sheetTitle}>Add to {MEAL_SECTIONS.find(m => m.type === mealType)?.label}</Text>

      <Text style={logStyles.sheetHint}>Describe what you ate in plain English</Text>
      <View style={logStyles.inputRow}>
        <TextInput
          style={logStyles.input}
          placeholder="e.g. 2 eggs with avocado toast..."
          placeholderTextColor={colors.text.tertiary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleParse}
          autoFocus
        />
        <TouchableOpacity
          onPress={handleParse}
          disabled={parsing || !input.trim()}
          style={[logStyles.parseBtn, { opacity: !input.trim() ? 0.4 : 1 }]}
        >
          {parsing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={logStyles.parseBtnText}>AI Parse</Text>}
        </TouchableOpacity>
      </View>

      {parsed && (
        <View style={logStyles.parsedCard}>
          <Text style={logStyles.parsedName}>{parsed.name}</Text>
          <View style={logStyles.parsedMacros}>
            {[
              { label: 'Cal', val: parsed.calories, color: colors.brand.primary },
              { label: 'P', val: `${parsed.protein}g`, color: colors.brand.electric },
              { label: 'C', val: `${parsed.carbs}g`, color: colors.brand.accent },
              { label: 'F', val: `${parsed.fat}g`, color: colors.brand.secondary },
            ].map(m => (
              <View key={m.label} style={logStyles.parsedMacro}>
                <Text style={[logStyles.parsedMacroVal, { color: m.color }]}>{m.val}</Text>
                <Text style={logStyles.parsedMacroLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={logStyles.servingsRow}>
            <Text style={logStyles.servingsLabel}>Servings</Text>
            <TextInput
              style={logStyles.servingsInput}
              value={servings}
              onChangeText={setServings}
              keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity onPress={handleAdd} style={logStyles.addBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={logStyles.addBtnGradient}
            >
              <Text style={logStyles.addBtnText}>Add to Log</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={onClose} style={logStyles.cancelBtn}>
        <Text style={logStyles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
function GoalSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, saveProfile } = useStore();
  const [calories, setCalories] = useState(String(profile?.dailyCalorieGoal ?? 2000));
  const [protein, setProtein] = useState(String(profile?.dailyProteinGoal ?? 150));
  const [carbs, setCarbs] = useState(String(profile?.dailyCarbGoal ?? 200));
  const [fat, setFat] = useState(String(profile?.dailyFatGoal ?? 65));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveProfile({
        dailyCalorieGoal: parseInt(calories) || 2000,
        dailyProteinGoal: parseInt(protein) || 150,
        dailyCarbGoal:    parseInt(carbs) || 200,
        dailyFatGoal:     parseInt(fat) || 65,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={goalModal.overlay}>
        <TouchableOpacity style={goalModal.backdrop} onPress={onClose} />
        <View style={goalModal.sheet}>
          <View style={goalModal.handle} />
          <Text style={goalModal.title}>Daily Goals</Text>
          {[
            { label: 'Calories (kcal)', val: calories, set: setCalories },
            { label: 'Protein (g)',     val: protein,  set: setProtein },
            { label: 'Carbs (g)',       val: carbs,    set: setCarbs },
            { label: 'Fat (g)',         val: fat,      set: setFat },
          ].map(f => (
            <View key={f.label} style={goalModal.field}>
              <Text style={goalModal.label}>{f.label}</Text>
              <TextInput
                style={goalModal.input}
                value={f.val}
                onChangeText={f.set}
                keyboardType="number-pad"
                selectTextOnFocus
              />
            </View>
          ))}
          <TouchableOpacity onPress={handleSave} disabled={saving} style={goalModal.btn} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.gradients.brand as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={goalModal.btnGradient}
            >
              <Text style={goalModal.btnText}>{saving ? 'Saving…' : 'Save Goals'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={goalModal.cancel}>
            <Text style={goalModal.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function NutritionScreen() {
  const { nutritionToday, profile, addMealEntry, removeMealEntry, loadNutritionToday } = useStore();
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);
  const [showGoals, setShowGoals] = useState(false);

  useEffect(() => { loadNutritionToday(); }, []);

  const today = new Date().toISOString().split('T')[0];

  function getMealEntries(type: MealType): MealEntry[] {
    return nutritionToday?.meals.filter(m => m.mealType === type) ?? [];
  }

  async function handleAddEntry(entry: Omit<MealEntry, 'id' | 'userId' | 'date' | 'loggedAt'>) {
    try {
      const full: MealEntry = {
        ...entry,
        id: Date.now().toString(),
        userId: '',
        date: today,
        loggedAt: new Date().toISOString(),
      };
      await addMealEntry(full);
      try {
        await healthService.logNutrition({
          calories: full.foodItem.calories * full.servings,
          protein:  full.foodItem.protein  * full.servings,
          carbs:    full.foodItem.carbs    * full.servings,
          fat:      full.foodItem.fat      * full.servings,
        });
      } catch {}
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not save food entry. Check your connection and try again.');
    }
  }

  const cals = nutritionToday?.totalCalories ?? 0;
  const goal = nutritionToday?.calorieGoal ?? (profile?.dailyCalorieGoal ?? 2000);
  const progress = cals / goal;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Nutrition</Text>
            <Text style={styles.subtitle}>{format(new Date(), 'EEEE, MMMM d')}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowGoals(true)} style={styles.settingsBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Calorie ring summary */}
        <View style={[styles.summaryCard, shadows.md]}>
          <LinearGradient
            colors={['#FFF5F0', '#FFFFFF']}
            style={styles.summaryGradient}
          >
            <View style={styles.summaryCenter}>
              <View style={styles.calorieCircle}>
                <LinearGradient
                  colors={progress > 1 ? ['#FF3B30','#FF6B35'] : colors.gradients.brand as [string, string]}
                  style={styles.calorieCircleInner}
                >
                  <Text style={styles.calorieCircleNum}>{cals}</Text>
                  <Text style={styles.calorieCircleLabel}>kcal eaten</Text>
                </LinearGradient>
              </View>
              <View style={styles.calorieMeta}>
                <View style={styles.calorieStat}>
                  <Text style={styles.calorieStatVal}>{Math.max(0, goal - cals)}</Text>
                  <Text style={styles.calorieStatLabel}>remaining</Text>
                </View>
                <View style={[styles.calorieStatDivider]} />
                <View style={styles.calorieStat}>
                  <Text style={styles.calorieStatVal}>{goal}</Text>
                  <Text style={styles.calorieStatLabel}>goal</Text>
                </View>
              </View>
            </View>

            {/* Macro bars */}
            <View style={styles.macros}>
              {[
                { label: 'Protein', cur: nutritionToday?.totalProtein ?? 0, goal: nutritionToday?.proteinGoal ?? (profile?.dailyProteinGoal ?? 150), color: colors.brand.electric },
                { label: 'Carbs',   cur: nutritionToday?.totalCarbs   ?? 0, goal: nutritionToday?.carbGoal   ?? (profile?.dailyCarbGoal   ?? 200), color: colors.brand.accent },
                { label: 'Fat',     cur: nutritionToday?.totalFat     ?? 0, goal: nutritionToday?.fatGoal    ?? (profile?.dailyFatGoal    ?? 65),  color: colors.brand.secondary },
              ].map(m => (
                <View key={m.label} style={styles.macroItem}>
                  <View style={styles.macroItemRow}>
                    <Text style={styles.macroItemLabel}>{m.label}</Text>
                    <Text style={styles.macroItemVal}>{m.cur}g <Text style={{ color: colors.text.tertiary }}>/ {m.goal}g</Text></Text>
                  </View>
                  <View style={styles.macroBar}>
                    <View style={[styles.macroBarFill, {
                      width: `${Math.min(100, (m.cur / m.goal) * 100)}%` as unknown as number,
                      backgroundColor: m.color,
                    }]} />
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Meal sections */}
        {MEAL_SECTIONS.map(section => {
          const entries = getMealEntries(section.type);
          const totalCal = entries.reduce((sum, e) => sum + e.foodItem.calories * e.servings, 0);
          return (
            <View key={section.type} style={[styles.mealSection, shadows.sm]}>
              <View style={styles.mealHeader}>
                <View style={styles.mealHeaderLeft}>
                  <Text style={{ fontSize: 22 }}>{section.icon}</Text>
                  <View>
                    <Text style={styles.mealTitle}>{section.label}</Text>
                    <Text style={styles.mealHint}>{section.timeHint}</Text>
                  </View>
                </View>
                <View style={styles.mealHeaderRight}>
                  {totalCal > 0 && <Text style={styles.mealCal}>{Math.round(totalCal)} kcal</Text>}
                  <TouchableOpacity
                    onPress={() => setActiveMeal(section.type)}
                    style={styles.addMealBtn}
                  >
                    <Text style={styles.addMealBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {entries.length === 0 ? (
                <TouchableOpacity onPress={() => setActiveMeal(section.type)} style={styles.emptyMeal}>
                  <Text style={styles.emptyMealText}>Tap to log your {section.label.toLowerCase()}</Text>
                </TouchableOpacity>
              ) : (
                entries.map(entry => (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName}>{entry.foodItem.name}</Text>
                      <Text style={styles.entryDetail}>
                        {entry.servings > 1 ? `${entry.servings}x · ` : ''}{Math.round(entry.foodItem.calories * entry.servings)} kcal · {Math.round(entry.foodItem.protein * entry.servings)}g P
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeMealEntry(entry.id)}
                      style={styles.removeBtn}
                    >
                      <Text style={{ color: colors.error, fontSize: 18 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* AI Food Logger Sheet */}
      {activeMeal && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setActiveMeal(null)} />
          <AIFoodLogger
            mealType={activeMeal}
            onClose={() => setActiveMeal(null)}
            onAdd={handleAddEntry}
          />
        </View>
      )}

      <GoalSettingsModal visible={showGoals} onClose={() => setShowGoals(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background.secondary },
  scroll:       { padding: spacing.md },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: spacing.sm },
  title:        { ...typography.h1, color: colors.text.primary },
  subtitle:     { ...typography.small, color: colors.text.secondary, marginBottom: spacing.md },
  settingsBtn:  { padding: spacing.xs, marginTop: spacing.xs },
  summaryCard:  { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
  summaryGradient: { padding: spacing.lg },
  summaryCenter: { alignItems: 'center', marginBottom: spacing.lg },
  calorieCircle: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', marginBottom: spacing.md, ...shadows.brand },
  calorieCircleInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  calorieCircleNum:   { ...typography.h1, color: '#fff', lineHeight: 40 },
  calorieCircleLabel: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  calorieMeta:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  calorieStat:   { alignItems: 'center' },
  calorieStatVal: { ...typography.h3, color: colors.text.primary },
  calorieStatLabel: { ...typography.caption, color: colors.text.secondary },
  calorieStatDivider: { width: 1, height: 32, backgroundColor: colors.border.light },
  macros:       { gap: spacing.sm },
  macroItem:    {},
  macroItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroItemLabel: { ...typography.smallMed, color: colors.text.secondary },
  macroItemVal: { ...typography.smallMed, color: colors.text.primary },
  macroBar:     { height: 6, backgroundColor: colors.background.tertiary, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 3 },
  mealSection:  { backgroundColor: colors.background.primary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  mealHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mealTitle:    { ...typography.bodyMed, color: colors.text.primary },
  mealHint:     { ...typography.caption, color: colors.text.tertiary },
  mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mealCal:      { ...typography.caption, color: colors.text.secondary },
  addMealBtn:   { paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.glass.brand, borderRadius: radius.full },
  addMealBtnText: { ...typography.captionMed, color: colors.brand.primary },
  emptyMeal:    { paddingVertical: spacing.md, alignItems: 'center' },
  emptyMealText: { ...typography.small, color: colors.text.tertiary },
  entryRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border.light },
  entryName:    { ...typography.smallMed, color: colors.text.primary },
  entryDetail:  { ...typography.caption, color: colors.text.secondary, marginTop: 1 },
  removeBtn:    { padding: spacing.xs },
  sheetOverlay: { position: 'absolute', inset: 0, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
});

const logStyles = StyleSheet.create({
  sheet:        { backgroundColor: colors.background.primary, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, paddingBottom: 40 },
  handle:       { width: 36, height: 4, backgroundColor: colors.border.medium, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle:   { ...typography.h3, color: colors.text.primary, marginBottom: 4 },
  sheetHint:    { ...typography.small, color: colors.text.secondary, marginBottom: spacing.md },
  inputRow:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  input:        { flex: 1, backgroundColor: colors.background.secondary, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text.primary },
  parseBtn:     { backgroundColor: colors.brand.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center' },
  parseBtnText: { ...typography.smallMed, color: '#fff' },
  parsedCard:   { backgroundColor: colors.glass.brand, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  parsedName:   { ...typography.h4, color: colors.text.primary, marginBottom: spacing.sm },
  parsedMacros: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  parsedMacro:  { alignItems: 'center' },
  parsedMacroVal: { ...typography.bodyMed },
  parsedMacroLabel: { ...typography.caption, color: colors.text.secondary },
  servingsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  servingsLabel: { ...typography.bodyMed, color: colors.text.primary },
  servingsInput: { backgroundColor: colors.background.secondary, borderRadius: radius.sm, padding: spacing.sm, width: 80, textAlign: 'center', ...typography.bodyMed },
  addBtn:       { borderRadius: radius.lg, overflow: 'hidden' },
  addBtnGradient: { padding: spacing.md, alignItems: 'center' },
  addBtnText:   { ...typography.h4, color: '#fff' },
  cancelBtn:    { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  cancelText:   { ...typography.bodyMed, color: colors.text.secondary },
});

const goalModal = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:       { backgroundColor: colors.background.primary, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, paddingBottom: 40 },
  handle:      { width: 36, height: 4, backgroundColor: colors.border.medium, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title:       { ...typography.h3, color: colors.text.primary, marginBottom: spacing.md },
  field:       { marginBottom: spacing.sm },
  label:       { ...typography.smallMed, color: colors.text.secondary, marginBottom: spacing.xs },
  input:       { backgroundColor: colors.background.secondary, borderRadius: radius.md, padding: spacing.md, ...typography.body, color: colors.text.primary },
  btn:         { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.md },
  btnGradient: { padding: spacing.md, alignItems: 'center' },
  btnText:     { ...typography.h4, color: '#fff' },
  cancel:      { padding: spacing.md, alignItems: 'center' },
  cancelText:  { ...typography.bodyMed, color: colors.text.secondary },
});
