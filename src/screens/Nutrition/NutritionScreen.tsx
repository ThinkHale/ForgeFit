import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseFood, lookupBarcode, NutritionResult } from '../../services/nutrition';
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

// ─── Barcode Scanner ──────────────────────────────────────────────────────────
function BarcodeScannerModal({ onResult, onClose }: {
  onResult: (results: NutritionResult[]) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (!permission?.granted && !permission?.canAskAgain) return;
    if (!permission?.granted) requestPermission();
  }, []);

  async function handleBarcode({ data }: { data: string }) {
    if (!scanning || looking) return;
    setScanning(false);
    setLooking(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const results = await lookupBarcode(data);
      if (results.length > 0) {
        onResult(results);
      } else {
        Alert.alert('Not found', `No nutrition info found for barcode ${data}. Try searching by name instead.`, [
          { text: 'Scan Again', onPress: () => { setScanning(true); setLooking(false); } },
          { text: 'Cancel', onPress: onClose },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Could not look up barcode. Check your connection.', [
        { text: 'OK', onPress: onClose },
      ]);
    } finally {
      setLooking(false);
    }
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={scan.container}>
          <View style={scan.permissionBox}>
            <Text style={scan.permissionTitle}>Camera Access Needed</Text>
            <Text style={scan.permissionBody}>Allow Forge to use your camera to scan food barcodes.</Text>
            <TouchableOpacity onPress={requestPermission} style={scan.permissionBtn} activeOpacity={0.85}>
              <LinearGradient colors={colors.gradients.brand as [string, string]} style={scan.permissionBtnGrad}>
                <Text style={scan.permissionBtnText}>Allow Camera</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={scan.cancelLink}>
              <Text style={scan.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={scan.container}>
        <CameraView
          style={scan.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={scanning ? handleBarcode : undefined}
        />
        {/* Overlay */}
        <View style={scan.overlay} pointerEvents="none">
          <View style={scan.topDim} />
          <View style={scan.middleRow}>
            <View style={scan.sideDim} />
            <View style={scan.frame}>
              <View style={[scan.corner, scan.tl]} />
              <View style={[scan.corner, scan.tr]} />
              <View style={[scan.corner, scan.bl]} />
              <View style={[scan.corner, scan.br]} />
            </View>
            <View style={scan.sideDim} />
          </View>
          <View style={scan.bottomDim} />
        </View>
        {/* UI */}
        <SafeAreaView style={scan.ui} edges={['top', 'bottom']}>
          <TouchableOpacity onPress={onClose} style={scan.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={scan.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={scan.hint}>
            {looking
              ? <ActivityIndicator color="#fff" size="large" />
              : <Text style={scan.hintText}>Point at a barcode</Text>}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

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
  const [showScanner, setShowScanner] = useState(false);

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
          onPress={() => setShowScanner(true)}
          style={logStyles.scanBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={logStyles.scanBtnText}>📷</Text>
        </TouchableOpacity>
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

      {showScanner && (
        <BarcodeScannerModal
          onResult={r => { setShowScanner(false); setResults(r); }}
          onClose={() => setShowScanner(false)}
        />
      )}

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

// ─── Calorie Ring ─────────────────────────────────────────────────────────────
function CalorieRing({ cals, goal }: { cals: number; goal: number }) {
  const size = 148;
  const strokeWidth = 13;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(cals / Math.max(goal, 1), 1);
  const filled = circ * progress;
  const isOver = cals > goal;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={isOver ? 'rgba(255,59,48,0.12)' : 'rgba(255,107,53,0.12)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {cals > 0 && (
          <Circle
            cx={cx} cy={cy} r={r}
            stroke={isOver ? '#FF3B30' : '#FF6B35'}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90, ${cx}, ${cy})`}
          />
        )}
      </Svg>
      <Text style={{ fontSize: 30, fontWeight: '700', color: isOver ? colors.error : colors.text.primary, letterSpacing: -0.5, lineHeight: 36 }}>{cals}</Text>
      <Text style={{ fontSize: 11, color: colors.text.secondary, letterSpacing: 0.2 }}>kcal eaten</Text>
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

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMM d');
}

export default function NutritionScreen() {
  const { nutritionToday, nutritionDate, setNutritionDate, loadNutritionForDate, profile, addMealEntry, removeMealEntry, user } = useStore();
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);
  const [showGoals, setShowGoals] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday  = nutritionDate === todayStr;

  useEffect(() => { loadNutritionForDate(nutritionDate || todayStr); }, []);

  function shiftDate(delta: number) {
    const d = new Date(nutritionDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().split('T')[0];
    if (next > todayStr) return; // no future dates
    setNutritionDate(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function getMealEntries(type: MealType): MealEntry[] {
    return nutritionToday?.meals.filter(m => m.mealType === type) ?? [];
  }

  async function handleAddEntry(entry: Omit<MealEntry, 'id' | 'userId' | 'date' | 'loggedAt'>) {
    try {
      const full: MealEntry = {
        ...entry,
        id:       Date.now().toString(),
        userId:   user?.id ?? '',
        date:     nutritionDate || todayStr,
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
          <Text style={styles.title}>Nutrition</Text>
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.dateArrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.dateLabel}>{formatDateLabel(nutritionDate || todayStr)}</Text>
            <TouchableOpacity onPress={() => shiftDate(1)} style={[styles.dateArrow, isToday && styles.dateArrowDisabled]} disabled={isToday} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.dateArrowText, isToday && styles.dateArrowTextDisabled]}>›</Text>
            </TouchableOpacity>
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
              <CalorieRing cals={cals} goal={goal} />
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
  header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.md },
  title:               { ...typography.h1, color: colors.text.primary },
  dateNav:             { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dateArrow:           { padding: spacing.xs },
  dateArrowDisabled:   { opacity: 0.25 },
  dateArrowText:       { fontSize: 22, color: colors.brand.primary, fontWeight: '300', lineHeight: 26 },
  dateArrowTextDisabled: { color: colors.text.tertiary },
  dateLabel:           { ...typography.smallMed, color: colors.text.primary, minWidth: 90, textAlign: 'center' },
  settingsBtn:         { padding: spacing.xs },
  summaryCard:  { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
  summaryGradient: { padding: spacing.lg },
  summaryCenter: { alignItems: 'center', marginBottom: spacing.lg },
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
  scanBtn:      { backgroundColor: colors.background.tertiary, borderRadius: radius.md, padding: spacing.sm + 2, justifyContent: 'center', alignItems: 'center' },
  scanBtnText:  { fontSize: 20 },
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

const FRAME = 240;
const scan = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#000' },
  camera:           { flex: 1 },
  overlay:          { position: 'absolute', inset: 0 },
  topDim:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  middleRow:        { flexDirection: 'row', height: FRAME },
  sideDim:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  frame:            { width: FRAME, height: FRAME },
  bottomDim:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  corner:           { position: 'absolute', width: 24, height: 24, borderColor: '#fff', borderWidth: 3 },
  tl:               { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  tr:               { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bl:               { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  br:               { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  ui:               { position: 'absolute', inset: 0, justifyContent: 'space-between' },
  closeBtn:         { alignSelf: 'flex-end', margin: spacing.md, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText:        { color: '#fff', fontSize: 18, fontWeight: '600' },
  hint:             { alignItems: 'center', padding: spacing.xl, paddingBottom: spacing.xxxl },
  hintText:         { color: '#fff', fontSize: 16, fontWeight: '500', opacity: 0.85 },
  permissionBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background.primary },
  permissionTitle:  { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm, textAlign: 'center' },
  permissionBody:   { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.xl },
  permissionBtn:    { borderRadius: radius.lg, overflow: 'hidden', alignSelf: 'stretch' },
  permissionBtnGrad:{ padding: spacing.md, alignItems: 'center' },
  permissionBtnText:{ ...typography.h4, color: '#fff' },
  cancelLink:       { padding: spacing.md, marginTop: spacing.sm },
  cancelLinkText:   { ...typography.bodyMed, color: colors.text.secondary, textAlign: 'center' },
});
