import type { MockUserState } from "../__fixtures__/nudges";

const KCAL_PER_KG_FAT = 7700;
const SUSTAINABLE_KG_PER_WEEK = 0.5;

export const IMPLIED_CAL_SAVE: Record<string, number | "delta-today" | "delta-week"> = {
  "post-dinner-within-budget": 150,
  "post-dinner-over-budget": "delta-today",
  "post-meal-heavy": 100,
  "post-scan-heavy": 100,
  "breakfast-skipped": -100,
  "lunch-skipped": -100,
  "dinner-skipped": 0,
  "over-budget-night": "delta-today",
  "daily-recap": 0,
  "streak-3-days": 0,
  "streak-7-days": 0,
  "streak-14-days": 0,
  "streak-30-days": 0,
  "re-engagement": 0,
  "weekly-recap": "delta-week",
};

export type SignalPrediction = {
  savedCalsPerDay: number;
  kg7Days: number;
  kg30Days: number;
  context: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeSignal(
  trigger: string,
  state: MockUserState,
): SignalPrediction | null {
  const impliedRaw = IMPLIED_CAL_SAVE[trigger];
  if (impliedRaw === undefined || impliedRaw === 0) return null;

  if (!state.weightKg || !state.heightCm || !state.age) return null;

  let savedCalsPerDay: number;
  if (impliedRaw === "delta-today") {
    savedCalsPerDay = state.totalCalToday - state.calorieGoal;
    if (savedCalsPerDay <= 0) return null;
  } else if (impliedRaw === "delta-week") {
    savedCalsPerDay = state.totalCalToday - state.calorieGoal;
    if (savedCalsPerDay <= 0) return null;
  } else {
    savedCalsPerDay = impliedRaw;
  }

  const cap7 = SUSTAINABLE_KG_PER_WEEK;
  const cap30 = SUSTAINABLE_KG_PER_WEEK * 4;

  const kg7Days = clamp((savedCalsPerDay * 7) / KCAL_PER_KG_FAT, -cap7, cap7);
  const kg30Days = clamp((savedCalsPerDay * 30) / KCAL_PER_KG_FAT, -cap30, cap30);

  const context =
    state.goal === "gain"
      ? `${Math.abs(savedCalsPerDay)} cal/day toward muscle progress`
      : savedCalsPerDay > 0
        ? `saving ~${savedCalsPerDay} cal/day`
        : `eating ~${Math.abs(savedCalsPerDay)} cal/day more (positive for ${state.goal})`;

  return { savedCalsPerDay, kg7Days, kg30Days, context };
}
