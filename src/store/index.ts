import { create } from 'zustand';
import { User, UserProfile, ChatMessage, HealthSnapshot, DailyNutrition, MealEntry } from '../types';
import { supabase } from '../services/supabase';
import { extractMemoryUpdate } from '../services/coach';

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
        set({ profile: { ...EMPTY_PROFILE, ...data, userId: user.id } });
      } else {
        // Create new profile
        const newProfile: UserProfile = { ...EMPTY_PROFILE, userId: user.id };
        await supabase.from('user_profiles').insert({ user_id: user.id, ...EMPTY_PROFILE });
        set({ profile: newProfile });
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
    await supabase.from('user_profiles').upsert({ user_id: user.id, ...next });
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
          calories: acc.calories + entry.foodItem.calories * entry.servings,
          protein:  acc.protein  + entry.foodItem.protein  * entry.servings,
          carbs:    acc.carbs    + entry.foodItem.carbs    * entry.servings,
          fat:      acc.fat      + entry.foodItem.fat      * entry.servings,
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
