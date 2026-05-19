import { create } from 'zustand';
import { User, UserProfile, ChatMessage, HealthSnapshot, DailyNutrition, MealEntry } from '../types';
import { supabase } from '../services/supabase';
import { extractMemoryUpdate } from '../services/coach';

// ─── DB serialization (camelCase ↔ snake_case) ───────────────────────────────
// The Supabase schema uses snake_case; TypeScript uses camelCase.

function profileToDb(p: Partial<UserProfile>): Record<string, unknown> {
  return {
    name:                   p.name,
    age:                    p.age,
    fitness_level:          p.fitnessLevel,
    primary_goal:           p.primaryGoal,
    secondary_goals:        p.secondaryGoals,
    equipment:              p.equipment,
    available_days:         p.availableDays,
    session_length_min:     p.sessionLengthMin,
    injuries:               p.injuries,
    limitations:            p.limitations,
    dietary_restrictions:   p.dietaryRestrictions,
    preferred_workout_style:p.preferredWorkoutStyle,
    disliked_exercises:     p.dislikedExercises,
    favorite_foods:         p.favoriteFoods,
    motivation_style:       p.motivationStyle,
    struggles:              p.struggles,
    wins:                   p.wins,
    personal_details:       p.personalDetails,
    coach_notes:            p.coachNotes,
    last_session_summary:   p.lastSessionSummary,
    session_count:          p.sessionCount,
    relationship_stage:     p.relationshipStage,
    daily_calorie_goal:     p.dailyCalorieGoal,
    daily_protein_goal:     p.dailyProteinGoal,
    daily_carb_goal:        p.dailyCarbGoal,
    daily_fat_goal:         p.dailyFatGoal,
    updated_at:             p.updatedAt,
  };
}

function profileFromDb(row: Record<string, unknown>, userId: string): UserProfile {
  return {
    userId,
    name:                   (row.name as string | null) ?? null,
    age:                    (row.age as number | null) ?? null,
    fitnessLevel:           (row.fitness_level as UserProfile['fitnessLevel']) ?? null,
    primaryGoal:            (row.primary_goal as UserProfile['primaryGoal']) ?? null,
    secondaryGoals:         (row.secondary_goals as string[]) ?? [],
    equipment:              (row.equipment as string[]) ?? [],
    availableDays:          (row.available_days as number | null) ?? null,
    sessionLengthMin:       (row.session_length_min as number | null) ?? null,
    injuries:               (row.injuries as string[]) ?? [],
    limitations:            (row.limitations as string[]) ?? [],
    dietaryRestrictions:    (row.dietary_restrictions as string[]) ?? [],
    preferredWorkoutStyle:  (row.preferred_workout_style as string[]) ?? [],
    dislikedExercises:      (row.disliked_exercises as string[]) ?? [],
    favoriteFoods:          (row.favorite_foods as string[]) ?? [],
    motivationStyle:        (row.motivation_style as UserProfile['motivationStyle']) ?? null,
    struggles:              (row.struggles as string[]) ?? [],
    wins:                   (row.wins as string[]) ?? [],
    personalDetails:        (row.personal_details as string[]) ?? [],
    coachNotes:             (row.coach_notes as string[]) ?? [],
    lastSessionSummary:     (row.last_session_summary as string | null) ?? null,
    sessionCount:           (row.session_count as number) ?? 0,
    relationshipStage:      (row.relationship_stage as UserProfile['relationshipStage']) ?? 'new',
    dailyCalorieGoal:       (row.daily_calorie_goal as number | null) ?? null,
    dailyProteinGoal:       (row.daily_protein_goal as number | null) ?? null,
    dailyCarbGoal:          (row.daily_carb_goal as number | null) ?? null,
    dailyFatGoal:           (row.daily_fat_goal as number | null) ?? null,
    updatedAt:              (row.updated_at as string | null) ?? null,
  };
}

const EMPTY_PROFILE: Omit<UserProfile, 'userId'> = {
  name: null, age: null, fitnessLevel: null, primaryGoal: null,
  secondaryGoals: [], equipment: [], availableDays: null, sessionLengthMin: null,
  injuries: [], limitations: [], dietaryRestrictions: [], preferredWorkoutStyle: [],
  dislikedExercises: [], favoriteFoods: [], motivationStyle: null,
  struggles: [], wins: [], personalDetails: [], coachNotes: [],
  lastSessionSummary: null, sessionCount: 0, relationshipStage: 'new',
  dailyCalorieGoal: null, dailyProteinGoal: null, dailyCarbGoal: null, dailyFatGoal: null,
  updatedAt: null,
};

const ARRAY_FIELDS = new Set([
  'secondaryGoals','equipment','injuries','limitations','dietaryRestrictions',
  'preferredWorkoutStyle','dislikedExercises','favoriteFoods','struggles','wins',
  'personalDetails','coachNotes',
]);

interface AppState {
  // Auth
  user: User | null;
  isAuthLoading: boolean;
  setUser: (user: User | null) => void;

  // Profile / memory
  profile: UserProfile | null;
  isProfileLoading: boolean;
  loadProfile: () => Promise<void>;
  saveProfile: (updates: Partial<UserProfile>) => Promise<void>;
  mergeMemoryUpdate: (updates: Partial<UserProfile>) => Promise<void>;

  // Coach chat
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (v: boolean) => void;
  clearChat: () => void;
  runMemoryExtraction: () => Promise<void>;

  // Health data
  healthToday: Partial<HealthSnapshot> | null;
  setHealthToday: (data: Partial<HealthSnapshot>) => void;

  // Nutrition
  nutritionToday: DailyNutrition | null;
  isNutritionLoading: boolean;
  loadNutritionToday: () => Promise<void>;
  addMealEntry: (entry: MealEntry) => Promise<void>;
  removeMealEntry: (entryId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────────────
  user: null,
  isAuthLoading: true,
  setUser: (user) => set({ user, isAuthLoading: false }),

  // ── Profile ───────────────────────────────────────────────────────────────────
  profile: null,
  isProfileLoading: false,

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    set({ isProfileLoading: true });
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        set({ profile: profileFromDb(data as Record<string, unknown>, user.id) });
      } else {
        const newProfile: UserProfile = { ...EMPTY_PROFILE, userId: user.id };
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({ user_id: user.id, ...profileToDb(newProfile) });
        if (insertError) console.warn('[Profile] insert failed:', insertError);
        set({ profile: newProfile });
      }
    } catch (e) {
      console.warn('[Profile] loadProfile failed:', e);
      // Ensure profile is non-null so saveProfile can proceed
      const { user: u } = get();
      if (u && !get().profile) {
        set({ profile: { ...EMPTY_PROFILE, userId: u.id } });
      }
    } finally {
      set({ isProfileLoading: false });
    }
  },

  saveProfile: async (updates) => {
    const { user, profile } = get();
    if (!user || !profile) return;
    const next = { ...profile, ...updates, updatedAt: new Date().toISOString() };
    set({ profile: next });
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, ...profileToDb(next) },
        { onConflict: 'user_id' }
      );
    if (error) console.warn('[Profile] upsert failed:', error);
  },

  mergeMemoryUpdate: async (updates) => {
    const { profile } = get();
    if (!profile || !Object.keys(updates).length) return;
    const merged = { ...profile };
    for (const [key, val] of Object.entries(updates) as [keyof UserProfile, unknown][]) {
      if (ARRAY_FIELDS.has(key) && Array.isArray(val) && Array.isArray(merged[key])) {
        const existing = new Set((merged[key] as string[]).map(s => String(s).toLowerCase()));
        (merged[key] as string[]) = [
          ...(merged[key] as string[]),
          ...(val as string[]).filter(v => !existing.has(String(v).toLowerCase())),
        ];
      } else if (val !== null && val !== undefined && val !== '') {
        (merged[key] as unknown) = val;
      }
    }
    merged.sessionCount = profile.sessionCount + 1;
    merged.updatedAt = new Date().toISOString();
    const count = merged.sessionCount;
    if (count >= 10) merged.relationshipStage = 'deep';
    else if (count >= 5) merged.relationshipStage = 'established';
    else if (count >= 2) merged.relationshipStage = 'building';
    await get().saveProfile(merged);
  },

  // ── Chat ──────────────────────────────────────────────────────────────────────
  chatMessages: [],
  isChatLoading: false,
  addChatMessage: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatLoading: (v) => set({ isChatLoading: v }),
  clearChat: () => set({ chatMessages: [] }),

  runMemoryExtraction: async () => {
    const { chatMessages, profile } = get();
    if (!profile) return;
    const userTurns = chatMessages.filter(m => m.role === 'user');
    if (!userTurns.length) return;
    try {
      const updates = await extractMemoryUpdate(chatMessages, profile);
      if (Object.keys(updates).length > 0) {
        await get().mergeMemoryUpdate(updates as Partial<UserProfile>);
      }
    } catch (e) {
      console.warn('[Memory] Extraction failed:', e);
    }
  },

  // ── Health ────────────────────────────────────────────────────────────────────
  healthToday: null,
  setHealthToday: (data) => set({ healthToday: data }),

  // ── Nutrition ─────────────────────────────────────────────────────────────────
  nutritionToday: null,
  isNutritionLoading: false,

  loadNutritionToday: async () => {
    const { user, profile } = get();
    if (!user) return;
    set({ isNutritionLoading: true });
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('meal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      const meals: MealEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        userId: row.user_id as string,
        foodItem: row.food_item as MealEntry['foodItem'],
        mealType: row.meal_type as MealEntry['mealType'],
        servings: row.servings as number,
        loggedAt: row.logged_at as string,
        date: row.date as string,
      }));

      const totals = meals.reduce(
        (acc, entry) => ({
          calories: acc.calories + (entry.foodItem?.calories ?? 0) * entry.servings,
          protein:  acc.protein  + (entry.foodItem?.protein  ?? 0) * entry.servings,
          carbs:    acc.carbs    + (entry.foodItem?.carbs    ?? 0) * entry.servings,
          fat:      acc.fat      + (entry.foodItem?.fat      ?? 0) * entry.servings,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      set({
        nutritionToday: {
          date: today,
          totalCalories: Math.round(totals.calories),
          totalProtein: Math.round(totals.protein),
          totalCarbs: Math.round(totals.carbs),
          totalFat: Math.round(totals.fat),
          meals,
          calorieGoal: profile?.dailyCalorieGoal ?? 2000,
          proteinGoal: profile?.dailyProteinGoal ?? 150,
          carbGoal: profile?.dailyCarbGoal ?? 200,
          fatGoal: profile?.dailyFatGoal ?? 65,
        },
      });
    } catch {
      // table may not exist or network error — leave nutritionToday as-is
    } finally {
      set({ isNutritionLoading: false });
    }
  },

  addMealEntry: async (entry) => {
    const { user } = get();
    if (!user) return;
    await supabase.from('meal_entries').insert({
      id: entry.id,
      user_id: user.id,
      food_item: entry.foodItem,
      meal_type: entry.mealType,
      servings: entry.servings,
      logged_at: entry.loggedAt,
      date: entry.date,
    });
    await get().loadNutritionToday();
  },

  removeMealEntry: async (entryId) => {
    const { user } = get();
    if (!user) return;
    await supabase.from('meal_entries').delete().eq('id', entryId).eq('user_id', user.id);
    await get().loadNutritionToday();
  },
}));
