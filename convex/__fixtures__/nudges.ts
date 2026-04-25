// Test fixtures for nudge engine. Pure data — no side effects.

import type { Id } from "../_generated/dataModel";

export type MockUserState = {
  userId: Id<"users">;
  name: string;
  goal: "lose" | "maintain" | "diabetes" | "gain";
  dietType: "veg" | "veg_eggs" | "nonveg" | "jain" | "vegan";
  calorieGoal: number;
  weightKg?: number;
  heightCm?: number;
  age?: number;
  totalCalToday: number;
  mealCountToday: number;
  hasBreakfastToday: boolean;
  hasLunchToday: boolean;
  hasDinnerToday: boolean;
  notifsLast24h: number;
  lastBucketTimestamps: Record<string, number>;
  whatsappOptIn: boolean;
  whatsappNumber?: string;
};

export function mockUserState(overrides: Partial<MockUserState> = {}): MockUserState {
  return {
    userId: "users:fake_user_id" as Id<"users">,
    name: "Saumya",
    goal: "lose",
    dietType: "veg",
    calorieGoal: 1500,
    weightKg: 65,
    heightCm: 165,
    age: 30,
    totalCalToday: 1200,
    mealCountToday: 3,
    hasBreakfastToday: true,
    hasLunchToday: true,
    hasDinnerToday: false,
    notifsLast24h: 0,
    lastBucketTimestamps: {},
    whatsappOptIn: false,
    ...overrides,
  };
}

export type MockEvent = {
  type:
    | "meal_logged" | "scan_completed"
    | "time_breakfast_check" | "time_lunch_check" | "time_dinner_check"
    | "time_daily_summary" | "streak_milestone" | "gap_detected" | "weekly_insight";
  payload?: Record<string, unknown>;
  createdAt: number;
};

export function mockEvent(type: MockEvent["type"], payload: Record<string, unknown> = {}): MockEvent {
  return { type, payload, createdAt: Date.now() };
}

export type MockTemplate = {
  bucket: string;
  trigger: string;
  variant: string;
  template: string;
  weight: number;
};

export function mockTemplate(overrides: Partial<MockTemplate> = {}): MockTemplate {
  return {
    bucket: "hydration",
    trigger: "post-dinner-within-budget",
    variant: "pdw-v1",
    template: "Dinner done, {name}. Water now beats food cravings.",
    weight: 1.0,
    ...overrides,
  };
}
