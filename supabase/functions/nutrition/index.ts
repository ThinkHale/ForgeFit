import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const USDA_API_KEY        = Deno.env.get('USDA_API_KEY') ?? '';
const NUTRITIONIX_APP_ID  = Deno.env.get('NUTRITIONIX_APP_ID') ?? '';
const NUTRITIONIX_APP_KEY = Deno.env.get('NUTRITIONIX_APP_KEY') ?? '';
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NutritionResult {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  source: 'usda' | 'nutritionix' | 'openfoodfacts' | 'ai';
  fdcId?: number;
  aiConfidence?: 'researched' | 'estimated';
}

// ─── USDA FoodData Central ────────────────────────────────────────────────────

async function searchUSDA(query: string, limit = 5): Promise<NutritionResult[]> {
  if (!USDA_API_KEY) return [];

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', query);
  url.searchParams.set('api_key', USDA_API_KEY);
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS),Branded');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();

  return (data.foods ?? []).slice(0, limit).map((food: Record<string, unknown>) => {
    const nutrients = (food.foodNutrients as Array<Record<string, unknown>>) ?? [];
    const get = (id: number) =>
      (nutrients.find(n => n.nutrientId === id)?.value as number) ?? 0;

    return {
      name:        food.description as string,
      brand:       (food.brandOwner as string | undefined) ?? (food.brandName as string | undefined),
      calories:    Math.round(get(1008)),
      protein:     Math.round(get(1003) * 10) / 10,
      carbs:       Math.round(get(1005) * 10) / 10,
      fat:         Math.round(get(1004) * 10) / 10,
      servingSize: (food.servingSize as number) ?? 100,
      servingUnit: (food.servingUnit as string) ?? 'g',
      source:      'usda' as const,
      fdcId:       food.fdcId as number,
    };
  });
}

// ─── Nutritionix natural language ─────────────────────────────────────────────

async function parseNutritionix(query: string): Promise<NutritionResult[]> {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_APP_KEY) return [];

  const res = await fetch('https://trackapi.nutritionix.com/v2/natural/nutrients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id':  NUTRITIONIX_APP_ID,
      'x-app-key': NUTRITIONIX_APP_KEY,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.foods ?? []).map((food: Record<string, unknown>) => ({
    name:        food.food_name as string,
    brand:       (food.nix_brand_name as string | undefined) ?? undefined,
    calories:    Math.round((food.nf_calories as number) ?? 0),
    protein:     Math.round(((food.nf_protein as number) ?? 0) * 10) / 10,
    carbs:       Math.round(((food.nf_total_carbohydrate as number) ?? 0) * 10) / 10,
    fat:         Math.round(((food.nf_total_fat as number) ?? 0) * 10) / 10,
    servingSize: (food.serving_qty as number) ?? 1,
    servingUnit: (food.serving_unit as string) ?? 'serving',
    source:      'nutritionix' as const,
  }));
}

// ─── Nutritionix barcode lookup ───────────────────────────────────────────────

async function lookupBarcodeNutritionix(upc: string): Promise<NutritionResult[]> {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_APP_KEY) return [];
  const res = await fetch(`https://trackapi.nutritionix.com/v2/search/item?upc=${encodeURIComponent(upc)}`, {
    headers: { 'x-app-id': NUTRITIONIX_APP_ID, 'x-app-key': NUTRITIONIX_APP_KEY },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.foods ?? []).map((food: Record<string, unknown>) => ({
    name:        food.food_name as string,
    brand:       (food.nix_brand_name as string | undefined) ?? undefined,
    calories:    Math.round((food.nf_calories as number) ?? 0),
    protein:     Math.round(((food.nf_protein as number) ?? 0) * 10) / 10,
    carbs:       Math.round(((food.nf_total_carbohydrate as number) ?? 0) * 10) / 10,
    fat:         Math.round(((food.nf_total_fat as number) ?? 0) * 10) / 10,
    servingSize: (food.serving_qty as number) ?? 1,
    servingUnit: (food.serving_unit as string) ?? 'serving',
    source:      'nutritionix' as const,
  }));
}

async function lookupBarcodeUSDA(upc: string): Promise<NutritionResult[]> {
  if (!USDA_API_KEY) return [];
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', upc);
  url.searchParams.set('api_key', USDA_API_KEY);
  url.searchParams.set('pageSize', '3');
  url.searchParams.set('dataType', 'Branded');
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  return (data.foods ?? []).slice(0, 3).map((food: Record<string, unknown>) => {
    const nutrients = (food.foodNutrients as Array<Record<string, unknown>>) ?? [];
    const get = (id: number) => (nutrients.find(n => n.nutrientId === id)?.value as number) ?? 0;
    return {
      name:        food.description as string,
      brand:       (food.brandOwner as string | undefined) ?? (food.brandName as string | undefined),
      calories:    Math.round(get(1008)),
      protein:     Math.round(get(1003) * 10) / 10,
      carbs:       Math.round(get(1005) * 10) / 10,
      fat:         Math.round(get(1004) * 10) / 10,
      servingSize: (food.servingSize as number) ?? 100,
      servingUnit: (food.servingUnit as string) ?? 'g',
      source:      'usda' as const,
      fdcId:       food.fdcId as number,
    };
  });
}

// ─── Open Food Facts (free, no key required) ─────────────────────────────────

async function lookupBarcodeOpenFoodFacts(upc: string): Promise<NutritionResult[]> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json`);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== 1 || !data.product) return [];

  const p = data.product;
  const n = p.nutriments ?? {};
  const hasServing = !!p.serving_quantity;

  const cal   = Number(hasServing ? (n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0) : (n['energy-kcal_100g'] ?? 0));
  const prot  = Number(hasServing ? (n['proteins_serving']      ?? n['proteins_100g']      ?? 0) : (n['proteins_100g']      ?? 0));
  const carbs = Number(hasServing ? (n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0) : (n['carbohydrates_100g'] ?? 0));
  const fat   = Number(hasServing ? (n['fat_serving']           ?? n['fat_100g']           ?? 0) : (n['fat_100g']           ?? 0));

  const name  = String(p.product_name_en || p.product_name || p.generic_name || 'Unknown Product');
  const brand = (p.brands as string | undefined)?.split(',')[0]?.trim();
  const servingUnit = String(p.serving_size ?? '').replace(/^[\d.,\s]+/, '').trim() || 'g';

  return [{
    name,
    brand: brand ?? undefined,
    calories:    Math.round(cal || 0),
    protein:     Math.round((prot  || 0) * 10) / 10,
    carbs:       Math.round((carbs || 0) * 10) / 10,
    fat:         Math.round((fat   || 0) * 10) / 10,
    servingSize: Number(p.serving_quantity) || 100,
    servingUnit,
    source:      'openfoodfacts' as const,
  }];
}

// ─── Claude AI fallback ───────────────────────────────────────────────────────

async function askClaude(query: string): Promise<NutritionResult[]> {
  if (!ANTHROPIC_API_KEY) return [];

  const prompt = `You are a nutrition database. The user searched for: "${query}"

This food was not found in USDA or Nutritionix databases. Provide nutritional data using:
1. Published nutrition data if you know it (e.g. USDA, manufacturer info, nutrition labels)
2. A reasonable estimate based on similar foods and typical preparation if exact data is unavailable

Respond with ONLY a JSON array of 1-3 results (most relevant first). Each object must have exactly these fields:
{
  "name": "Descriptive food name",
  "calories": 000,
  "protein": 0.0,
  "carbs": 0.0,
  "fat": 0.0,
  "servingSize": 100,
  "servingUnit": "g",
  "confidence": "researched" or "estimated"
}

Rules:
- calories: integer (kcal per serving)
- protein/carbs/fat: one decimal place (grams per serving)
- servingSize + servingUnit: typical serving (e.g. 100 g, 1 cup, 1 piece)
- confidence: "researched" if from known published data, "estimated" if approximated
- No markdown, no explanation, just the JSON array`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '';
  const cleaned = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');

  try {
    const json = JSON.parse(cleaned);
    const items = Array.isArray(json) ? json : [json];
    return items.map((item: Record<string, unknown>) => ({
      name:         String(item.name ?? query),
      calories:     Math.round(Number(item.calories) || 0),
      protein:      Math.round((Number(item.protein) || 0) * 10) / 10,
      carbs:        Math.round((Number(item.carbs) || 0) * 10) / 10,
      fat:          Math.round((Number(item.fat) || 0) * 10) / 10,
      servingSize:  Number(item.servingSize) || 100,
      servingUnit:  String(item.servingUnit ?? 'g'),
      source:       'ai' as const,
      aiConfidence: (item.confidence === 'researched' ? 'researched' : 'estimated') as 'researched' | 'estimated',
    }));
  } catch {
    return [];
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, mode = 'search' } = await req.json();
    if (!query?.trim()) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let results: NutritionResult[] = [];

    if (mode === 'barcode') {
      results = await lookupBarcodeNutritionix(query);
      if (results.length === 0) results = await lookupBarcodeOpenFoodFacts(query);
      if (results.length === 0) results = await lookupBarcodeUSDA(query);
      if (results.length === 0) results = await askClaude(query);
    } else if (mode === 'parse') {
      results = await parseNutritionix(query);
      if (results.length === 0) results = await searchUSDA(query, 5);
      if (results.length === 0) results = await askClaude(query);
    } else if (mode === 'ai') {
      results = await askClaude(query);
    } else {
      results = await searchUSDA(query, 6);
      if (results.length === 0) results = await askClaude(query);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
