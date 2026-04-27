// ─── Core Types ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  name: string | null;
  age: number | null;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  primaryGoal: 'lose_weight' | 'build_muscle' | 'endurance' | 'general_fitness' | null;
  secondaryGoals: string[];
  equipment: string[];
  availableDays: number | null;
  sessionLengthMin: number | null;
  injuries: string[];
  limitations: string[];
  dietaryRestrictions: string[];
  preferredWorkoutStyle: string[];
  dislikedExercises: string[];
  favoriteFoods: string[];
  motivationStyle: 'tough_love' | 'gentle' | 'data_driven' | 'hype' | null;
  struggles: string[];
  wins: string[];
  personalDetails: string[];
  coachNotes: string[];
  lastSessionSummary: string | null;
  sessionCount: number;
  relationshipStage: 'new' | 'building' | 'established' | 'deep';
  dailyCalorieGoal: number | null;
  dailyProteinGoal: number | null;
  dailyCarbGoal: number | null;
  dailyFatGoal: number | null;
  updatedAt: string | null;
}

// ─── Nutrition ─────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  barcode?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry {
  id: string;
  userId: string;
  foodItem: FoodItem;
  mealType: MealType;
  servings: number;
  loggedAt: string;
  date: string; // YYYY-MM-DD
}

export interface DailyNutrition {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: MealEntry[];
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
}

// ─── Workouts ──────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  equipment: string[];
  instructions: string[];
  videoUrl?: string;
  imageUrl?: string;
  isCompound: boolean;
}

export interface WorkoutSet {
  setNumber: number;
  reps?: number;
  weight?: number;
  duration?: number; // seconds
  distance?: number; // meters
  completed: boolean;
  rpe?: number; // rate of perceived exertion 1-10
}

export interface WorkoutExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
  restSeconds: number;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  name: string;
  type: 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'sport';
  exercises: WorkoutExercise[];
  startedAt: string;
  completedAt?: string;
  durationMinutes?: number;
  caloriesBurned?: number;
  heartRateAvg?: number;
  notes?: string;
  source: 'forge' | 'manual' | 'health_kit';
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description: string;
  daysPerWeek: number;
  durationWeeks: number;
  sessions: PlannedSession[];
  createdAt: string;
  isActive: boolean;
}

export interface PlannedSession {
  dayOfWeek: number;
  workoutTemplate: Omit<WorkoutSession, 'id' | 'userId' | 'startedAt' | 'source'>;
}

// ─── Health Data ───────────────────────────────────────────────────────────────

export interface HealthSnapshot {
  date: string;
  steps: number;
  activeCalories: number;
  restingCalories: number;
  heartRateAvg: number;
  heartRateResting: number;
  heartRateVariability?: number;
  sleepHours?: number;
  sleepQuality?: number;
  weight?: number;
  bodyFat?: number;
  vo2Max?: number;
  workoutMinutes: number;
  standHours: number;
  exerciseMinutes: number;
  distanceKm: number;
}

// ─── Apple Watch ───────────────────────────────────────────────────────────────

export interface WatchWorkoutUpdate {
  heartRate: number;
  caloriesBurned: number;
  elapsedSeconds: number;
  currentExercise?: string;
  currentSet?: number;
  currentRep?: number;
}

export interface WatchMessage {
  type: 'START_WORKOUT' | 'PAUSE_WORKOUT' | 'END_WORKOUT' | 'NEXT_EXERCISE' | 'WORKOUT_UPDATE' | 'PING';
  payload?: Record<string, unknown>;
  timestamp: string;
}

// ─── AI Coach ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    type?: 'workout_suggestion' | 'meal_suggestion' | 'motivation' | 'general';
    actionable?: boolean;
  };
}

export interface CoachSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  startedAt: string;
  endedAt?: string;
  summary?: string;
}

// ─── Navigation ────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Coach: undefined;
  Nutrition: undefined;
  Workouts: undefined;
  Progress: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  WorkoutDetail: { sessionId: string };
  WorkoutActive: { templateId?: string };
};

export type NutritionStackParamList = {
  NutritionMain: undefined;
  FoodSearch: { mealType: MealType; date: string };
  FoodDetail: { foodId: string; mealType: MealType; date: string };
  MealSummary: { date: string };
};
