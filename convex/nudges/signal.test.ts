import { describe, it, expect } from "vitest";
import { computeSignal } from "./signal";
import { mockUserState } from "../__fixtures__/nudges";

describe("computeSignal", () => {
  it("post-dinner-within-budget: 150 cal/day → ~0.59 kg in 30 days", () => {
    const sig = computeSignal("post-dinner-within-budget", mockUserState());
    expect(sig?.savedCalsPerDay).toBe(150);
    expect(sig?.kg30Days).toBeCloseTo(0.585, 2);
    expect(sig?.kg7Days).toBeCloseTo(0.136, 2);
  });

  it("returns null when user has no body stats (no TDEE)", () => {
    const state = mockUserState({ weightKg: undefined, heightCm: undefined, age: undefined });
    const sig = computeSignal("post-dinner-within-budget", state);
    expect(sig).toBeNull();
  });

  it("returns null when impliedCalSave is 0 (e.g., daily-recap)", () => {
    const sig = computeSignal("daily-recap", mockUserState());
    expect(sig).toBeNull();
  });

  it("flips framing for goal=gain (positive cal save framed as muscle progress)", () => {
    const state = mockUserState({ goal: "gain" });
    const sig = computeSignal("post-meal-heavy", state);
    expect(sig?.context).toMatch(/muscle|progress|gain/i);
  });

  it("caps kg7Days at 0.5 (sustainable rate)", () => {
    const state = mockUserState({ totalCalToday: 4000, calorieGoal: 1500 });
    const sig = computeSignal("post-dinner-over-budget", state);
    if (sig) {
      expect(sig.kg7Days).toBeLessThanOrEqual(0.5);
      expect(sig.kg30Days).toBeLessThanOrEqual(2.0);
    }
  });

  it("post-dinner-over-budget uses today's delta", () => {
    const state = mockUserState({ totalCalToday: 1900, calorieGoal: 1700 });
    const sig = computeSignal("post-dinner-over-budget", state);
    expect(sig?.savedCalsPerDay).toBe(200);
    expect(sig?.kg30Days).toBeCloseTo(0.78, 1);
  });
});
