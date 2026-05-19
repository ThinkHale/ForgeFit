import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { parseFood, NutritionResult } from '../../services/nutrition';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { MealType, MealEntry } from '../../types';
import { format } from 'date-fns';

const MEAL_SECTIONS: { type: MealType; label: string; icon: string; timeHint: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: '🌅', timeHint: 'Morning fuel' },
  { type: 'lunch',     label: 'Lunch',     icon: '☀️', timeHint: 'Midday energy' },
  { type: 'dinner',    label: 'Dinner',    icon: '🌙', timeHint: 'Evening recovery' },
  { type: 'snack',     label: 'Snacks',    icon: '🍎', timeHint: 'Between meals' },
];

const SOURCE_LABEL: Record<string, string> = { usda: 'USDA', nutritionix: 'Nutritionix' };

// ─── Food Logger ──────────────────────────────────────────────────────────────
function AIFoodLogger({ mealType, onClose, onAdd }: {
  mealType: MealType; onClose: () => void;
  onAdd: (entry: Omit<MealEntry, 'id' | 'userId' | 'date' | 'loggedAt'>) => void;
}) {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NutritionResult[]>([]);
  const [selected, setSelected] = useState<NutritionResult | null>(null);
  const [servings, setServings] = useState('1');

  async function handleSearch() {
    if (!input.trim()) return;
    setSearching(true);
    setResults([]);
    setSelected(null);
    try {
      const found = await parseFood(input.trim());
      if (found.length > 0) {
        setResults(found);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('No results', 'Try a simpler description, like "scrambled eggs" or "chicken breast".');
      }
    } catch {
      Alert.alert('Error', 'Could not reach the nutrition database. Check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: NutritionResult) {
    setSelected(r);
    Haptics.selectionAsync();
  }

  function handleAdd() {
    if (!selected) return;
    const sv = parseFloat(servings) || 1;
    onAdd({
      foodItem: {
        id: Date.now().toString(),
        name: selected.name,
        servingSize: selected.servingSize,
        servingUnit: selected.servingUnit,
        calories: selected.calories,
        protein: selected.protein,
        carbs: selected.carbs,
        fat: selected.fat,
      },
      mealType,
      servings: sv,
    });
    onClose();
  }

  const mealLabel = MEAL_SECTIONS.find(m => m.type === mealType)?.label;

  return (
    <View style={logStyles.sheet}>
      <View style={logStyles.handle} />
      <Text style={logStyles.sheetTitle}>Add to {mealLabel}</Text>
      <Text style={logStyles.sheetHint}>Describe what you ate — data sourced from USDA &amp; Nutritionix</Text>

      <View style={logStyles.inputRow}>
        <TextInput
          style={logStyles.input}
          placeholder="e.g. 2 eggs with avocado toast..."
          placeholderTextColor={colors.text.tertiary}
          value={input}
          onChangeText={v => { setInput(v); if (results.length) { setResults([]); setSelected(null); } }}
          onSubmitEditing={handleSearch}
          autoFocus
        />
        <TouchableOpacity
          onPress={handleSearch}
          disabled={searching || !input.trim()}
          style={[logStyles.parseBtn, { opacity: !input.trim() ? 0.4 : 1 }]}
        >
          {searching
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={logStyles.parseBtnText}>Search</Text>}
        </TouchableOpacity>
      </View>

      {/* Result list */}
      {results.length > 0 && !selected && (
        <View style={logStyles.resultList}>
          {results.map((r, i) => (
            <TouchableOpacity key={i} onPress={() => selectResult(r)} style={logStyles.resultRow} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={logStyles.resultName} numberOfLines={1}>{r.name}</Text>
                {r.brand && <Text style={logStyles.resultBrand} numberOfLines={1}>{r.brand}</Text>}
                <Text style={logStyles.resultMacros}>
                  {r.calories} kcal · {r.protein}g P · {r.carbs}g C · {r.fat}g F
                  <Text style={logStyles.resultPer}> per {r.servingSize}{r.servingUnit}</Text>
                </Text>
              </View>
              <Text style={logStyles.resultSource}>{SOURCE_LABEL[r.source]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Confirmed selection */}
      {selected && (
        <View style={logStyles.parsedCard}>
          <View style={logStyles.parsedHeader}>
            <View style={{ flex: 1 }}>
              <Text style={logStyles.parsedName}>{selected.name}</Text>
              {selected.brand && <Text style={logStyles.resultBrand}>{selected.brand}</Text>}
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} style={logStyles.changeBtn}>
              <Text style={logStyles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={logStyles.parsedMacros}>
            {[
              { label: 'Cal', val: selected.calories,         color: colors.brand.primary },
              { label: 'P',   val: `${selected.protein}g`,   color: colors.brand.electric },
              { label: 'C',   val: `${selected.carbs}g`,     color: colors.brand.accent },
              { label: 'F',   val: `${selected.fat}g`,       color: colors.brand.secondary },
            ].map(m => (
              <View key={m.label} style={logStyles.parsedMacro}>
                <Text style={[logStyles.parsedMacroVal, { color: m.color }]}>{m.val}</Text>
                <Text style={logStyles.parsedMacroLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <Text style={logStyles.perServing}>per {selected.servingSize}{selected.servingUnit} · {SOURCE_LABEL[selected.source]}</Text>
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
  const { nutritionToday, profile, addMealEntry, removeMealEntry, loadNutritionToday, user } = useStore();
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
        userId: user?.id ?? '',
        date: today,
        loggedAt: new Date().toISOString(),
      };
      await addMealEntry(full);
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
  resultList:   { borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.light },
  resultRow:    { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.background.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  resultName:   { ...typography.smallMed, color: colors.text.primary, marginBottom: 2 },
  resultBrand:  { ...typography.caption, color: colors.text.secondary, marginBottom: 2 },
  resultMacros: { ...typography.caption, color: colors.text.secondary },
  resultPer:    { color: colors.text.tertiary },
  resultSource: { ...typography.caption, color: colors.brand.primary, fontWeight: '600', marginLeft: spacing.sm },
  parsedCard:   { backgroundColor: colors.glass.brand, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  parsedHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  parsedName:   { ...typography.h4, color: colors.text.primary },
  changeBtn:    { paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.background.secondary, borderRadius: radius.sm },
  changeBtnText: { ...typography.caption, color: colors.brand.primary, fontWeight: '600' },
  perServing:   { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.md },
  parsedMacros: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
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
