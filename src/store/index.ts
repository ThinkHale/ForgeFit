import { create } from 'zustand';
import { User, UserProfile, ChatMessage, HealthSnapshot, DailyNutrition, MealEntry, ActiveWorkout, ActiveWorkoutExercise } from '../types';
import { supabase } from '../services/supabase';
import { extractMemoryUpdate } from '../services/coach';
import { healthService } from '../services/health';

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
  chatHistoryLoaded: boolean;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (v: boolean) => void;
  clearChat: () => void;
  loadChatHistory: () => Promise<void>;
  runMemoryExtraction: () => Promise<void>;

  // Health data
  healthToday: Partial<HealthSnapshot> | null;
  setHealthToday: (data: Partial<HealthSnapshot>) => void;

  // Nutrition
  nutritionToday: DailyNutrition | null;
  isNutritionLoading: boolean;
  nutritionDate: string;
  setNutritionDate: (date: string) => void;
  loadNutritionToday: () => Promise<void>;
  loadNutritionForDate: (date: string) => Promise<void>;
  addMealEntry: (entry: MealEntry) => Promise<void>;
  removeMealEntry: (entryId: string) => Promise<void>;

  // Active workout
  activeWorkout: ActiveWorkout | null;
  startWorkout: (name: string, exercises: Omit<ActiveWorkoutExercise, 'setResults'>[]) => void;
  updateSetResult: (exerciseIdx: number, setIdx: number, result: { reps?: number; weight?: number }) => void;
  finishWorkout: () => Promise<void>;
  cancelWorkout: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────────────
  user: null,
  isAuthLoading: true,
  // Keep isAuthLoading:true when a non-null user arrives so the navigator waits
  // for loadProfile() to finish before deciding which screen to show.
  // Only flip to false when user is null (no session → show Auth immediately).
  setUser: (user) => set(user ? { user } : { user, isAuthLoading: false }),

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
      const { user: u } = get();
      if (u && !get().profile) {
        set({ profile: { ...EMPTY_PROFILE, userId: u.id } });
      }
    } finally {
      set({ isProfileLoading: false, isAuthLoading: false });
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
    if (error) {
      console.warn('[Profile] upsert failed:', error);
      set({ profile }); // rollback optimistic update so DB stays authoritative
    }
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
  chatHistoryLoaded: false,

  loadChatHistory: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const { data } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true })
        .limit(60);
      if (data && data.length > 0) {
        const msgs: ChatMessage[] = data.map((r: Record<string, unknown>) => ({
          id:        r.id as string,
          role:      r.role as 'user' | 'assistant',
          content:   r.content as string,
          timestamp: r.timestamp as string,
        }));
        set({ chatMessages: msgs, chatHistoryLoaded: true });
      } else {
        set({ chatHistoryLoaded: true });
      }
    } catch {
      set({ chatHistoryLoaded: true });
    }
  },

  addChatMessage: (msg) => {
    set(s => ({ chatMessages: [...s.chatMessages, msg] }));
    // Fire-and-forget persistence
    const { user } = get();
    if (user) {
      supabase.from('coach_messages').insert({
        id:        msg.id,
        user_id:   user.id,
        role:      msg.role,
        content:   msg.content,
        timestamp: msg.timestamp,
      }).then(({ error }) => {
        if (error) console.warn('[Chat] persist failed:', error.message);
      });
    }
  },

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
  nutritionDate: new Date().toISOString().split('T')[0],

  setNutritionDate: (date) => {
    set({ nutritionDate: date });
    get().loadNutritionForDate(date);
  },

  loadNutritionToday: async () => {
    const today = new Date().toISOString().split('T')[0];
    set({ nutritionDate: today });
    await get().loadNutritionForDate(today);
  },

  loadNutritionForDate: async (date) => {
    const { user, profile } = get();
    if (!user) return;
    set({ isNutritionLoading: true });
    try {
      const { data } = await supabase
        .from('meal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date);

      const meals: MealEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id:       row.id as string,
        userId:   row.user_id as string,
        foodItem: row.food_item as MealEntry['foodItem'],
        mealType: row.meal_type as MealEntry['mealType'],
        servings: row.servings as number,
        loggedAt: row.logged_at as string,
        date:     row.date as string,
      }));

      const totals = meals.reduce(
        (acc, e) => ({
          calories: acc.calories + (e.foodItem?.calories ?? 0) * e.servings,
          protein:  acc.protein  + (e.foodItem?.protein  ?? 0) * e.servings,
          carbs:    acc.carbs    + (e.foodItem?.carbs    ?? 0) * e.servings,
          fat:      acc.fat      + (e.foodItem?.fat      ?? 0) * e.servings,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      set({
        nutritionToday: {
          date,
          totalCalories: Math.round(totals.calories),
          totalProtein:  Math.round(totals.protein),
          totalCarbs:    Math.round(totals.carbs),
          totalFat:      Math.round(totals.fat),
          meals,
          calorieGoal: profile?.dailyCalorieGoal ?? 2000,
          proteinGoal: profile?.dailyProteinGoal ?? 150,
          carbGoal:    profile?.dailyCarbGoal    ?? 200,
          fatGoal:     profile?.dailyFatGoal     ?? 65,
        },
      });
    } catch (e) {
      console.warn('[Nutrition] loadNutritionForDate failed:', e);
    } finally {
      set({ isNutritionLoading: false });
    }
  },

  addMealEntry: async (entry) => {
    const { user, nutritionDate } = get();
    if (!user) return;
    const { error } = await supabase.from('meal_entries').insert({
      user_id:   user.id,
      food_item: entry.foodItem,
      meal_type: entry.mealType,
      servings:  entry.servings,
      logged_at: entry.loggedAt,
      date:      entry.date,
    });
    if (error) {
      console.warn('[Nutrition] addMealEntry failed:', error);
      throw error;
    }
    await get().loadNutritionForDate(nutritionDate);
  },

  removeMealEntry: async (entryId) => {
    const { user, nutritionDate } = get();
    if (!user) return;
    await supabase.from('meal_entries').delete().eq('id', entryId).eq('user_id', user.id);
    await get().loadNutritionForDate(nutritionDate);
  },

  // ── Active Workout ────────────────────────────────────────────────────────────
  activeWorkout: null,

  startWorkout: (name, exercises) => {
    const workout: ActiveWorkout = {
      id:         Date.now().toString(),
      name,
      startedAt:  new Date().toISOString(),
      exercises:  exercises.map(e => ({
        ...e,
        setResults: Array.from({ length: e.sets }, () => ({ completed: false })),
      })),
    };
    set({ activeWorkout: workout });
  },

  updateSetResult: (exerciseIdx, setIdx, result) => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const exercises = activeWorkout.exercises.map((ex, ei) => {
      if (ei !== exerciseIdx) return ex;
      const setResults = ex.setResults.map((s, si) =>
        si === setIdx ? { ...result, completed: true } : s
      );
      return { ...ex, setResults };
    });
    set({ activeWorkout: { ...activeWorkout, exercises } });
  },

  finishWorkout: async () => {
    const { activeWorkout } = get();
    if (!activeWorkout) return;
    const durationMs = Date.now() - new Date(activeWorkout.startedAt).getTime();
    const durationMin = Math.round(durationMs / 60000);
    try {
      await healthService.logWorkout({
        type:      activeWorkout.name,
        startDate: activeWorkout.startedAt,
        endDate:   new Date().toISOString(),
        calories:  Math.round(durationMin * 8),
      });
    } catch {}
    set({ activeWorkout: null });
  },

  cancelWorkout: () => set({ activeWorkout: null }),
}));
