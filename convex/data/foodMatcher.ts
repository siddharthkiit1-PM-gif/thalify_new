import { INDIAN_FOODS, FOOD_ALIASES } from "./indianFoods";
import type { FoodEntry } from "./indianFoods";

export type FoodMatch = FoodEntry & { key: string; matched: boolean };

const FALLBACK: FoodMatch = {
  key: "unknown",
  cal: 200, protein: 7, carbs: 25, fat: 7,
  category: "carb",
  portion: "1 serving (approximate)",
  matched: false,
};

function normalize(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
}

export function matchDish(name: string): FoodMatch {
  const normalized = normalize(name);

  if (INDIAN_FOODS[normalized]) {
    return { ...INDIAN_FOODS[normalized], key: normalized, matched: true };
  }

  if (FOOD_ALIASES[normalized]) {
    const canonical = FOOD_ALIASES[normalized];
    if (INDIAN_FOODS[canonical]) {
      return { ...INDIAN_FOODS[canonical], key: canonical, matched: true };
    }
  }

  const simpleKey = normalized.replace(/_/g, "");
  for (const [key, entry] of Object.entries(INDIAN_FOODS)) {
    if (key.replace(/_/g, "") === simpleKey) {
      return { ...entry, key, matched: true };
    }
  }

  const tokens = normalized.split("_").filter(t => t.length >= 3);
  for (const [key, entry] of Object.entries(INDIAN_FOODS)) {
    for (const token of tokens) {
      if (key.includes(token) || token.includes(key)) {
        return { ...entry, key, matched: true };
      }
    }
  }

  return { ...FALLBACK, key: normalized };
}
