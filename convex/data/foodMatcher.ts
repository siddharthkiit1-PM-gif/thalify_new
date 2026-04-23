import { INDIAN_FOODS, FoodEntry } from "./indianFoods";

export type FoodMatch = FoodEntry & { key: string; matched: boolean };

const FALLBACK: FoodMatch = {
  key: "unknown",
  cal: 200, protein: 7, carbs: 25, fat: 7,
  category: "carb",
  matched: false,
};

export function matchDish(name: string): FoodMatch {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");
  if (INDIAN_FOODS[normalized]) {
    return { ...INDIAN_FOODS[normalized], key: normalized, matched: true };
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
