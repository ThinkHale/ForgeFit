/**
 * Forge Tool System
 *
 * Each tool has two parts:
 *  1. A definition (sent to Claude so it knows what's available)
 *  2. An executor (runs when Claude calls the tool)
 *
 * To add a new tool:
 *  1. Add an entry to FORGE_TOOLS with its name, description, and input_schema
 *  2. Add a matching case to executeTool's switch statement
 */

import { useStore } from '../store';
import { healthService } from './health';
import { navigate } from '../navigation/NavigationRef';
import { searchFood, parseFood } from './nutrition';
import { MealEntry, MealType, UserProfile } from '../types';

// ─── Tool definitions (sent to Claude) ───────────────────────────────────────

export const FORGE_TOOLS = [
  {
    name: 'log_meal',
    description:
      "Log a food item or meal to the user's nutrition tracker. Use this whenever the user tells you what they ate, asks you to log something, or you want to record a suggested meal they agreed to.",
    input_schema: {
      type: 'object',
      properties: {
        food_name:    { type: 'string',  description: 'Name of the food or meal' },
        calories:     { type: 'number',  description: 'Calories per serving' },
        protein:      { type: 'number',  description: 'Protein in grams per serving' },
        carbs:        { type: 'number',  description: 'Carbohydrates in grams per serving' },
        fat:          { type: 'number',  description: 'Fat in grams per serving' },
        meal_type:    { type: 'string',  enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: 'Which meal this belongs to' },
        servings:     { type: 'number',  description: 'Number of servings (default 1)' },
        serving_size: { type: 'number',  description: 'Size of one serving' },
        serving_unit: { type: 'string',  description: 'Unit for serving size e.g. "cup", "oz", "g"' },
      },
      required: ['food_name', 'calories', 'protein', 'carbs', 'fat', 'meal_type'],
    },
  },

  {
    name: 'log_workout',
    description:
      'Log a completed workout to Apple Health. Use this when the user says they finished a workout, tells you what they did, or asks you to log it.',
    input_schema: {
      type: 'object',
      properties: {
        name:             { type: 'string', description: 'Workout name, e.g. "Upper Body", "Morning Run"' },
        duration_minutes: { type: 'number', description: 'Duration in minutes' },
        calories_burned:  { type: 'number', description: 'Estimated calories burned (optional — will estimate from duration if omitted)' },
      },
      required: ['name', 'duration_minutes'],
    },
  },

  {
    name: 'get_health_summary',
    description:
      "Fetch the user's current health data: steps, active calories, heart rate, sleep. Use this when the user asks about their activity or you need fresh stats before giving advice.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'get_nutrition_today',
    description:
      "Fetch today's complete nutrition log: all meals, calorie totals, macro breakdown. Use this when the user asks what they've eaten or you need their current intake before making recommendations.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'update_nutrition_goals',
    description:
      "Update the user's daily nutrition targets. Use this when you and the user agree on new calorie or macro goals.",
    input_schema: {
      type: 'object',
      properties: {
        daily_calorie_goal: { type: 'number', description: 'Daily calorie target in kcal' },
        daily_protein_goal: { type: 'number', description: 'Daily protein target in grams' },
        daily_carb_goal:    { type: 'number', description: 'Daily carbohydrate target in grams' },
        daily_fat_goal:     { type: 'number', description: 'Daily fat target in grams' },
      },
      required: [],
    },
  },

  {
    name: 'search_food',
    description:
      'Look up a food in the USDA nutrition database (and Nutritionix when available) to get accurate calorie and macro data before logging. ALWAYS call this before log_meal unless the user has explicitly provided their own nutrition numbers. Pass the full description for natural language ("2 scrambled eggs with cheese") or a food name for keyword search.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Food name or natural language description' },
        mode:  { type: 'string', enum: ['search', 'parse'], description: '"parse" for natural language descriptions, "search" for keyword lookup. Default: "parse".' },
      },
      required: ['query'],
    },
  },

  {
    name: 'start_workout_session',
    description:
      "Create a structured, guided workout session the user can follow step-by-step. Use this when the user asks you to build a workout they're about to do — NOT for logging past workouts (use log_workout for that). This opens the interactive workout tracker.",
    input_schema: {
      type: 'object',
      properties: {
        workout_name: { type: 'string', description: 'e.g. "Upper Body Strength", "HIIT Cardio Blast"' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:         { type: 'string',  description: 'Exercise name' },
              sets:         { type: 'number',  description: 'Number of sets' },
              reps:         { type: 'string',  description: 'e.g. "8-10", "12", "30 seconds", "max"' },
              rest_seconds: { type: 'number',  description: 'Rest between sets in seconds (default 60)' },
              notes:        { type: 'string',  description: 'Optional form cue or tip' },
            },
            required: ['name', 'sets', 'reps'],
          },
          description: 'Ordered list of exercises',
        },
      },
      required: ['workout_name', 'exercises'],
    },
  },

  {
    name: 'update_profile',
    description:
      "Update the user's training profile. Use this when the user confirms a change to their goal, fitness level, training schedule, or session length. Injuries, equipment, and food preferences are captured automatically — no need to update those here.",
    input_schema: {
      type: 'object',
      properties: {
        primary_goal:       { type: 'string', enum: ['lose_weight', 'build_muscle', 'endurance', 'general_fitness'], description: "User's primary fitness goal" },
        fitness_level:      { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'Current fitness level' },
        available_days:     { type: 'number', description: 'Days per week available to train (2-6)' },
        session_length_min: { type: 'number', description: 'Preferred session length in minutes' },
      },
      required: [],
    },
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
}

// ─── Tool executor ────────────────────────────────────────────────────────────

export async function executeTool(tool: ToolUse): Promise<ToolResult> {
  const store = useStore.getState();

  try {
    switch (tool.name) {

      case 'log_meal': {
        const inp = tool.input as {
          food_name: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          meal_type: MealType;
          servings?: number;
          serving_size?: number;
          serving_unit?: string;
        };
        const servings = inp.servings ?? 1;
        const today = new Date().toISOString().split('T')[0];
        const entry: MealEntry = {
          id: Date.now().toString(),
          userId: store.user?.id ?? '',
          foodItem: {
            id: Date.now().toString(),
            name: inp.food_name,
            calories: inp.calories,
            protein: inp.protein,
            carbs: inp.carbs,
            fat: inp.fat,
            servingSize: inp.serving_size ?? 1,
            servingUnit: inp.serving_unit ?? 'serving',
          },
          mealType: inp.meal_type,
          servings,
          date: today,
          loggedAt: new Date().toISOString(),
        };
        await store.addMealEntry(entry);
        return {
          tool_use_id: tool.id,
          content: `Logged ${inp.food_name} (${servings > 1 ? `${servings}x serving, ` : ''}${Math.round(inp.calories * servings)} kcal · ${Math.round(inp.protein * servings)}g protein · ${Math.round(inp.carbs * servings)}g carbs · ${Math.round(inp.fat * servings)}g fat) to ${inp.meal_type}.`,
        };
      }

      case 'log_workout': {
        const inp = tool.input as {
          name: string;
          duration_minutes: number;
          calories_burned?: number;
        };
        const end = new Date();
        const start = new Date(end.getTime() - inp.duration_minutes * 60 * 1000);
        await healthService.logWorkout({
          type: inp.name,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          calories: inp.calories_burned ?? Math.round(inp.duration_minutes * 8),
        });
        return {
          tool_use_id: tool.id,
          content: `Logged "${inp.name}" (${inp.duration_minutes} min) to Apple Health.`,
        };
      }

      case 'get_health_summary': {
        const h = store.healthToday;
        if (!h || Object.keys(h).length === 0) {
          return {
            tool_use_id: tool.id,
            content: 'No health data available. Apple Health may not be connected or has no data yet today.',
          };
        }
        return {
          tool_use_id: tool.id,
          content: JSON.stringify({
            steps: h.steps ?? 0,
            active_calories_burned: h.activeCalories ?? 0,
            heart_rate_avg_bpm: h.heartRateAvg ?? null,
            resting_heart_rate_bpm: h.heartRateResting ?? null,
            sleep_hours: h.sleepHours ?? null,
          }),
        };
      }

      case 'get_nutrition_today': {
        const n = store.nutritionToday;
        if (!n || n.meals.length === 0) {
          return {
            tool_use_id: tool.id,
            content: 'No food logged today yet.',
          };
        }
        return {
          tool_use_id: tool.id,
          content: JSON.stringify({
            total_calories: n.totalCalories,
            calorie_goal: n.calorieGoal,
            remaining_calories: Math.max(0, n.calorieGoal - n.totalCalories),
            total_protein_g: n.totalProtein,
            total_carbs_g: n.totalCarbs,
            total_fat_g: n.totalFat,
            protein_goal_g: n.proteinGoal,
            meals: n.meals.map(m => ({
              name: m.foodItem.name,
              meal_type: m.mealType,
              calories: Math.round(m.foodItem.calories * m.servings),
              protein_g: Math.round(m.foodItem.protein * m.servings),
              carbs_g: Math.round(m.foodItem.carbs * m.servings),
              fat_g: Math.round(m.foodItem.fat * m.servings),
            })),
          }),
        };
      }

      case 'update_nutrition_goals': {
        const inp = tool.input as {
          daily_calorie_goal?: number;
          daily_protein_goal?: number;
          daily_carb_goal?: number;
          daily_fat_goal?: number;
        };
        const updates: Partial<UserProfile> = {};
        if (inp.daily_calorie_goal != null) updates.dailyCalorieGoal = inp.daily_calorie_goal;
        if (inp.daily_protein_goal != null) updates.dailyProteinGoal = inp.daily_protein_goal;
        if (inp.daily_carb_goal    != null) updates.dailyCarbGoal    = inp.daily_carb_goal;
        if (inp.daily_fat_goal     != null) updates.dailyFatGoal     = inp.daily_fat_goal;
        await store.saveProfile(updates);
        await store.loadNutritionToday();
        const lines = Object.entries(inp)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${k.replace('daily_', '').replace('_goal', '')}: ${v}`);
        return {
          tool_use_id: tool.id,
          content: `Updated nutrition goals — ${lines.join(', ')}.`,
        };
      }

      case 'start_workout_session': {
        const inp = tool.input as {
          workout_name: string;
          exercises: Array<{
            name: string;
            sets: number;
            reps: string;
            rest_seconds?: number;
            notes?: string;
          }>;
        };
        store.startWorkout(
          inp.workout_name,
          inp.exercises.map(e => ({
            name:        e.name,
            sets:        e.sets,
            reps:        e.reps,
            restSeconds: e.rest_seconds ?? 60,
            notes:       e.notes,
          }))
        );
        // Navigate to the active workout screen
        navigate('WorkoutActive');
        return {
          tool_use_id: tool.id,
          content: `Workout "${inp.workout_name}" is ready with ${inp.exercises.length} exercises. Opening the workout tracker now.`,
        };
      }

      case 'update_profile': {
        const inp = tool.input as {
          primary_goal?: UserProfile['primaryGoal'];
          fitness_level?: UserProfile['fitnessLevel'];
          available_days?: number;
          session_length_min?: number;
        };
        const updates: Partial<UserProfile> = {};
        if (inp.primary_goal       != null) updates.primaryGoal      = inp.primary_goal;
        if (inp.fitness_level      != null) updates.fitnessLevel      = inp.fitness_level;
        if (inp.available_days     != null) updates.availableDays     = inp.available_days;
        if (inp.session_length_min != null) updates.sessionLengthMin  = inp.session_length_min;
        await store.saveProfile(updates);
        const changed = Object.keys(updates).join(', ');
        return {
          tool_use_id: tool.id,
          content: `Profile updated — ${changed}.`,
        };
      }

      case 'search_food': {
        const inp = tool.input as { query: string; mode?: 'search' | 'parse' };
        const mode = inp.mode ?? 'parse';
        const results = mode === 'parse'
          ? await parseFood(inp.query)
          : await searchFood(inp.query);

        if (results.length === 0) {
          return {
            tool_use_id: tool.id,
            content: `No database results found for "${inp.query}". You may estimate based on your nutritional knowledge, but note the values will be approximate.`,
          };
        }

        const formatted = results.slice(0, 5).map((r, i) => {
          const brand = r.brand ? ` (${r.brand})` : '';
          const per = `per ${r.servingSize}${r.servingUnit}`;
          return `${i + 1}. ${r.name}${brand} — ${r.calories} kcal, ${r.protein}g P, ${r.carbs}g C, ${r.fat}g F ${per} [${r.source.toUpperCase()}]`;
        }).join('\n');

        return {
          tool_use_id: tool.id,
          content: `Found ${results.length} result(s) for "${inp.query}":\n${formatted}\n\nUse the best match's values when calling log_meal.`,
        };
      }

      default:
        return {
          tool_use_id: tool.id,
          content: `Unknown tool: ${tool.name}`,
        };
    }
  } catch (e) {
    return {
      tool_use_id: tool.id,
      content: `Error executing ${tool.name}: ${String(e)}`,
    };
  }
}
