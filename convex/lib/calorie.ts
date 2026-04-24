/**
 * Calorie calculation using Mifflin-St Jeor (standard) or Katch-McArdle (when body fat is known).
 * References:
 *   - Mifflin MD et al. 1990. "A new predictive equation for resting energy expenditure in healthy individuals"
 *   - Katch-McArdle "Exercise Physiology" textbook
 *   - Harris-Benedict activity multipliers (1919, widely accepted)
 */

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "diabetes" | "gain";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  diabetes: -300,
  gain: 400,
};

const MIN_SAFE_CALORIES = 1200;

export function calculateBMR(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  bodyFatPct?: number;
}): { bmr: number; method: "mifflin" | "katch" } {
  if (opts.bodyFatPct !== undefined && opts.bodyFatPct > 0 && opts.bodyFatPct < 60) {
    const leanMassKg = opts.weightKg * (1 - opts.bodyFatPct / 100);
    const bmr = 370 + 21.6 * leanMassKg;
    return { bmr: Math.round(bmr), method: "katch" };
  }
  const base = 10 * opts.weightKg + 6.25 * opts.heightCm - 5 * opts.age;
  const bmr = opts.sex === "male" ? base + 5 : base - 161;
  return { bmr: Math.round(bmr), method: "mifflin" };
}

export function calculateTDEE(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  bodyFatPct?: number;
}): { bmr: number; tdee: number; method: "mifflin" | "katch" } {
  const { bmr, method } = calculateBMR(opts);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[opts.activityLevel]);
  return { bmr, tdee, method };
}

export function calculateTarget(tdee: number, goal: Goal): number {
  const target = tdee + GOAL_ADJUSTMENTS[goal];
  return Math.max(MIN_SAFE_CALORIES, Math.round(target));
}
