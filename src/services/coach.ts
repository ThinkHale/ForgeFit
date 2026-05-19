import { supabase } from './supabase';
import { UserProfile, ChatMessage, HealthSnapshot, DailyNutrition } from '../types';

async function callClaude(
  messages: Array<{ role: string; content: string }>,
  system: string,
  maxTokens = 1000
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('claude', {
    body: { messages, system, maxTokens },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.text as string) ?? '';
}

// ─── System prompt builder ────────────────────────────────────────────────────

export function buildCoachSystemPrompt(
  profile: UserProfile,
  healthToday?: Partial<HealthSnapshot>,
  nutritionToday?: Partial<DailyNutrition>
): string {
  const healthContext = healthToday
    ? `
TODAY'S HEALTH DATA (from Apple Health):
Steps: ${healthToday.steps?.toLocaleString() ?? 'unknown'}
Active calories burned: ${healthToday.activeCalories ?? 'unknown'} kcal
Current heart rate: ${healthToday.heartRateAvg ?? 'unknown'} bpm
Resting heart rate: ${healthToday.heartRateResting ?? 'unknown'} bpm
Sleep last night: ${healthToday.sleepHours ? `${healthToday.sleepHours.toFixed(1)} hrs` : 'unknown'}
HRV: ${healthToday.heartRateVariability ?? 'unknown'}`
    : '';

  const nutritionContext = nutritionToday
    ? `
TODAY'S NUTRITION:
Calories: ${nutritionToday.totalCalories ?? 0} / ${nutritionToday.calorieGoal ?? '?'} kcal goal
Protein: ${nutritionToday.totalProtein ?? 0}g / ${nutritionToday.proteinGoal ?? '?'}g goal
Carbs: ${nutritionToday.totalCarbs ?? 0}g
Fat: ${nutritionToday.totalFat ?? 0}g`
    : '';

  const profileBlock = profile.sessionCount === 0
    ? `This is the user's FIRST session. You don't know them yet. Warmly introduce yourself as Forge, their AI training partner. Ask their name and what brings them here. Be curious and human. Gather info naturally -- never ask multiple questions at once.`
    : `
FORGE USER PROFILE (your living memory of this person):
Name: ${profile.name ?? 'unknown'}
Relationship: ${profile.relationshipStage} stage, ${profile.sessionCount} sessions together
Fitness level: ${profile.fitnessLevel ?? 'unknown'}
Primary goal: ${profile.primaryGoal ?? 'unknown'}
Secondary goals: ${profile.secondaryGoals.join(', ') || 'none noted'}
Equipment: ${profile.equipment.join(', ') || 'unknown'}
Available days/week: ${profile.availableDays ?? 'unknown'} | Session length: ${profile.sessionLengthMin ? profile.sessionLengthMin + ' min' : 'unknown'}
Injuries/limitations: ${[...profile.injuries, ...profile.limitations].join(', ') || 'none'}
Dietary restrictions: ${profile.dietaryRestrictions.join(', ') || 'none'}
Calorie goal: ${profile.dailyCalorieGoal ?? 'not set'} kcal
Protein goal: ${profile.dailyProteinGoal ?? 'not set'}g
Preferred style: ${profile.preferredWorkoutStyle.join(', ') || 'unknown'}
Dislikes: ${profile.dislikedExercises.join(', ') || 'none'}
Motivation style that works: ${profile.motivationStyle ?? 'still learning'}
Recurring struggles: ${profile.struggles.join(', ') || 'none noted'}
Notable wins: ${profile.wins.slice(-3).join(', ') || 'none yet'}
Personal details: ${profile.personalDetails.join('; ') || 'none yet'}
Coach observations: ${profile.coachNotes.slice(-5).join('; ') || 'none yet'}
Last session: ${profile.lastSessionSummary ?? 'n/a'}
${healthContext}
${nutritionContext}

USE THIS PROFILE. Use their name. Reference past struggles and wins. Don't ask what you already know. Feel continuous.`.trim();

  return `You are Forge, an elite AI personal trainer and nutrition coach. You build real ongoing relationships with users.

${profileBlock}

PERSONALITY: Direct and real. Motivating without being fake. You remember everything. You push when needed, back off when needed. Reference things they have told you. Notice patterns. Grow with them.

STYLE:
- Short punchy paragraphs for mobile reading
- Use their name occasionally, not every message
- Reference health data naturally ("You are sitting at 4,200 steps, let us change that")
- Celebrate wins genuinely
- When suggesting workouts: include sets x reps with rest times
- When suggesting meals: include rough macros (P/C/F grams)
- When calorie context is available, factor it into nutrition advice
- Acknowledge personal things they share before pivoting to fitness

INFO GATHERING: Weave missing questions in naturally. One at a time. Never interrogate.`;
}

// ─── Memory extraction ─────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a memory extraction system for Forge, an AI fitness coach. Extract ALL new information from the conversation and return ONLY a valid JSON object with fields to UPDATE.

Available fields:
- name (string)
- age (number)
- fitnessLevel ("beginner"|"intermediate"|"advanced")
- primaryGoal ("lose_weight"|"build_muscle"|"endurance"|"general_fitness")
- secondaryGoals (array - NEW items only)
- equipment (array - NEW items only)
- availableDays (number)
- sessionLengthMin (number)
- injuries (array - NEW items only)
- limitations (array - NEW items only)
- dietaryRestrictions (array - NEW items only)
- preferredWorkoutStyle (array - NEW items only)
- dislikedExercises (array - NEW items only)
- favoriteFoods (array - NEW items only)
- motivationStyle ("tough_love"|"gentle"|"data_driven"|"hype")
- struggles (array - NEW themes only)
- wins (array - NEW achievements only)
- personalDetails (array - jobs, family, life events - NEW only)
- coachNotes (array - behavioral observations, patterns, what works - NEW only)
- lastSessionSummary (string - 1-2 sentences)
- relationshipStage ("new"|"building"|"established"|"deep" - only upgrade)
- dailyCalorieGoal (number - if explicitly discussed)
- dailyProteinGoal (number - if explicitly discussed)
- dailyCarbGoal (number - if explicitly discussed)
- dailyFatGoal (number - if explicitly discussed)

Rules: Return ONLY valid JSON. No markdown. Only fields with new info. Arrays = new items to append. If nothing new, return {}.`;

export async function extractMemoryUpdate(
  conversation: ChatMessage[],
  currentProfile: UserProfile
): Promise<Partial<UserProfile>> {
  const convo = conversation
    .map(m => `${m.role === 'user' ? 'USER' : 'FORGE'}: ${m.content}`)
    .join('\n\n');

  const profileJson = JSON.stringify({
    name: currentProfile.name,
    sessionCount: currentProfile.sessionCount,
    relationshipStage: currentProfile.relationshipStage,
    fitnessLevel: currentProfile.fitnessLevel,
    primaryGoal: currentProfile.primaryGoal,
    struggles: currentProfile.struggles,
    wins: currentProfile.wins,
  });

  const raw = await callClaude(
    [{ role: 'user', content: `Current profile summary:\n${profileJson}\n\nConversation:\n${convo}` }],
    EXTRACTION_SYSTEM,
    800
  );

  try {
    // Slice from first { to last } to handle any surrounding prose or code fences
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return {};
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch {
    return {};
  }
}

// ─── Nutrition parsing ─────────────────────────────────────────────────────────

const NUTRITION_PARSE_SYSTEM = `You are a nutrition data assistant. Parse the user's food description and return ONLY a JSON object with these fields:
{
  "name": string,
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "servingSize": number,
  "servingUnit": string
}
Be accurate. Use standard nutritional databases. Return only JSON, no explanation.`;

export async function parseNaturalLanguageFood(description: string): Promise<{
  name: string; calories: number; protein: number; carbs: number; fat: number;
  servingSize: number; servingUnit: string;
} | null> {
  try {
    const raw = await callClaude(
      [{ role: 'user', content: description }],
      NUTRITION_PARSE_SYSTEM,
      300
    );
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

export { callClaude };
