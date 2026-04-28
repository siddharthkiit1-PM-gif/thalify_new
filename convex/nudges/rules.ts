import type { MockUserState, MockEvent } from "../__fixtures__/nudges";

export type Bucket =
  | "hydration"
  | "movement"
  | "praise"
  | "recovery"
  | "prompt"
  | "reflection"
  | "plan";

export type TriggerMatch = { trigger: string; bucket: Bucket };

const HEAVY_MEAL_CAL = 500;
const HEAVY_SCAN_CAL = 600;

export function matchTrigger(event: MockEvent, state: MockUserState): TriggerMatch | null {
  switch (event.type) {
    case "meal_logged": {
      const mealType = event.payload?.mealType as string | undefined;
      const totalCal = (event.payload?.totalCal as number) ?? 0;
      const projectedTotal = state.totalCalToday;
      const target = state.calorieGoal;

      if (mealType === "dinner") {
        if (projectedTotal > target) {
          return { trigger: "post-dinner-over-budget", bucket: "recovery" };
        }
        return { trigger: "post-dinner-within-budget", bucket: "hydration" };
      }
      if ((mealType === "breakfast" || mealType === "lunch") && totalCal > HEAVY_MEAL_CAL) {
        return { trigger: "post-meal-heavy", bucket: "movement" };
      }
      return null;
    }

    case "scan_completed": {
      const totalCal = (event.payload?.totalCal as number) ?? 0;
      if (totalCal > HEAVY_SCAN_CAL) {
        return { trigger: "post-scan-heavy", bucket: "movement" };
      }
      return null;
    }

    case "time_breakfast_check":
      return state.hasBreakfastToday
        ? null
        : { trigger: "breakfast-skipped", bucket: "prompt" };
    case "time_lunch_check":
      return state.hasLunchToday
        ? null
        : { trigger: "lunch-skipped", bucket: "prompt" };
    case "time_dinner_check":
      return state.hasDinnerToday
        ? null
        : { trigger: "dinner-skipped", bucket: "prompt" };

    case "time_daily_summary":
      return { trigger: "daily-recap", bucket: "reflection" };

    case "streak_milestone": {
      const days = event.payload?.days as number | undefined;
      if (days === 3) return { trigger: "streak-3-days", bucket: "praise" };
      if (days === 7) return { trigger: "streak-7-days", bucket: "praise" };
      if (days === 14) return { trigger: "streak-14-days", bucket: "praise" };
      if (days === 30) return { trigger: "streak-30-days", bucket: "praise" };
      return null;
    }

    case "gap_detected":
      return { trigger: "re-engagement", bucket: "prompt" };

    case "daily_log_prompt":
      // Only nudge if the user hasn't logged anything today.
      // If they already logged a meal, the daily prompt is silent — no spam.
      return state.mealCountToday === 0
        ? { trigger: "daily-log-prompt", bucket: "prompt" }
        : null;

    case "food_repetition_detected":
      return { trigger: "food-repetition", bucket: "prompt" };

    case "upgrade_prompt":
      return { trigger: "upgrade-prompt", bucket: "plan" };

    case "weekly_insight":
      return { trigger: "weekly-recap", bucket: "reflection" };

    default:
      return null;
  }
}
