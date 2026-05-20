import { supabase } from './supabase';

export interface NutritionResult {
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

/** Keyword search — good for browsing, e.g. "chicken breast" */
export async function searchFood(query: string): Promise<NutritionResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.functions.invoke('nutrition', {
    body: { query, mode: 'search' },
  });
  if (error || data?.error) {
    console.warn('[Nutrition] searchFood failed:', error ?? data?.error);
    return [];
  }
  return (data?.results as NutritionResult[]) ?? [];
}

/** Barcode/UPC lookup — returns the specific product matching that barcode. */
export async function lookupBarcode(upc: string): Promise<NutritionResult[]> {
  if (!upc.trim()) return [];
  const { data, error } = await supabase.functions.invoke('nutrition', {
    body: { query: upc, mode: 'barcode' },
  });
  if (error || data?.error) {
    console.warn('[Nutrition] lookupBarcode failed:', error ?? data?.error);
    return [];
  }
  return (data?.results as NutritionResult[]) ?? [];
}

/** Natural language parse — good for descriptions, e.g. "2 scrambled eggs with cheese"
 *  Uses Nutritionix when available, falls back to USDA keyword search. */
export async function parseFood(description: string): Promise<NutritionResult[]> {
  if (!description.trim()) return [];
  const { data, error } = await supabase.functions.invoke('nutrition', {
    body: { query: description, mode: 'parse' },
  });
  if (error || data?.error) {
    console.warn('[Nutrition] parseFood failed:', error ?? data?.error);
    return [];
  }
  return (data?.results as NutritionResult[]) ?? [];
}
