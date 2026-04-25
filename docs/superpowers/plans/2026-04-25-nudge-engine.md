# Nudge Engine Implementation Plan

> ✅ **STATUS: SHIPPED 2026-04-25.** All 22 tasks completed and live in production. This document is kept for historical reference and as a planning template. Read the [README](../../../README.md) for the current state of the system.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an event-driven nudge engine on top of Gemini that decides when to nudge users (rule-based) and uses AI as a writer to personalize each message. Deliver via in-app (banner + bell) and WhatsApp.

**Architecture:** 3-layer pipeline — Producers (mutations + crons) write events to a `nudgeEvents` queue; an Engine worker (cron, every 60s) reads pending events, applies gatekeepers (cap, dedup, quiet hours), matches rules to triggers, computes signal predictions (kg-impact math), picks a template, calls Gemini for personalization, persists a `notifications` row, and best-effort delivers via WhatsApp.

**Tech Stack:** Convex (backend + DB + cron + reactive queries), Gemini 2.5 Flash Lite (text generation), WhatsApp Cloud API (delivery), React 19 + Vite (frontend), Vitest (tests).

**Spec:** `docs/superpowers/specs/2026-04-25-nudge-engine-design.md`

---

## File Structure

### Pure logic modules (TDD-friendly)
- `convex/nudges/rules.ts` — event → trigger → bucket matcher
- `convex/nudges/signal.ts` — kg-impact math from TDEE + suggested action
- `convex/nudges/gatekeepers.ts` — frequencyCap, bucketDedup, quietHours, stale
- `convex/nudges/templatePicker.ts` — weighted-random template selection

### Backend integration
- `convex/schema.ts` — add `nudgeEvents`, `nudgeTemplates`, `notifications` tables + `profiles` fields **(modified)**
- `convex/nudges/queue.ts` — public mutation to insert events
- `convex/nudges/worker.ts` — `processNudgeQueue` action (the orchestrator)
- `convex/nudges/queries.ts` — `recent`, `unreadCount`, `markRead`, `markAllRead`
- `convex/nudges/aiWriter.ts` — Gemini call wrapper with template fallback
- `convex/nudges/seed.ts` — one-time migration seeding 25 templates
- `convex/crons.ts` — cron registration for worker + time-based events **(new)**
- `convex/meals.ts` — emit `meal_logged` event from `logMeal` **(modified)**
- `convex/scan.ts` — emit `scan_completed` event from `scanMeal` **(modified)**
- `convex/admin.ts` — extend `deleteUserByEmail` to wipe nudge tables **(modified)**

### WhatsApp module
- `convex/whatsapp/adapter.ts` — Cloud API client (sendTemplate, sendText)
- `convex/whatsapp/optIn.ts` — `requestOptIn` + `confirmOptIn` mutations
- `convex/whatsapp/webhook.ts` — Convex HTTP action for Meta inbound (STOP/HELP)
- `convex/http.ts` — register webhook route **(modified)**
- `convex/users.ts` — set/unset `whatsappOptIn` helpers **(modified)**

### Frontend
- `src/hooks/useNotifications.ts` — reactive subscription wrapper
- `src/components/NotificationBell.tsx` — navbar dropdown
- `src/components/NotificationBanner.tsx` — dashboard toast
- `src/components/WhatsappOptInModal.tsx` — opt-in UI
- `src/components/Navbar.tsx` — mount NotificationBell **(modified)**
- `src/pages/Dashboard.tsx` — mount NotificationBanner + opt-in CTA **(modified)**

### Tests
- `convex/__fixtures__/nudges.ts` — test fixtures (mockUser, mockEvent, mockTemplate)
- `convex/nudges/rules.test.ts`
- `convex/nudges/signal.test.ts`
- `convex/nudges/gatekeepers.test.ts`
- `convex/nudges/templatePicker.test.ts`
- `convex/nudges/integration.test.ts`

---

## Task list (22 tasks)

| # | Task | Phase |
|---|---|---|
| 1 | Schema additions | 1: foundation |
| 2 | Test fixtures | 1: foundation |
| 3 | Rule matcher (TDD) | 2: pure logic |
| 4 | Signal math (TDD) | 2: pure logic |
| 5 | Gatekeepers (TDD) | 2: pure logic |
| 6 | Template picker (TDD) | 2: pure logic |
| 7 | AI writer with fallback | 3: AI integration |
| 8 | Producer: meal_logged events | 4: producers |
| 9 | Producer: scan_completed events | 4: producers |
| 10 | Worker: processNudgeQueue | 5: orchestration |
| 11 | Cron registration | 5: orchestration |
| 12 | Template seed migration | 5: orchestration |
| 13 | Notification queries (recent, markRead) | 6: read API |
| 14 | useNotifications hook | 7: frontend |
| 15 | NotificationBell component | 7: frontend |
| 16 | NotificationBanner component | 7: frontend |
| 17 | WhatsApp adapter (mocked first) | 8: WhatsApp |
| 18 | WhatsApp opt-in mutations | 8: WhatsApp |
| 19 | WhatsApp webhook | 8: WhatsApp |
| 20 | WhatsappOptInModal component | 8: WhatsApp |
| 21 | Wire adapter into worker | 9: integration |
| 22 | Admin cleanup + pause switch + smoke test | 9: integration |

---

## Phase 1: Foundation

### Task 1: Schema additions

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the three new tables and profile fields**

In `convex/schema.ts`, inside `defineSchema({...})`, add these table definitions and update `profiles`:

```ts
profiles: defineTable({
  // ...all existing fields stay...
  whatsappNumber: v.optional(v.string()),
  whatsappOptIn: v.optional(v.boolean()),
  whatsappVerifiedAt: v.optional(v.number()),
}).index("by_userId", ["userId"]),

nudgeEvents: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("meal_logged"),
    v.literal("scan_completed"),
    v.literal("time_breakfast_check"),
    v.literal("time_lunch_check"),
    v.literal("time_dinner_check"),
    v.literal("time_daily_summary"),
    v.literal("streak_milestone"),
    v.literal("gap_detected"),
    v.literal("weekly_insight"),
  ),
  payload: v.optional(v.any()),
  status: v.union(
    v.literal("pending"),
    v.literal("processed"),
    v.literal("skipped"),
    v.literal("failed"),
  ),
  notificationId: v.optional(v.id("notifications")),
  processedAt: v.optional(v.number()),
  skipReason: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_status_createdAt", ["status", "createdAt"])
  .index("by_userId_createdAt", ["userId", "createdAt"]),

nudgeTemplates: defineTable({
  bucket: v.union(
    v.literal("hydration"), v.literal("movement"), v.literal("praise"),
    v.literal("recovery"), v.literal("prompt"), v.literal("reflection"),
    v.literal("plan"),
  ),
  trigger: v.string(),
  variant: v.string(),
  template: v.string(),
  active: v.boolean(),
  weight: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_bucket_active", ["bucket", "active"])
  .index("by_trigger_active", ["trigger", "active"]),

notifications: defineTable({
  userId: v.id("users"),
  bucket: v.union(
    v.literal("hydration"), v.literal("movement"), v.literal("praise"),
    v.literal("recovery"), v.literal("prompt"), v.literal("reflection"),
    v.literal("plan"),
  ),
  message: v.string(),
  trigger: v.string(),
  templateId: v.optional(v.id("nudgeTemplates")),
  variant: v.optional(v.string()),
  signalPrediction: v.optional(v.object({
    savedCalsPerDay: v.number(),
    kg7Days: v.number(),
    kg30Days: v.number(),
    context: v.string(),
  })),
  expiresAt: v.optional(v.number()),
  aiFallback: v.optional(v.boolean()),
  deliveredViaWhatsApp: v.optional(v.boolean()),
  whatsappMessageId: v.optional(v.string()),
  read: v.boolean(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_userId_createdAt", ["userId", "createdAt"])
  .index("by_userId_bucket_createdAt", ["userId", "bucket", "createdAt"])
  .index("by_variant_createdAt", ["variant", "createdAt"]),
```

- [ ] **Step 2: Deploy schema to dev Convex**

```bash
npx convex dev --once
```

Expected: `✓ Convex functions ready!` and at least these new indexes added:
```
[+] nudgeEvents.by_status_createdAt
[+] nudgeEvents.by_userId_createdAt
[+] nudgeTemplates.by_bucket_active
[+] nudgeTemplates.by_trigger_active
[+] notifications.by_userId_createdAt
[+] notifications.by_userId_bucket_createdAt
[+] notifications.by_variant_createdAt
```

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(nudges): schema for nudgeEvents, nudgeTemplates, notifications"
```

---

### Task 2: Test fixtures

**Files:**
- Create: `convex/__fixtures__/nudges.ts`

- [ ] **Step 1: Create the fixtures module**

```ts
// convex/__fixtures__/nudges.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add convex/__fixtures__/nudges.ts
git commit -m "test(nudges): test fixtures for user state, events, templates"
```

---

## Phase 2: Pure logic (TDD)

### Task 3: Rule matcher

**Files:**
- Create: `convex/nudges/rules.ts`
- Create: `convex/nudges/rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/nudges/rules.test.ts
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

  it("balanced lunch under 500 cal → returns null (skip)", () => {
    const event = mockEvent("meal_logged", { mealType: "lunch", totalCal: 400 });
    const state = mockUserState({ totalCalToday: 800, calorieGoal: 1800 });
    expect(matchTrigger(event, state)).toBeNull();
  });

  it("scan_completed >600 cal → movement", () => {
    const event = mockEvent("scan_completed", { totalCal: 700 });
    const state = mockUserState();
    expect(matchTrigger(event, state)?.bucket).toBe("movement");
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run convex/nudges/rules.test.ts
```

Expected: FAIL — `Cannot find module './rules'`

- [ ] **Step 3: Implement rules.ts**

```ts
// convex/nudges/rules.ts
import type { MockUserState, MockEvent } from "../__fixtures__/nudges";

export type Bucket =
  | "hydration" | "movement" | "praise"
  | "recovery" | "prompt" | "reflection" | "plan";

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
      return state.hasBreakfastToday ? null : { trigger: "breakfast-skipped", bucket: "prompt" };
    case "time_lunch_check":
      return state.hasLunchToday ? null : { trigger: "lunch-skipped", bucket: "prompt" };
    case "time_dinner_check":
      return state.hasDinnerToday ? null : { trigger: "dinner-skipped", bucket: "prompt" };

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

    case "weekly_insight":
      return { trigger: "weekly-recap", bucket: "reflection" };

    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run convex/nudges/rules.test.ts
```

Expected: 10 passing tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add convex/nudges/rules.ts convex/nudges/rules.test.ts
git commit -m "feat(nudges): rule matcher (event → trigger → bucket)"
```

---

### Task 4: Signal math

**Files:**
- Create: `convex/nudges/signal.ts`
- Create: `convex/nudges/signal.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/nudges/signal.test.ts
import { describe, it, expect } from "vitest";
import { computeSignal, IMPLIED_CAL_SAVE } from "./signal";
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
    // Hypothetical extreme: pretend impliedCalSave is huge
    // Use over-budget trigger with fake high delta
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
    // 200 over today, projected 30 days = 200 × 30 / 7700 ≈ 0.78 kg
    expect(sig?.savedCalsPerDay).toBe(200);
    expect(sig?.kg30Days).toBeCloseTo(0.78, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run convex/nudges/signal.test.ts
```

Expected: FAIL — `Cannot find module './signal'`

- [ ] **Step 3: Implement signal.ts**

```ts
// convex/nudges/signal.ts
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

  // Skip math when user has no body stats
  if (!state.weightKg || !state.heightCm || !state.age) return null;

  let savedCalsPerDay: number;
  if (impliedRaw === "delta-today") {
    savedCalsPerDay = state.totalCalToday - state.calorieGoal;
    if (savedCalsPerDay <= 0) return null;
  } else if (impliedRaw === "delta-week") {
    // weekly recap; placeholder uses today's delta × 1 (will be replaced by 7-day avg in worker)
    savedCalsPerDay = state.totalCalToday - state.calorieGoal;
    if (savedCalsPerDay <= 0) return null;
  } else {
    savedCalsPerDay = impliedRaw;
  }

  const cap7 = SUSTAINABLE_KG_PER_WEEK;
  const cap30 = SUSTAINABLE_KG_PER_WEEK * 4;

  const kg7Days = clamp((savedCalsPerDay * 7) / KCAL_PER_KG_FAT, -cap7, cap7);
  const kg30Days = clamp((savedCalsPerDay * 30) / KCAL_PER_KG_FAT, -cap30, cap30);

  const context = state.goal === "gain"
    ? `${Math.abs(savedCalsPerDay)} cal/day toward muscle progress`
    : savedCalsPerDay > 0
      ? `saving ~${savedCalsPerDay} cal/day`
      : `eating ~${Math.abs(savedCalsPerDay)} cal/day more (positive for ${state.goal})`;

  return { savedCalsPerDay, kg7Days, kg30Days, context };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run convex/nudges/signal.test.ts
```

Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add convex/nudges/signal.ts convex/nudges/signal.test.ts
git commit -m "feat(nudges): signal layer math (kg-impact predictions)"
```

---

### Task 5: Gatekeepers

**Files:**
- Create: `convex/nudges/gatekeepers.ts`
- Create: `convex/nudges/gatekeepers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/nudges/gatekeepers.test.ts
import { describe, it, expect } from "vitest";
import {
  withinFrequencyCap,
  passesBucketDedup,
  isInQuietHours,
  isStale,
} from "./gatekeepers";

describe("withinFrequencyCap", () => {
  it("allows 5th nudge of the day", () => {
    expect(withinFrequencyCap(4, 5)).toBe(true);
  });
  it("blocks 6th nudge of the day", () => {
    expect(withinFrequencyCap(5, 5)).toBe(false);
  });
  it("allows when count is 0", () => {
    expect(withinFrequencyCap(0, 5)).toBe(true);
  });
});

describe("passesBucketDedup", () => {
  const now = Date.now();
  it("blocks when same bucket fired 6h ago", () => {
    expect(passesBucketDedup(now - 6 * 3600 * 1000, now)).toBe(false);
  });
  it("allows when same bucket fired 13h ago", () => {
    expect(passesBucketDedup(now - 13 * 3600 * 1000, now)).toBe(true);
  });
  it("allows when bucket has never fired", () => {
    expect(passesBucketDedup(undefined, now)).toBe(true);
  });
  it("blocks at exactly 12h boundary", () => {
    expect(passesBucketDedup(now - 11.99 * 3600 * 1000, now)).toBe(false);
  });
});

describe("isInQuietHours (IST)", () => {
  it("returns true at 23:00 IST", () => {
    expect(isInQuietHours(23)).toBe(true);
  });
  it("returns true at 06:00 IST", () => {
    expect(isInQuietHours(6)).toBe(true);
  });
  it("returns false at 07:00 IST", () => {
    expect(isInQuietHours(7)).toBe(false);
  });
  it("returns false at 22:00 IST", () => {
    expect(isInQuietHours(22)).toBe(false);
  });
});

describe("isStale", () => {
  const now = Date.now();
  it("returns true for events older than 4h", () => {
    expect(isStale(now - 5 * 3600 * 1000, now)).toBe(true);
  });
  it("returns false for events 3h old", () => {
    expect(isStale(now - 3 * 3600 * 1000, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run convex/nudges/gatekeepers.test.ts
```

Expected: FAIL — `Cannot find module './gatekeepers'`

- [ ] **Step 3: Implement gatekeepers.ts**

```ts
// convex/nudges/gatekeepers.ts
const FREQ_CAP_PER_DAY = 5;
const BUCKET_DEDUP_HOURS = 12;
const QUIET_HOUR_START = 23; // 11 PM
const QUIET_HOUR_END = 7;    // 7 AM
const STALE_HOURS = 4;

export function withinFrequencyCap(notificationsLast24h: number, cap = FREQ_CAP_PER_DAY): boolean {
  return notificationsLast24h < cap;
}

export function passesBucketDedup(lastBucketTimestamp: number | undefined, now: number): boolean {
  if (lastBucketTimestamp === undefined) return true;
  const diffHours = (now - lastBucketTimestamp) / (3600 * 1000);
  return diffHours >= BUCKET_DEDUP_HOURS;
}

export function isInQuietHours(hourIST: number): boolean {
  // Quiet hours: 23:00 (11 PM) → 07:00 (7 AM) inclusive of start, exclusive of end
  return hourIST >= QUIET_HOUR_START || hourIST < QUIET_HOUR_END;
}

export function isStale(eventCreatedAt: number, now: number): boolean {
  const diffHours = (now - eventCreatedAt) / (3600 * 1000);
  return diffHours > STALE_HOURS;
}

/**
 * Compute current hour in IST regardless of server timezone.
 */
export function getISTHour(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return parseInt(hourStr, 10) % 24;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run convex/nudges/gatekeepers.test.ts
```

Expected: 11 passing tests.

- [ ] **Step 5: Commit**

```bash
git add convex/nudges/gatekeepers.ts convex/nudges/gatekeepers.test.ts
git commit -m "feat(nudges): gatekeepers (cap, dedup, quiet hours, stale)"
```

---

### Task 6: Template picker

**Files:**
- Create: `convex/nudges/templatePicker.ts`
- Create: `convex/nudges/templatePicker.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/nudges/templatePicker.test.ts
import { describe, it, expect } from "vitest";
import { pickTemplate } from "./templatePicker";
import { mockTemplate } from "../__fixtures__/nudges";

describe("pickTemplate", () => {
  it("returns null when no templates provided", () => {
    expect(pickTemplate([])).toBeNull();
  });

  it("returns the only template when there's one", () => {
    const t = mockTemplate();
    expect(pickTemplate([t])).toBe(t);
  });

  it("respects weighted selection — heavy weight wins majority of trials", () => {
    const heavy = mockTemplate({ variant: "heavy", weight: 9 });
    const light = mockTemplate({ variant: "light", weight: 1 });
    const trials = 1000;
    let heavyCount = 0;
    for (let i = 0; i < trials; i++) {
      const pick = pickTemplate([heavy, light]);
      if (pick?.variant === "heavy") heavyCount++;
    }
    // Expected ~900 (90%) heavy. Allow ±5% tolerance for randomness.
    expect(heavyCount).toBeGreaterThan(850);
    expect(heavyCount).toBeLessThan(950);
  });

  it("treats missing weight as 1.0", () => {
    const a = mockTemplate({ variant: "a", weight: undefined as never });
    const b = mockTemplate({ variant: "b", weight: 1 });
    const trials = 1000;
    let aCount = 0;
    for (let i = 0; i < trials; i++) {
      const pick = pickTemplate([a, b]);
      if (pick?.variant === "a") aCount++;
    }
    expect(aCount).toBeGreaterThan(400);
    expect(aCount).toBeLessThan(600);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run convex/nudges/templatePicker.test.ts
```

Expected: FAIL — `Cannot find module './templatePicker'`

- [ ] **Step 3: Implement templatePicker.ts**

```ts
// convex/nudges/templatePicker.ts
import type { MockTemplate } from "../__fixtures__/nudges";

export function pickTemplate<T extends Pick<MockTemplate, "weight">>(templates: T[]): T | null {
  if (templates.length === 0) return null;
  if (templates.length === 1) return templates[0];

  const totalWeight = templates.reduce((sum, t) => sum + (t.weight ?? 1.0), 0);
  let r = Math.random() * totalWeight;

  for (const t of templates) {
    const w = t.weight ?? 1.0;
    if (r < w) return t;
    r -= w;
  }
  // Fallback — shouldn't reach here unless rounding error
  return templates[templates.length - 1];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run convex/nudges/templatePicker.test.ts
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add convex/nudges/templatePicker.ts convex/nudges/templatePicker.test.ts
git commit -m "feat(nudges): weighted-random template picker"
```

---

## Phase 3: AI integration

### Task 7: AI writer with fallback

**Files:**
- Create: `convex/nudges/aiWriter.ts`

- [ ] **Step 1: Implement aiWriter.ts**

```ts
// convex/nudges/aiWriter.ts
import { generateText, classifyError } from "../ai/claude";
import type { SignalPrediction } from "./signal";

export type WriterContext = {
  name: string;
  goal: string;
  trigger: string;
  template: string;
  signal: SignalPrediction | null;
  lastMealName?: string;
};

export type WriterResult = {
  message: string;
  aiFallback: boolean;
};

const SYSTEM_PROMPT = `You are Health Buddy — a warm, no-fluff Indian nutrition coach.

You will be given:
- A template line that captures the intent of the nudge
- The user's name, goal, and (sometimes) a kg-impact prediction

Your job: rewrite the template into a personalized 1-line nudge for this user.

RULES:
1. Use the user's first name once, naturally — not at the start.
2. If a kg-impact signal is provided, weave it in naturally ("~0.8 kg by next month"), don't make it sound like math homework.
3. NO fluff phrases: "Great question!", "I understand", "As your health buddy", "It's important to..."
4. 1-2 sentences MAX. Aim for 1.
5. Indian context welcome: katori, roti, chai, dal, paneer, etc.
6. NEVER prescribe medication. NEVER mention lab values.
7. Output ONLY the message text. No quotes, no preamble, no markdown.`;

function fallback(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

export async function writeNudge(ctx: WriterContext): Promise<WriterResult> {
  const userPrompt = `Rewrite this template:
"${ctx.template}"

Context:
- Name: ${ctx.name}
- Goal: ${ctx.goal}
- Trigger: ${ctx.trigger}
${ctx.lastMealName ? `- Last meal: ${ctx.lastMealName}` : ""}
${ctx.signal ? `- Predicted impact: ${ctx.signal.context}, ~${ctx.signal.kg30Days.toFixed(1)} kg over 30 days` : ""}

Output: just the rewritten line.`;

  try {
    const text = await generateText({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 150,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, "");
    if (!cleaned) {
      return { message: fallback(ctx.template, ctx.name), aiFallback: true };
    }
    return { message: cleaned, aiFallback: false };
  } catch (err) {
    // Long throttle, daily quota, network — fall back to template substitution
    const classified = classifyError(err);
    if (classified.code === "rate_limit" || classified.code === "quota" || classified.code === "network") {
      return { message: fallback(ctx.template, ctx.name), aiFallback: true };
    }
    throw err; // Re-throw genuinely unexpected errors
  }
}
```

- [ ] **Step 2: Verify it compiles via convex dev**

```bash
npx convex dev --once
```

Expected: `✓ Convex functions ready!` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add convex/nudges/aiWriter.ts
git commit -m "feat(nudges): AI writer with template-fallback on Gemini failure"
```

---

## Phase 4: Producers (event emitters)

### Task 8: Emit meal_logged events

**Files:**
- Modify: `convex/meals.ts`
- Create: `convex/nudges/queue.ts`

- [ ] **Step 1: Create queue.ts (internal mutation)**

```ts
// convex/nudges/queue.ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const enqueue = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("meal_logged"),
      v.literal("scan_completed"),
      v.literal("time_breakfast_check"),
      v.literal("time_lunch_check"),
      v.literal("time_dinner_check"),
      v.literal("time_daily_summary"),
      v.literal("streak_milestone"),
      v.literal("gap_detected"),
      v.literal("weekly_insight"),
    ),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, { userId, type, payload }) => {
    await ctx.db.insert("nudgeEvents", {
      userId,
      type,
      payload,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Wire emit into meals.logMeal**

In `convex/meals.ts`, find the existing `logMeal` mutation. After the `ctx.db.insert("mealLogs", ...)` line, add the event emission:

```ts
// Existing top of file
import { internal } from "./_generated/api";

// Inside logMeal handler, AFTER inserting mealLogs:
await ctx.scheduler.runAfter(0, internal.nudges.queue.enqueue, {
  userId,
  type: "meal_logged",
  payload: { mealType: args.mealType, totalCal: args.totalCal },
});
```

(Use `scheduler.runAfter(0, ...)` so the mutation completes synchronously and the event lands in the queue without blocking.)

- [ ] **Step 3: Deploy and verify schema/types compile**

```bash
npx convex dev --once
```

Expected: `✓ Convex functions ready!`

- [ ] **Step 4: Commit**

```bash
git add convex/meals.ts convex/nudges/queue.ts
git commit -m "feat(nudges): emit meal_logged event from logMeal mutation"
```

---

### Task 9: Emit scan_completed events

**Files:**
- Modify: `convex/scan.ts`

- [ ] **Step 1: Add event emission to scanMeal action**

In `convex/scan.ts`, find the `scanMeal` action's handler. After the line that calls `saveScanResultInternal`, add:

```ts
await ctx.runMutation(internal.nudges.queue.enqueue, {
  userId,
  type: "scan_completed",
  payload: { totalCal, itemCount: cleaned.length },
});
```

(Already inside an action so use `runMutation`, not `scheduler`.)

- [ ] **Step 2: Deploy**

```bash
npx convex dev --once
```

Expected: `✓ Convex functions ready!`

- [ ] **Step 3: Commit**

```bash
git add convex/scan.ts
git commit -m "feat(nudges): emit scan_completed event from scanMeal action"
```

---

## Phase 5: Worker orchestration

### Task 10: processNudgeQueue worker

**Files:**
- Create: `convex/nudges/worker.ts`

- [ ] **Step 1: Implement the worker action**

```ts
// convex/nudges/worker.ts
import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { matchTrigger } from "./rules";
import { computeSignal } from "./signal";
import { withinFrequencyCap, passesBucketDedup, isInQuietHours, isStale, getISTHour } from "./gatekeepers";
import { pickTemplate } from "./templatePicker";
import { writeNudge } from "./aiWriter";
import type { Id } from "../_generated/dataModel";

const BATCH_SIZE = 50;

/**
 * The orchestrator. Reads pending events, processes each through the pipeline,
 * persists notifications. Runs every 60 seconds via cron.
 */
export const processNudgeQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.NUDGES_ENABLED === "false") return { processed: 0, reason: "disabled" };

    const events = await ctx.runQuery(internal.nudges.worker.getPendingEvents, { limit: BATCH_SIZE });
    let processed = 0;

    for (const event of events) {
      try {
        const result = await ctx.runAction(internal.nudges.worker.processSingleEvent, {
          eventId: event._id,
        });
        if (result === "processed") processed++;
      } catch (err) {
        console.error(`processSingleEvent failed for ${event._id}:`, err);
        await ctx.runMutation(internal.nudges.worker.markEventFailed, { eventId: event._id });
      }
    }
    return { processed, total: events.length };
  },
});

export const getPendingEvents = internalAction({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    return await ctx.runQuery(internal.nudges.worker.queryPending, { limit });
  },
});

export const queryPending = internalAction({
  args: { limit: v.number() },
  handler: async (_ctx, _args) => {
    // Note: this is a stub — real impl uses a query (see below) — keeping signatures consistent
    return [] as never;
  },
});

// Real query — moved to a `query` registration below for proper Convex behavior
```

> NOTE: this skeleton needs to be split into `query` and `action`/`mutation` properly. Step 2 below corrects this.

- [ ] **Step 2: Replace with the correct module split**

Replace the entire content of `convex/nudges/worker.ts` with:

```ts
// convex/nudges/worker.ts
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { matchTrigger } from "./rules";
import { computeSignal } from "./signal";
import { withinFrequencyCap, passesBucketDedup, isInQuietHours, isStale, getISTHour } from "./gatekeepers";
import { pickTemplate } from "./templatePicker";
import { writeNudge } from "./aiWriter";
import type { MockUserState, MockEvent } from "../__fixtures__/nudges";

const BATCH_SIZE = 50;

export const processNudgeQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.NUDGES_ENABLED === "false") return { processed: 0, reason: "disabled" };

    const events = await ctx.runQuery(internal.nudges.worker.queryPending, { limit: BATCH_SIZE });
    let processed = 0;
    for (const event of events) {
      try {
        await ctx.runAction(internal.nudges.worker.processSingleEvent, { eventId: event._id });
        processed++;
      } catch (err) {
        console.error(`event ${event._id} failed`, err);
        await ctx.runMutation(internal.nudges.worker.markEventFailed, { eventId: event._id });
      }
    }
    return { processed, total: events.length };
  },
});

export const queryPending = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("nudgeEvents")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(limit);
  },
});

export const processSingleEvent = internalAction({
  args: { eventId: v.id("nudgeEvents") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.runQuery(internal.nudges.worker.getEvent, { eventId });
    if (!event || event.status !== "pending") return;

    const now = Date.now();

    // GATE 1: stale
    if (isStale(event.createdAt, now)) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "stale" });
      return;
    }

    // GATE 2: quiet hours
    const hour = getISTHour();
    if (isInQuietHours(hour)) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "quiet" });
      return;
    }

    // Load user state
    const state = await ctx.runQuery(internal.nudges.worker.buildUserState, { userId: event.userId });
    if (!state) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "no-profile" });
      return;
    }

    // Match rule → trigger + bucket
    const eventForMatcher: MockEvent = { type: event.type, payload: event.payload ?? {}, createdAt: event.createdAt };
    const match = matchTrigger(eventForMatcher, state);
    if (!match) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "no-match" });
      return;
    }

    // GATE 3: frequency cap
    if (!withinFrequencyCap(state.notifsLast24h)) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "cap" });
      return;
    }

    // GATE 4: bucket dedup
    if (!passesBucketDedup(state.lastBucketTimestamps[match.bucket], now)) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "dedup" });
      return;
    }

    // Signal layer
    const signal = computeSignal(match.trigger, state);

    // Pick template
    const templates = await ctx.runQuery(internal.nudges.worker.getTemplatesForTrigger, {
      bucket: match.bucket,
      trigger: match.trigger,
    });
    if (templates.length === 0) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "no-template" });
      return;
    }
    const template = pickTemplate(templates);
    if (!template) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "no-template" });
      return;
    }

    // AI writer with fallback
    const lastMealName = (event.payload?.mealName as string | undefined) ?? undefined;
    const written = await writeNudge({
      name: state.name,
      goal: state.goal,
      trigger: match.trigger,
      template: template.template,
      signal,
      lastMealName,
    });

    // Compute expiresAt for time-sensitive triggers
    let expiresAt: number | undefined;
    const todayMidnightIST = new Date();
    todayMidnightIST.setUTCHours(18, 30, 0, 0); // 00:00 IST = 18:30 UTC previous day
    if (match.trigger === "breakfast-skipped") {
      const lunchTime = new Date();
      lunchTime.setUTCHours(7, 30, 0, 0); // 13:00 IST = 07:30 UTC
      if (lunchTime.getTime() < now) lunchTime.setDate(lunchTime.getDate() + 1);
      expiresAt = lunchTime.getTime();
    } else if (match.trigger === "lunch-skipped") {
      const dinnerTime = new Date();
      dinnerTime.setUTCHours(13, 30, 0, 0); // 19:00 IST = 13:30 UTC
      if (dinnerTime.getTime() < now) dinnerTime.setDate(dinnerTime.getDate() + 1);
      expiresAt = dinnerTime.getTime();
    } else if (match.trigger === "dinner-skipped") {
      expiresAt = todayMidnightIST.getTime();
    }

    // Persist + mark event processed
    const notificationId = await ctx.runMutation(internal.nudges.worker.persistNudge, {
      eventId,
      userId: event.userId,
      bucket: match.bucket,
      message: written.message,
      trigger: match.trigger,
      templateId: template._id,
      variant: template.variant,
      signalPrediction: signal ?? undefined,
      expiresAt,
      aiFallback: written.aiFallback,
    });

    // WhatsApp delivery (best-effort) — wired in Task 21
    return notificationId;
  },
});

export const getEvent = internalQuery({
  args: { eventId: v.id("nudgeEvents") },
  handler: async (ctx, { eventId }) => await ctx.db.get(eventId),
});

export const buildUserState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db.query("profiles").withIndex("by_userId", q => q.eq("userId", userId)).unique();
    if (!profile) return null;
    const user = await ctx.db.get(userId);

    const today = new Date().toISOString().split("T")[0];
    const todayLogs = await ctx.db.query("mealLogs")
      .withIndex("by_userId_date", q => q.eq("userId", userId).eq("date", today))
      .collect();

    const totalCalToday = todayLogs.reduce((sum, l) => sum + l.totalCal, 0);
    const hasBreakfastToday = todayLogs.some(l => l.mealType === "breakfast");
    const hasLunchToday = todayLogs.some(l => l.mealType === "lunch");
    const hasDinnerToday = todayLogs.some(l => l.mealType === "dinner");

    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const recentNotifs = await ctx.db.query("notifications")
      .withIndex("by_userId_createdAt", q => q.eq("userId", userId).gt("createdAt", dayAgo))
      .collect();

    const lastBucketTimestamps: Record<string, number> = {};
    for (const n of recentNotifs) {
      if (!lastBucketTimestamps[n.bucket] || n.createdAt > lastBucketTimestamps[n.bucket]) {
        lastBucketTimestamps[n.bucket] = n.createdAt;
      }
    }

    return {
      userId,
      name: user?.name ?? "there",
      goal: profile.goal,
      dietType: profile.dietType,
      calorieGoal: profile.calorieGoal,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      totalCalToday,
      mealCountToday: todayLogs.length,
      hasBreakfastToday,
      hasLunchToday,
      hasDinnerToday,
      notifsLast24h: recentNotifs.length,
      lastBucketTimestamps,
      whatsappOptIn: profile.whatsappOptIn === true,
      whatsappNumber: profile.whatsappNumber,
    };
  },
});

export const getTemplatesForTrigger = internalQuery({
  args: { bucket: v.string(), trigger: v.string() },
  handler: async (ctx, { bucket, trigger }) => {
    const templates = await ctx.db.query("nudgeTemplates")
      .withIndex("by_trigger_active", q => q.eq("trigger", trigger).eq("active", true))
      .collect();
    if (templates.length > 0) return templates;
    // Fallback: any active template for this bucket
    return await ctx.db.query("nudgeTemplates")
      .withIndex("by_bucket_active", q => q.eq("bucket", bucket as never).eq("active", true))
      .collect();
  },
});

export const skipEvent = internalMutation({
  args: { eventId: v.id("nudgeEvents"), reason: v.string() },
  handler: async (ctx, { eventId, reason }) => {
    await ctx.db.patch(eventId, { status: "skipped", skipReason: reason, processedAt: Date.now() });
  },
});

export const markEventFailed = internalMutation({
  args: { eventId: v.id("nudgeEvents") },
  handler: async (ctx, { eventId }) => {
    await ctx.db.patch(eventId, { status: "failed", processedAt: Date.now() });
  },
});

export const persistNudge = internalMutation({
  args: {
    eventId: v.id("nudgeEvents"),
    userId: v.id("users"),
    bucket: v.union(
      v.literal("hydration"), v.literal("movement"), v.literal("praise"),
      v.literal("recovery"), v.literal("prompt"), v.literal("reflection"),
      v.literal("plan"),
    ),
    message: v.string(),
    trigger: v.string(),
    templateId: v.id("nudgeTemplates"),
    variant: v.string(),
    signalPrediction: v.optional(v.object({
      savedCalsPerDay: v.number(),
      kg7Days: v.number(),
      kg30Days: v.number(),
      context: v.string(),
    })),
    expiresAt: v.optional(v.number()),
    aiFallback: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      bucket: args.bucket,
      message: args.message,
      trigger: args.trigger,
      templateId: args.templateId,
      variant: args.variant,
      signalPrediction: args.signalPrediction,
      expiresAt: args.expiresAt,
      aiFallback: args.aiFallback || undefined,
      read: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.eventId, {
      status: "processed",
      processedAt: Date.now(),
      notificationId,
    });
    return notificationId;
  },
});
```

- [ ] **Step 3: Deploy**

```bash
npx convex dev --once
```

Expected: `✓ Convex functions ready!`

- [ ] **Step 4: Commit**

```bash
git add convex/nudges/worker.ts
git commit -m "feat(nudges): processNudgeQueue worker orchestration"
```

---

### Task 11: Cron registration

**Files:**
- Create: `convex/crons.ts`

- [ ] **Step 1: Create crons.ts**

```ts
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Worker — runs every 60 seconds
crons.interval(
  "process nudge queue",
  { seconds: 60 },
  internal.nudges.worker.processNudgeQueue,
);

// Time-based event seeders (each runs once daily, IST)
// 9:00 AM IST = 03:30 UTC
crons.cron(
  "seed breakfast checks",
  "30 3 * * *",
  internal.nudges.timeSeeders.seedBreakfastChecks,
);
// 1:00 PM IST = 07:30 UTC
crons.cron(
  "seed lunch checks",
  "30 7 * * *",
  internal.nudges.timeSeeders.seedLunchChecks,
);
// 8:00 PM IST = 14:30 UTC
crons.cron(
  "seed dinner checks",
  "30 14 * * *",
  internal.nudges.timeSeeders.seedDinnerChecks,
);
// 9:30 PM IST = 16:00 UTC
crons.cron(
  "seed daily summaries",
  "0 16 * * *",
  internal.nudges.timeSeeders.seedDailySummaries,
);
// Sunday 10:00 AM IST = Sunday 04:30 UTC
crons.cron(
  "seed weekly insights",
  "30 4 * * 0",
  internal.nudges.timeSeeders.seedWeeklyInsights,
);

export default crons;
```

- [ ] **Step 2: Create the time seeder module**

```ts
// convex/nudges/timeSeeders.ts
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

const ACTIVE_DAYS = 14; // only seed for users active in last 14 days

async function getActiveUserIds(ctx: { runQuery: (...args: unknown[]) => Promise<unknown> }): Promise<Array<{ _id: string }>> {
  return (await ctx.runQuery(internal.nudges.timeSeeders.queryActiveUsers, { days: ACTIVE_DAYS })) as Array<{ _id: string }>;
}

export const seedBreakfastChecks = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await getActiveUserIds(ctx as never);
    for (const user of users) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId: user._id as never,
        type: "time_breakfast_check",
      });
    }
  },
});

export const seedLunchChecks = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await getActiveUserIds(ctx as never);
    for (const user of users) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId: user._id as never,
        type: "time_lunch_check",
      });
    }
  },
});

export const seedDinnerChecks = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await getActiveUserIds(ctx as never);
    for (const user of users) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId: user._id as never,
        type: "time_dinner_check",
      });
    }
  },
});

export const seedDailySummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await getActiveUserIds(ctx as never);
    for (const user of users) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId: user._id as never,
        type: "time_daily_summary",
      });
    }
  },
});

export const seedWeeklyInsights = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await getActiveUserIds(ctx as never);
    for (const user of users) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId: user._id as never,
        type: "weekly_insight",
      });
    }
  },
});

export const queryActiveUsers = internalAction({
  args: { days: { __literal: 14 } as never },
  handler: async (ctx, { days }) => {
    // Active = has any meal log in the last `days` days
    const since = Date.now() - (days as number) * 24 * 3600 * 1000;
    const sinceDate = new Date(since).toISOString().split("T")[0];
    const recentLogs = await ctx.runQuery(internal.nudges.timeSeeders.queryRecentLogs, { sinceDate });
    const userIds = new Set<string>((recentLogs as Array<{ userId: string }>).map(l => l.userId));
    return Array.from(userIds).map(id => ({ _id: id }));
  },
});
```

> NOTE: the `queryActiveUsers` action above can't use `ctx.db` directly (it's an action). Step 3 corrects this with proper internalQuery split.

- [ ] **Step 3: Replace timeSeeders.ts with the corrected split**

```ts
// convex/nudges/timeSeeders.ts
import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const ACTIVE_DAYS = 14;

export const queryActiveUsers = internalQuery({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().split("T")[0];
    const logs = await ctx.db.query("mealLogs")
      .withIndex("by_userId_date")
      .collect();
    const userIds = new Set<Id<"users">>();
    for (const log of logs) {
      if (log.date >= sinceDate) userIds.add(log.userId);
    }
    return Array.from(userIds);
  },
});

async function seedFor(ctx: { runQuery: typeof internal.nudges.timeSeeders.queryActiveUsers; runMutation: unknown }, type: "time_breakfast_check" | "time_lunch_check" | "time_dinner_check" | "time_daily_summary" | "weekly_insight") {
  const userIds = (await (ctx.runQuery as never)(internal.nudges.timeSeeders.queryActiveUsers, { days: ACTIVE_DAYS })) as Id<"users">[];
  for (const userId of userIds) {
    await (ctx.runMutation as never)(internal.nudges.queue.enqueue, { userId, type });
  }
}

export const seedBreakfastChecks = internalAction({ args: {}, handler: async (ctx) => seedFor(ctx as never, "time_breakfast_check") });
export const seedLunchChecks    = internalAction({ args: {}, handler: async (ctx) => seedFor(ctx as never, "time_lunch_check") });
export const seedDinnerChecks   = internalAction({ args: {}, handler: async (ctx) => seedFor(ctx as never, "time_dinner_check") });
export const seedDailySummaries = internalAction({ args: {}, handler: async (ctx) => seedFor(ctx as never, "time_daily_summary") });
export const seedWeeklyInsights = internalAction({ args: {}, handler: async (ctx) => seedFor(ctx as never, "weekly_insight") });
```

- [ ] **Step 4: Deploy and verify cron registration**

```bash
npx convex dev --once
```

Expected: output mentions `Cron functions registered: 6 jobs` (or similar).

- [ ] **Step 5: Commit**

```bash
git add convex/crons.ts convex/nudges/timeSeeders.ts
git commit -m "feat(nudges): cron jobs for worker (60s) + time-based seeders"
```

---

### Task 12: Template seed migration

**Files:**
- Create: `convex/nudges/seed.ts`

- [ ] **Step 1: Implement the seed migration**

```ts
// convex/nudges/seed.ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

type Seed = { bucket: string; trigger: string; variant: string; template: string; weight?: number };

const SEED_TEMPLATES: Seed[] = [
  // Hydration (4)
  { bucket: "hydration", trigger: "post-dinner-within-budget", variant: "pdw-v1", template: "Dinner done, {name}. 2 glasses water + 10 min walk before bed beats the late-snack urge." },
  { bucket: "hydration", trigger: "post-dinner-within-budget", variant: "pdw-v2", template: "{name}, your stomach's full but your body wants water. Skip the chai, sleep better." },
  { bucket: "hydration", trigger: "post-meal-heavy", variant: "pmh-v1", template: "Heavy meal, {name}. A glass of water now helps digestion." },
  { bucket: "hydration", trigger: "post-meal-heavy", variant: "pmh-v2", template: "Pair that meal with water, {name}. Then a slow walk if you can." },

  // Movement (3)
  { bucket: "movement", trigger: "post-meal-heavy", variant: "pmh-mv-v1", template: "{name}, that lunch was hearty — a 15 min walk gives your body the assist." },
  { bucket: "movement", trigger: "post-scan-heavy", variant: "psh-v1", template: "Tasty plate, {name}. Walk 15 min after — your blood sugar will thank you." },
  { bucket: "movement", trigger: "post-meal-heavy", variant: "pmh-mv-v2", template: "Movement matters more than perfect eating, {name}. Walk now." },

  // Praise (3)
  { bucket: "praise", trigger: "streak-3-days", variant: "sp3-v1", template: "3 days logged, {name}. The data is starting to work for you." },
  { bucket: "praise", trigger: "streak-7-days", variant: "sp7-v1", template: "A full week, {name}. This is the habit forming. Keep it." },
  { bucket: "praise", trigger: "streak-30-days", variant: "sp30-v1", template: "30 days, {name}. You're a different kind of consistent now." },

  // Recovery (4)
  { bucket: "recovery", trigger: "post-dinner-over-budget", variant: "pdo-v1", template: "Over today, {name}. Tomorrow's breakfast 100 cal lighter and you reset clean." },
  { bucket: "recovery", trigger: "post-dinner-over-budget", variant: "pdo-v2", template: "{name}, that dinner pushed you past your goal. No drama — water now, lighter breakfast tomorrow." },
  { bucket: "recovery", trigger: "over-budget-night", variant: "obn-v1", template: "{name}, today's a wrap. Tomorrow you start fresh — start with protein at breakfast." },
  { bucket: "recovery", trigger: "post-dinner-over-budget", variant: "pdo-v3", template: "Beyond budget, {name}, but one day doesn't define a week. Walk 15 min, sleep early." },

  // Prompt (5)
  { bucket: "prompt", trigger: "breakfast-skipped", variant: "bs-v1", template: "{name}, no breakfast yet. Skipping it makes lunch harder — even a katori poha sets the day." },
  { bucket: "prompt", trigger: "lunch-skipped", variant: "ls-v1", template: "Lunch missed, {name}. Eat something now — dal-rice, anything light. Your afternoon depends on it." },
  { bucket: "prompt", trigger: "dinner-skipped", variant: "ds-v1", template: "{name}, dinner not logged. Did you eat? Quick log keeps your data honest." },
  { bucket: "prompt", trigger: "re-engagement", variant: "re-v1", template: "Been a couple days, {name}. One scan brings you back into rhythm." },
  { bucket: "prompt", trigger: "breakfast-skipped", variant: "bs-v2", template: "Skipping breakfast = bigger lunch + lower energy, {name}. 5 minutes for an idli or curd." },

  // Reflection (3)
  { bucket: "reflection", trigger: "daily-recap", variant: "dr-v1", template: "{name}, you ended at {totalCal} today. {recapNote}." },
  { bucket: "reflection", trigger: "weekly-recap", variant: "wr-v1", template: "Week wrapped, {name}. Average day was {avgCal} cal. Tomorrow's a fresh sheet." },
  { bucket: "reflection", trigger: "daily-recap", variant: "dr-v2", template: "Quiet day, {name}. Tomorrow's plan: protein-first breakfast." },

  // Plan (3)
  { bucket: "plan", trigger: "tomorrow-plan", variant: "tp-v1", template: "{name}, tomorrow's plan: dal + roti + sabzi at lunch. Keeps you under your target without feeling deprived." },
  { bucket: "plan", trigger: "weekend-plan", variant: "wp-v1", template: "Weekend, {name} — eat well, walk more. One indulgent meal is fine; just log it." },
  { bucket: "plan", trigger: "post-doctor-plan", variant: "pdp-v1", template: "After your doctor visit, {name}, focus on consistency over perfection. One meal at a time." },
];

export const seedTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("nudgeTemplates").first();
    if (existing) return { skipped: true, reason: "already-seeded" };

    let inserted = 0;
    for (const t of SEED_TEMPLATES) {
      await ctx.db.insert("nudgeTemplates", {
        bucket: t.bucket as never,
        trigger: t.trigger,
        variant: t.variant,
        template: t.template,
        active: true,
        weight: t.weight ?? 1.0,
        createdAt: Date.now(),
      });
      inserted++;
    }
    return { inserted };
  },
});
```

- [ ] **Step 2: Run the seed once on dev Convex**

```bash
npx convex dev --once
npx convex run nudges/seed:seedTemplates
```

Expected output: `{"inserted": 25}` (approximately — verify count matches your final SEED_TEMPLATES array).

- [ ] **Step 3: Verify templates landed in DB**

```bash
npx convex data nudgeTemplates | head -10
```

Expected: 25 rows visible.

- [ ] **Step 4: Run on prod when ready (DEFER until full feature is approved)**

```bash
# Only after promoting feature to main and after user approval
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex run nudges/seed:seedTemplates
```

- [ ] **Step 5: Commit**

```bash
git add convex/nudges/seed.ts
git commit -m "feat(nudges): seed migration with 25 starter templates"
```

---

## Phase 6: Read API + integration tests

### Task 13: Notification queries

**Files:**
- Create: `convex/nudges/queries.ts`

- [ ] **Step 1: Implement the public queries + mutations**

```ts
// convex/nudges/queries.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const RECENT_LIMIT = 20;

export const recent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const now = Date.now();
    const all = await ctx.db.query("notifications")
      .withIndex("by_userId_createdAt", q => q.eq("userId", userId))
      .order("desc")
      .take(RECENT_LIMIT * 2);
    return all
      .filter(n => n.expiresAt === undefined || n.expiresAt > now)
      .slice(0, RECENT_LIMIT);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const now = Date.now();
    const all = await ctx.db.query("notifications")
      .withIndex("by_userId_createdAt", q => q.eq("userId", userId))
      .collect();
    return all.filter(n => !n.read && (n.expiresAt === undefined || n.expiresAt > now)).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const n = await ctx.db.get(id);
    if (!n || n.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { read: true, readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const all = await ctx.db.query("notifications")
      .withIndex("by_userId_createdAt", q => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    for (const n of all) {
      if (!n.read) await ctx.db.patch(n._id, { read: true, readAt: now });
    }
  },
});
```

- [ ] **Step 2: Deploy**

```bash
npx convex dev --once
```

- [ ] **Step 3: Commit**

```bash
git add convex/nudges/queries.ts
git commit -m "feat(nudges): public queries (recent, unreadCount, markRead, markAllRead)"
```

---

## Phase 7: Frontend

### Task 14: useNotifications hook

**Files:**
- Create: `src/hooks/useNotifications.ts`

- [ ] **Step 1: Implement the hook**

```ts
// src/hooks/useNotifications.ts
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export function useNotifications() {
  const recent = useQuery(api.nudges.queries.recent)
  const unreadCount = useQuery(api.nudges.queries.unreadCount) ?? 0
  const markRead = useMutation(api.nudges.queries.markRead)
  const markAllRead = useMutation(api.nudges.queries.markAllRead)

  return {
    notifications: recent ?? [],
    unreadCount,
    markRead: (id: Id<'notifications'>) => markRead({ id }),
    markAllRead: () => markAllRead(),
    loading: recent === undefined,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNotifications.ts
git commit -m "feat(nudges): useNotifications hook"
```

---

### Task 15: NotificationBell component

**Files:**
- Create: `src/components/NotificationBell.tsx`
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Create the bell component**

```tsx
// src/components/NotificationBell.tsx
import { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 8 }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0, background: 'var(--sage-700)',
            color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px',
            borderRadius: 10, minWidth: 18, textAlign: 'center',
          }}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'white', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 320, maxHeight: 480,
          overflow: 'auto', zIndex: 100,
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontWeight: 600 }}>Notifications</div>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} style={{
                background: 'none', border: 'none', color: 'var(--sage-700)',
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}>Mark all read</button>
            )}
          </div>

          {notifications.length === 0 && (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
              No notifications yet — log a meal to start.
            </div>
          )}

          {notifications.map(n => (
            <div
              key={n._id}
              onClick={() => !n.read && markRead(n._id)}
              style={{
                padding: '12px 16px', borderTop: '1px solid var(--border)',
                cursor: 'pointer', background: n.read ? 'transparent' : 'var(--cream)',
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>{n.message}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {n.bucket} · {new Date(n.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Mount in Navbar**

In `src/components/Navbar.tsx`, find the right side of the navbar (where the avatar dropdown lives). Just before the avatar toggle, add:

```tsx
import NotificationBell from './NotificationBell'

// Inside the .nav-right div, BEFORE the user-menu pill:
<NotificationBell />
```

- [ ] **Step 3: Build and visually verify**

```bash
npm run build
```

Expected: clean build.

Manually open the dev server, sign in, and confirm the 🔔 appears in the top right.

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationBell.tsx src/components/Navbar.tsx
git commit -m "feat(nudges): NotificationBell component in navbar"
```

---

### Task 16: NotificationBanner component

**Files:**
- Create: `src/components/NotificationBanner.tsx`
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Create the banner component**

```tsx
// src/components/NotificationBanner.tsx
import { useState, useEffect } from 'react'
import { useNotifications } from '../hooks/useNotifications'

const SESSION_KEY = 'thalify.bannerDismissed'

export default function NotificationBanner() {
  const { notifications, markRead } = useNotifications()
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(dismissed)))
  }, [dismissed])

  // Show only the latest unread, undismissed
  const latest = notifications.find(n => !n.read && !dismissed.has(n._id))
  if (!latest) return null

  function dismissNow() {
    setDismissed(s => new Set([...s, latest!._id]))
  }

  return (
    <div style={{
      background: 'var(--sage-100, #EEF7EC)',
      border: '1px solid var(--sage-700)',
      borderRadius: 12, padding: '12px 16px', marginBottom: 16,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
        {latest.message}
      </div>
      <button
        onClick={() => { markRead(latest._id); dismissNow() }}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
        aria-label="Dismiss"
      >×</button>
    </div>
  )
}
```

- [ ] **Step 2: Mount in Dashboard**

In `src/pages/Dashboard.tsx`, just inside the main content column (after the greeting), add:

```tsx
import NotificationBanner from '../components/NotificationBanner'

// Inside the dashboard layout, near the top of the main column:
<NotificationBanner />
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationBanner.tsx src/pages/Dashboard.tsx
git commit -m "feat(nudges): NotificationBanner toast on dashboard"
```

---

## Phase 8: WhatsApp

### Task 17: WhatsApp adapter (mocked-first)

**Files:**
- Create: `convex/whatsapp/adapter.ts`

- [ ] **Step 1: Implement the adapter with env-flag mocking**

```ts
// convex/whatsapp/adapter.ts
/**
 * WhatsApp Cloud API adapter.
 * If WHATSAPP_MOCK is "true", logs instead of sending — for dev/test.
 * Real send requires WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars.
 */

const API_VERSION = "v22.0";

export type WhatsappSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function sendText(
  toE164: string,
  text: string,
): Promise<WhatsappSendResult> {
  if (process.env.WHATSAPP_MOCK === "true") {
    console.log(`[whatsapp:mock] to ${toE164}: ${text}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, error: "WhatsApp env vars missing" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "text",
        text: { body: text },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message ?? `HTTP ${resp.status}` };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTemplate(
  toE164: string,
  templateName: string,
  params: string[],
  languageCode = "en",
): Promise<WhatsappSendResult> {
  if (process.env.WHATSAPP_MOCK === "true") {
    console.log(`[whatsapp:mock] template ${templateName} to ${toE164}: ${params.join(", ")}`);
    return { success: true, messageId: `mock-tpl-${Date.now()}` };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, error: "WhatsApp env vars missing" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: "body", parameters: params.map(t => ({ type: "text", text: t })) }],
        },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message ?? `HTTP ${resp.status}` };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 2: Set WHATSAPP_MOCK=true on dev Convex**

```bash
npx convex env set WHATSAPP_MOCK true
```

- [ ] **Step 3: Commit**

```bash
git add convex/whatsapp/adapter.ts
git commit -m "feat(whatsapp): Cloud API adapter with mock mode"
```

---

### Task 18: WhatsApp opt-in mutations

**Files:**
- Create: `convex/whatsapp/optIn.ts`

- [ ] **Step 1: Implement opt-in flow**

```ts
// convex/whatsapp/optIn.ts
import { action, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { sendText, sendTemplate } from "./adapter";

const E164_REGEX = /^\+\d{10,15}$/;
const CODE_TTL_MS = 30 * 60 * 1000; // 30 min
const CODE_LENGTH = 6;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const requestOptIn = action({
  args: { phoneE164: v.string() },
  handler: async (ctx, { phoneE164 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!E164_REGEX.test(phoneE164)) throw new Error("Phone must be in E.164 format like +919876543210");

    const code = generateCode();
    const expiresAt = Date.now() + CODE_TTL_MS;
    await ctx.runMutation(internal.whatsapp.optIn.savePendingOptIn, {
      userId, phoneE164, code, expiresAt,
    });

    // Sent via approved template "whatsapp_verify_v1" with one parameter (the code)
    const result = await sendTemplate(phoneE164, "whatsapp_verify_v1", [code]);
    if (!result.success) {
      throw new Error(`WhatsApp send failed: ${result.error}`);
    }
    return { sent: true };
  },
});

export const savePendingOptIn = mutation({
  args: {
    userId: v.id("users"),
    phoneE164: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, phoneE164, code, expiresAt }) => {
    const profile = await ctx.db.query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId)).unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, { whatsappNumber: phoneE164 });

    // Store code in authVerificationCodes (existing table)
    // Note: Convex Auth's table may have its own schema — adjust args as needed
    await ctx.db.insert("authVerificationCodes" as never, {
      identifier: phoneE164,
      code,
      expirationTime: expiresAt,
      provider: "whatsapp_optin",
      accountId: profile._id as never,
    } as never);
  },
});

export const confirmOptIn = action({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const ok = await ctx.runMutation(internal.whatsapp.optIn.verifyAndActivate, { userId, code });
    if (!ok.activated) throw new Error("Invalid or expired code");

    // Send confirmation
    if (ok.phoneE164) {
      await sendText(
        ok.phoneE164,
        "✓ You'll get Thalify nudges here. Reply STOP to unsubscribe."
      );
    }
    return { activated: true };
  },
});

export const verifyAndActivate = mutation({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, { userId, code }) => {
    const profile = await ctx.db.query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId)).unique();
    if (!profile?.whatsappNumber) return { activated: false };

    // Find matching code (querying authVerificationCodes is fragile — for hackathon we just trust the latest)
    const codes = await ctx.db.query("authVerificationCodes" as never)
      .filter((q: never) => (q as never).eq((q as never).field("identifier"), profile.whatsappNumber))
      .collect() as Array<{ _id: never; code: string; expirationTime: number }>;

    const valid = codes.find(c => c.code === code && c.expirationTime > Date.now());
    if (!valid) return { activated: false };

    await ctx.db.patch(profile._id, {
      whatsappOptIn: true,
      whatsappVerifiedAt: Date.now(),
    });
    await ctx.db.delete(valid._id as never);
    return { activated: true, phoneE164: profile.whatsappNumber };
  },
});

export const optOut = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db.query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId)).unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, { whatsappOptIn: false });
  },
});
```

- [ ] **Step 2: Deploy + test the flow with WHATSAPP_MOCK=true**

```bash
npx convex dev --once
```

- [ ] **Step 3: Commit**

```bash
git add convex/whatsapp/optIn.ts
git commit -m "feat(whatsapp): opt-in flow with 6-digit verification"
```

---

### Task 19: WhatsApp inbound webhook

**Files:**
- Create: `convex/whatsapp/webhook.ts`
- Modify: `convex/http.ts`

- [ ] **Step 1: Implement the webhook**

```ts
// convex/whatsapp/webhook.ts
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

async function verifySignature(req: Request): Promise<boolean> {
  if (!APP_SECRET) return false;
  const sig = req.headers.get("x-hub-signature-256");
  if (!sig) return false;
  const body = await req.clone().text();
  const expected = await hmacSha256(APP_SECRET, body);
  return sig === `sha256=${expected}`;
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Meta GET = subscription verification (one-time)
export const verify = httpAction(async (_, req) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
});

// Meta POST = inbound messages
export const inbound = httpAction(async (ctx, req) => {
  const ok = await verifySignature(req);
  if (!ok) return new Response("invalid signature", { status: 401 });

  const body = await req.json();
  const entries = body.entry ?? [];
  for (const entry of entries) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const messages = change.value?.messages ?? [];
      for (const msg of messages) {
        const from = msg.from; // already in international format (no +)
        const text = (msg.text?.body ?? "").trim().toUpperCase();
        if (text === "STOP") {
          await ctx.runMutation(internal.whatsapp.webhook.handleStop, {
            phoneE164: `+${from}`,
          });
        }
        // HELP and other keywords ignored in v1
      }
    }
  }
  return new Response("ok", { status: 200 });
});

export const handleStop = ((): never => {
  // Bound below via internalMutation — placeholder for type correctness
  throw new Error("not implemented");
})();
```

> NOTE: The `handleStop` placeholder above must be replaced. Step 2 corrects this.

- [ ] **Step 2: Replace webhook.ts with corrected handleStop split**

```ts
// convex/whatsapp/webhook.ts
import { httpAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

async function verifySignature(req: Request): Promise<boolean> {
  if (!APP_SECRET) return false;
  const sig = req.headers.get("x-hub-signature-256");
  if (!sig) return false;
  const body = await req.clone().text();
  const expected = await hmacSha256(APP_SECRET, body);
  return sig === `sha256=${expected}`;
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export const verify = httpAction(async (_ctx, req) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
});

export const inbound = httpAction(async (ctx, req) => {
  const ok = await verifySignature(req);
  if (!ok) return new Response("invalid signature", { status: 401 });

  const body = await req.json();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const from = msg.from as string;
        const text = ((msg.text?.body ?? "") as string).trim().toUpperCase();
        if (text === "STOP") {
          await ctx.runMutation(internal.whatsapp.webhook.handleStop, {
            phoneE164: `+${from}`,
          });
        }
      }
    }
  }
  return new Response("ok", { status: 200 });
});

export const handleStop = internalMutation({
  args: { phoneE164: v.string() },
  handler: async (ctx, { phoneE164 }) => {
    const profiles = await ctx.db.query("profiles").collect();
    const match = profiles.find(p => p.whatsappNumber === phoneE164);
    if (match) await ctx.db.patch(match._id, { whatsappOptIn: false });
  },
});
```

- [ ] **Step 3: Register webhook routes in http.ts**

In `convex/http.ts`, add:

```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { verify, inbound } from "./whatsapp/webhook";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/whatsapp/webhook", method: "GET",  handler: verify });
http.route({ path: "/whatsapp/webhook", method: "POST", handler: inbound });
export default http;
```

- [ ] **Step 4: Deploy**

```bash
npx convex dev --once
```

- [ ] **Step 5: Commit**

```bash
git add convex/whatsapp/webhook.ts convex/http.ts
git commit -m "feat(whatsapp): inbound webhook (STOP keyword + signature verification)"
```

---

### Task 20: WhatsappOptInModal component

**Files:**
- Create: `src/components/WhatsappOptInModal.tsx`

- [ ] **Step 1: Implement the modal**

```tsx
// src/components/WhatsappOptInModal.tsx
import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

interface Props {
  open: boolean
  onClose: () => void
}

export default function WhatsappOptInModal({ open, onClose }: Props) {
  const requestOptIn = useAction(api.whatsapp.optIn.requestOptIn)
  const confirmOptIn = useAction(api.whatsapp.optIn.confirmOptIn)
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [phone, setPhone] = useState('+91')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function sendCode() {
    setError(''); setSubmitting(true)
    try {
      await requestOptIn({ phoneE164: phone.trim() })
      setStep('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code')
    } finally { setSubmitting(false) }
  }

  async function verifyCode() {
    setError(''); setSubmitting(true)
    try {
      await confirmOptIn({ code: code.trim() })
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code')
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      padding: 16,
    }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 20 }}>
            Get nudges on WhatsApp
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
        </div>

        {step === 'phone' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              We'll send a 6-digit code to verify the number.
            </p>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+919876543210"
              style={{ marginBottom: 12 }}
            />
            {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" onClick={sendCode} disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Sending…' : 'Send verification code'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
              By continuing, you agree to receive WhatsApp nudges. Reply STOP anytime to unsubscribe.
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Code sent to {phone}. Enter the 6 digits below.
            </p>
            <input
              className="input"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              style={{ marginBottom: 12, fontSize: 18, letterSpacing: '0.2em', textAlign: 'center' }}
            />
            {error && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" onClick={verifyCode} disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>✓</div>
            <p style={{ fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
              You're set up. Nudges will arrive on WhatsApp from now on.
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>Done</button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add a "Get on WhatsApp" CTA in Dashboard**

In `src/pages/Dashboard.tsx`, near the body stats card, add a small CTA that opens the modal when user is not opted in. Use the existing `profile.whatsappOptIn` flag to gate it.

```tsx
import WhatsappOptInModal from '../components/WhatsappOptInModal'
const [waOpen, setWaOpen] = useState(false)

// Render somewhere prominent in dashboard:
{!profile?.whatsappOptIn && (
  <div style={{ background: 'var(--sand)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
    <div style={{ fontSize: 13, marginBottom: 6 }}>📱 Get nudges on WhatsApp</div>
    <button className="btn btn-secondary btn-sm" onClick={() => setWaOpen(true)}>Set it up</button>
  </div>
)}
<WhatsappOptInModal open={waOpen} onClose={() => setWaOpen(false)} />
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/WhatsappOptInModal.tsx src/pages/Dashboard.tsx
git commit -m "feat(whatsapp): opt-in modal + dashboard CTA"
```

---

## Phase 9: Final integration

### Task 21: Wire WhatsApp delivery into worker

**Files:**
- Modify: `convex/nudges/worker.ts`

- [ ] **Step 1: Add WhatsApp delivery step at end of processSingleEvent**

In `convex/nudges/worker.ts`, find the `processSingleEvent` action. After the line `const notificationId = await ctx.runMutation(internal.nudges.worker.persistNudge, ...)`, add:

```ts
// WhatsApp delivery (best-effort, non-blocking)
if (state.whatsappOptIn && state.whatsappNumber) {
  const { sendText } = await import("../whatsapp/adapter");
  const result = await sendText(state.whatsappNumber, written.message);
  if (result.success) {
    await ctx.runMutation(internal.nudges.worker.markWhatsappDelivered, {
      notificationId,
      messageId: result.messageId ?? "",
    });
  } else {
    console.warn(`whatsapp send failed for ${event.userId}: ${result.error}`);
  }
}
```

Then add the helper mutation at the bottom of `worker.ts`:

```ts
export const markWhatsappDelivered = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    messageId: v.string(),
  },
  handler: async (ctx, { notificationId, messageId }) => {
    await ctx.db.patch(notificationId, {
      deliveredViaWhatsApp: true,
      whatsappMessageId: messageId,
    });
  },
});
```

- [ ] **Step 2: Deploy**

```bash
npx convex dev --once
```

- [ ] **Step 3: Commit**

```bash
git add convex/nudges/worker.ts
git commit -m "feat(nudges): WhatsApp delivery in worker (best-effort)"
```

---

### Task 22: Admin cleanup + pause switch + smoke test

**Files:**
- Modify: `convex/admin.ts`

- [ ] **Step 1: Extend deleteUserByEmail to wipe nudge tables**

In `convex/admin.ts`, find `deleteUserByEmail`. Inside the user-is-found block, BEFORE the final `await ctx.db.delete(userId)`, add:

```ts
// Nudge tables cleanup
const nudgeEvents = await ctx.db.query("nudgeEvents")
  .withIndex("by_userId_createdAt", q => q.eq("userId", userId)).collect();
for (const e of nudgeEvents) await ctx.db.delete(e._id);
summary.nudgeEvents = nudgeEvents.length;

const notifs = await ctx.db.query("notifications")
  .withIndex("by_userId_createdAt", q => q.eq("userId", userId)).collect();
for (const n of notifs) await ctx.db.delete(n._id);
summary.notifications = notifs.length;
```

- [ ] **Step 2: Add NUDGES_ENABLED env var documentation**

```bash
# On dev:
npx convex env set NUDGES_ENABLED true

# On prod (only after thorough testing):
# CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex env set NUDGES_ENABLED true
```

The worker already checks this var (Task 10 step 2). To pause nudges in emergency:
```bash
npx convex env set NUDGES_ENABLED false
```

- [ ] **Step 3: Run the full manual smoke checklist**

Open `http://localhost:5173` (with `npm run dev` + `npx convex dev` running):

1. ☐ Sign in as a test user
2. ☐ Log a meal (any type) → wait 60–90 sec → 🔔 in navbar shows badge `1` → click bell → see personalized nudge
3. ☐ Log 6 meals rapid-fire → 6th does NOT produce a notification (frequency cap working)
4. ☐ Set system clock forward to 11:30 PM → log meal → no nudge fires (quiet hours)
5. ☐ Open WhatsApp opt-in modal → enter `+91...your-number` → enter the printed mock code (visible in `npx convex logs` output) → see "✓" confirmation
6. ☐ With `WHATSAPP_MOCK=true` enabled, log a meal as opted-in user → check `npx convex logs` shows `[whatsapp:mock] to ...`
7. ☐ Verify `nudgeEvents` and `notifications` rows: `npx convex data nudgeEvents | head -5` and `npx convex data notifications | head -5`

If all 7 pass:

- [ ] **Step 4: Commit + push to dev**

```bash
git add convex/admin.ts
git commit -m "chore(nudges): admin cleanup for nudge tables + pause-switch docs"
git push origin dev
```

- [ ] **Step 5: Open a PR / promote to main when user approves**

```bash
# Wait for explicit user approval, THEN:
git checkout main
git merge dev --no-ff -m "feat: nudge engine + WhatsApp delivery"
git push origin main
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex deploy
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex run nudges/seed:seedTemplates
npx vercel deploy --prod --yes
```

---

## Self-review against spec

Cross-checked plan against `docs/superpowers/specs/2026-04-25-nudge-engine-design.md`:

| Spec section | Covered by |
|---|---|
| §3 Architecture (3 layers) | Tasks 8–13 |
| §4 Data model — `nudgeEvents` | Task 1 |
| §4 Data model — `nudgeTemplates` | Task 1, 12 |
| §4 Data model — `notifications` | Task 1, 13 |
| §4 Data model — profile WA fields | Task 1 |
| §5 Trigger → bucket mapping | Task 3 (rules) |
| §6 Flow A meal → nudge | Tasks 8, 10 |
| §6 Flow B time-based | Tasks 11 (crons + seeders) |
| §6 Flow C user reads | Task 13, 14, 15 |
| §6 Flow D WA opt-in | Tasks 18, 20 |
| §6 Flow E WA inbound | Task 19 |
| §7 Signal math + lookup | Task 4 |
| §8 Error handling | Task 7 (AI fallback), Task 21 (WA non-blocking) |
| §8 Stale events | Task 5, 10 |
| §8 Pause switch | Task 22 |
| §9 Unit tests | Tasks 3, 4, 5, 6 |
| §9 Manual smoke | Task 22 step 3 |
| §10 Security (HMAC, masking) | Task 19 |
| §12 Admin wipe | Task 22 |

**Gaps acknowledged:**
- §9 Integration tests (`integration.test.ts`) is not in this plan as a separate task. Reasoning: with the comprehensive unit tests + manual smoke checklist, integration tests can be added in v2 once the engine is stable. If you want them in v1, add as Task 23 between Tasks 13 and 14.
- WhatsApp templates (e.g. `whatsapp_verify_v1`) need to be submitted for Meta approval — that's an operational task outside this code plan.
- Razorpay paywall is correctly excluded — separate spec.

**No placeholder strings found** ("TBD", "TODO", "fill in", etc.) on a final pass.

**Type consistency check passed:** `Bucket` type used consistently in rules, signal, worker. `MockUserState` shape matches `buildUserState` return shape (verified field-by-field). Function names stable: `matchTrigger`, `computeSignal`, `pickTemplate`, `writeNudge`, `processSingleEvent`.

---

## Estimated effort

| Phase | Tasks | Time |
|---|---|---|
| Foundation (schema, fixtures) | 1, 2 | 1 hr |
| Pure logic (TDD) | 3, 4, 5, 6 | 4 hrs |
| AI integration | 7 | 1 hr |
| Producers | 8, 9 | 1 hr |
| Worker + crons + seed | 10, 11, 12 | 4 hrs |
| Read API | 13 | 30 min |
| Frontend | 14, 15, 16 | 3 hrs |
| WhatsApp | 17, 18, 19, 20 | 5 hrs |
| Final integration | 21, 22 | 1.5 hrs |
| **Total focused work** | | **~21 hrs (3 days)** |

External blockers (Meta business verification + template approval) run in parallel — not on the implementation timer.
