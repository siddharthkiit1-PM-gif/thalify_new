import { describe, it, expect } from "vitest";
import { matchTrigger } from "./rules";
import { mockUserState, mockEvent } from "../__fixtures__/nudges";

describe("matchTrigger", () => {
  it("post-dinner within budget → hydration/post-dinner-within-budget", () => {
    const event = mockEvent("meal_logged", { mealType: "dinner", totalCal: 600 });
    const state = mockUserState({ totalCalToday: 1500, calorieGoal: 1700 });
    expect(matchTrigger(event, state)).toEqual({
      trigger: "post-dinner-within-budget",
      bucket: "hydration",
    });
  });

  it("post-dinner over budget → recovery", () => {
    const event = mockEvent("meal_logged", { mealType: "dinner", totalCal: 800 });
    const state = mockUserState({ totalCalToday: 1900, calorieGoal: 1700 });
    expect(matchTrigger(event, state)?.bucket).toBe("recovery");
  });

  it("heavy lunch (>500 cal) → movement", () => {
    const event = mockEvent("meal_logged", { mealType: "lunch", totalCal: 700 });
    const state = mockUserState({ totalCalToday: 1100, calorieGoal: 1800 });
    expect(matchTrigger(event, state)?.bucket).toBe("movement");
  });

  it("balanced lunch under 500 cal → catchall post-meal-insight", () => {
    const event = mockEvent("meal_logged", { mealType: "lunch", totalCal: 400 });
    const state = mockUserState({ totalCalToday: 800, calorieGoal: 1800 });
    expect(matchTrigger(event, state)).toEqual({
      trigger: "post-meal-insight",
      bucket: "reflection",
    });
  });

  it("scan_completed >600 cal → movement (post-scan-heavy still wins)", () => {
    const event = mockEvent("scan_completed", { totalCal: 700 });
    const state = mockUserState();
    expect(matchTrigger(event, state)?.bucket).toBe("movement");
  });

  it("scan_completed under 600 cal → catchall post-meal-insight", () => {
    const event = mockEvent("scan_completed", { totalCal: 350 });
    const state = mockUserState();
    expect(matchTrigger(event, state)).toEqual({
      trigger: "post-meal-insight",
      bucket: "reflection",
    });
  });

  it("water_check_time → hydration/water-check", () => {
    const event = mockEvent("water_check_time");
    const state = mockUserState();
    expect(matchTrigger(event, state)).toEqual({
      trigger: "water-check",
      bucket: "hydration",
    });
  });

  it("time_breakfast_check with no breakfast → prompt", () => {
    const event = mockEvent("time_breakfast_check");
    const state = mockUserState({ hasBreakfastToday: false });
    expect(matchTrigger(event, state)).toEqual({
      trigger: "breakfast-skipped",
      bucket: "prompt",
    });
  });

  it("time_breakfast_check with breakfast already logged → null", () => {
    const event = mockEvent("time_breakfast_check");
    const state = mockUserState({ hasBreakfastToday: true });
    expect(matchTrigger(event, state)).toBeNull();
  });

  it("streak_milestone with payload.days=3 → praise/streak-3-days", () => {
    const event = mockEvent("streak_milestone", { days: 3 });
    const state = mockUserState();
    expect(matchTrigger(event, state)).toEqual({
      trigger: "streak-3-days",
      bucket: "praise",
    });
  });

  it("time_daily_summary → reflection/daily-recap", () => {
    const event = mockEvent("time_daily_summary");
    const state = mockUserState();
    expect(matchTrigger(event, state)?.bucket).toBe("reflection");
  });

  it("gap_detected → prompt/re-engagement", () => {
    const event = mockEvent("gap_detected");
    const state = mockUserState();
    expect(matchTrigger(event, state)).toEqual({
      trigger: "re-engagement",
      bucket: "prompt",
    });
  });

  it("daily_log_prompt with no meals today → prompt/daily-log-prompt", () => {
    const event = mockEvent("daily_log_prompt");
    const state = mockUserState({
      mealCountToday: 0,
      hasBreakfastToday: false,
      hasLunchToday: false,
      hasDinnerToday: false,
    });
    expect(matchTrigger(event, state)).toEqual({
      trigger: "daily-log-prompt",
      bucket: "prompt",
    });
  });

  it("daily_log_prompt with at least one meal today → null", () => {
    const event = mockEvent("daily_log_prompt");
    const state = mockUserState({ mealCountToday: 1 });
    expect(matchTrigger(event, state)).toBeNull();
  });

  it("food_repetition_detected → prompt/food-repetition", () => {
    const event = mockEvent("food_repetition_detected", { foodName: "paratha" });
    const state = mockUserState();
    expect(matchTrigger(event, state)).toEqual({
      trigger: "food-repetition",
      bucket: "prompt",
    });
  });
});
