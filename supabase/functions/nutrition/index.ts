import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const USDA_API_KEY        = Deno.env.get('USDA_API_KEY') ?? '';
const NUTRITIONIX_APP_ID  = Deno.env.get('NUTRITIONIX_APP_ID') ?? '';
const NUTRITIONIX_APP_KEY = Deno.env.get('NUTRITIONIX_APP_KEY') ?? '';

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
  source: 'usda' | 'nutritionix';
  fdcId?: number;
}

// ─── USDA FoodData Central ────────────────────────────────────────────────────

async function searchUSDA(query: string, limit = 5): Promise<NutritionResult[]> {
  if (!USDA_API_KEY) return [];

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', query);
  url.searchParams.set('api_key', USDA_API_KEY);
  url.searchParams.set('pageSize', String(limit));
  // Include all data types for broad coverage
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS),Branded');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();

  return (data.foods ?? []).slice(0, limit).map((food: Record<string, unknown>) => {
    const nutrients = (food.foodNutrients as Array<Record<string, unknown>>) ?? [];
    const get = (id: number) =>
      (nutrients.find(n => n.nutrientId === id)?.value as number) ?? 0;

    // USDA nutrient IDs: 1008=Energy, 1003=Protein, 1005=Carbs, 1004=Fat
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
// Activates automatically once NUTRITIONIX_APP_ID and NUTRITIONIX_APP_KEY
// are set as Edge Function secrets:
//   supabase secrets set NUTRITIONIX_APP_ID=...
//   supabase secrets set NUTRITIONIX_APP_KEY=...

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
      if (results.length === 0) results = await lookupBarcodeUSDA(query);
    } else if (mode === 'parse') {
      // Natural language: Nutritionix preferred (understands "2 scrambled eggs"),
      // falls back to USDA keyword search when Nutritionix isn't configured yet.
      results = await parseNutritionix(query);
      if (results.length === 0) results = await searchUSDA(query, 5);
    } else {
      // Keyword search: USDA is primary source
      results = await searchUSDA(query, 6);
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
