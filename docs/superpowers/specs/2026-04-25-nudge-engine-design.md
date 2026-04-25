# Nudge Engine — Design Spec

**Date:** 2026-04-25
**Author:** Brainstormed with user via `superpowers:brainstorming`
**Status:** ✅ Shipped 2026-04-25. The corresponding [implementation plan](../plans/2026-04-25-nudge-engine.md) was completed end-to-end and is live in production. One adjustment from the spec: WhatsApp delivery was deferred — Telegram became the primary push channel (free, no Meta paperwork). See the [README](../../../README.md) for current state.
**Estimated effort:** ~5–7 days for full implementation including WhatsApp adapter

---

## 1. Goal

Build an "intelligence layer" above Gemini that decides **when** and **what type of nudge** to send a user — then asks AI to write a personalized one-line message. Nudges are delivered both in-app (banner + bell icon) AND via WhatsApp (for opted-in users). Each nudge is anchored to a concrete personalized outcome ("skipping this snack saves you ~0.8 kg by next month") rather than generic advice.

The architecture intentionally separates **strategy** (rules — "should we nudge?") from **execution** (LLM writes the line). If Gemini hallucinates, our rules contain the damage to one bad sentence — never a wrong action.

## 2. Scope (v1)

**Trigger sources (full coaching loop):**
- `meal_logged` — emitted by `meals.logMeal` mutation
- `scan_completed` — emitted by `scan.scanMeal` action
- Time-based crons: breakfast check (9 AM), lunch check (1 PM), dinner check (8 PM), daily summary (9:30 PM), weekly insight (Sun 10 AM)
- Behavior triggers: streak milestones (3/7/14/30 days), gap detected (no logs 2+ days)

**Delivery channels:**
- In-app: bell icon (notification center) + banner toast on dashboard
- WhatsApp: Cloud API for users who opt in and verify their phone number

**Personalization:**
- Pure-AI message generation per nudge (templates serve as starting point — option C from brainstorm)
- Signal layer: math-based outcome predictions ("save N kg by next month") computed from user's TDEE, target, and the suggested action

**Limits:**
- 5 nudges/day per user (frequency cap)
- 12-hour same-bucket dedup
- Quiet hours: 11 PM – 7 AM IST
- Stale events (>4 hours pending) auto-marked skipped

**Explicitly NOT in scope (deferred to v2):**
- Per-user configurable quiet hours / timezone
- Adaptive frequency caps based on engagement
- A/B-test outcome tracking dashboard
- Push notifications (browser PWA)
- Two-way WhatsApp chat (only STOP + HELP keywords handled)
- Nudge templates admin UI (templates seeded via migration)

---

## 3. Architecture

Three independently testable layers:

```
┌─────────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   PRODUCERS         │ writes  │  nudgeEvents     │  reads  │  ENGINE          │
│   - mutations       ├────────▶│  table (queue)   │◀────────┤  (worker, every  │
│   - crons           │         │                  │ 60 sec  │   60 sec)        │
└─────────────────────┘         └──────────────────┘         │  - gatekeep      │
                                                              │  - match rule    │
                                                              │  - signal math   │
                                                              │  - pick template │
                                                              │  - call Gemini   │
                                                              │  - persist       │
                                                              │  - deliver       │
                                                              └────────┬─────────┘
                                                                       │
                                                              ┌────────┴─────────┐
                                                              ▼                  ▼
                                                  ┌──────────────────┐  ┌──────────────────┐
                                                  │  notifications   │  │  WhatsApp Cloud  │
                                                  │  (in-app source  │  │  API (best-      │
                                                  │   of truth)      │  │   effort)        │
                                                  └────────┬─────────┘  └──────────────────┘
                                                           │ reads
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  CONSUMER        │
                                                  │  (frontend)      │
                                                  │  - 🔔 navbar     │
                                                  │  - banner toast  │
                                                  └──────────────────┘
```

**Layer responsibilities:**

| Layer | Knows about | Doesn't know about |
|---|---|---|
| Producers | "this happened" | nudge logic |
| Engine | rules, gatekeepers, AI, delivery | UI rendering |
| Consumer | how to render | why a nudge fired |

---

## 4. Data model

### 4.1 New table: `nudgeEvents` (the queue)

```ts
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
  skipReason: v.optional(v.string()),  // "cap" | "dedup" | "quiet" | "stale" | etc.
  createdAt: v.number(),
}).index("by_status_createdAt", ["status", "createdAt"])
  .index("by_userId_createdAt", ["userId", "createdAt"]),
```

### 4.2 New table: `nudgeTemplates` (template library)

```ts
nudgeTemplates: defineTable({
  bucket: v.union(
    v.literal("hydration"), v.literal("movement"), v.literal("praise"),
    v.literal("recovery"), v.literal("prompt"), v.literal("reflection"),
    v.literal("plan"),
  ),
  trigger: v.string(),       // e.g., "post-dinner-within-budget"
  variant: v.string(),        // e.g., "pdw-v1" — A/B identifier
  template: v.string(),       // raw line, may include {name}, {meal}, {delta}
  active: v.boolean(),
  weight: v.optional(v.number()),  // selection weight, default 1.0
  createdAt: v.number(),
}).index("by_bucket_active", ["bucket", "active"])
  .index("by_trigger_active", ["trigger", "active"]),
```

**Seed data:** 25 templates across 7 buckets, inserted via one-time migration script. Initial set:
- 4 hydration templates (post-dinner, post-meal, post-scan-heavy, ambient)
- 3 movement (heavy meal, post-scan, plateau)
- 3 praise (3-day, 7-day, 30-day streaks)
- 4 recovery (over budget today, over budget week, post-binge, gentle)
- 5 prompt (breakfast skipped, lunch skipped, dinner skipped, gap detected, weekly cold-start)
- 3 reflection (daily summary, weekly insight, monthly retrospective)
- 3 plan (tomorrow planning, weekend planning, post-doctor visit)

### 4.3 Updated table: `notifications`

```ts
notifications: defineTable({
  userId: v.id("users"),
  bucket: v.union(/* same 7 as templates */),
  message: v.string(),                              // AI's final personalized line
  trigger: v.string(),                              // human label
  templateId: v.optional(v.id("nudgeTemplates")),
  variant: v.optional(v.string()),                  // for A/B analytics
  signalPrediction: v.optional(v.object({
    savedCalsPerDay: v.number(),
    kg7Days: v.number(),
    kg30Days: v.number(),
    context: v.string(),                            // human label e.g., "skipping evening chai"
  })),
  expiresAt: v.optional(v.number()),                // auto-hide past this (e.g., breakfast reminder expires at lunch)
  aiFallback: v.optional(v.boolean()),              // true if Gemini failed and template was used raw
  deliveredViaWhatsApp: v.optional(v.boolean()),
  whatsappMessageId: v.optional(v.string()),
  read: v.boolean(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_userId_createdAt", ["userId", "createdAt"])
  .index("by_userId_bucket_createdAt", ["userId", "bucket", "createdAt"])
  .index("by_variant_createdAt", ["variant", "createdAt"]),
```

### 4.4 `profiles` additions

```ts
whatsappNumber: v.optional(v.string()),       // E.164 format, e.g., "+919876543210"
whatsappOptIn: v.optional(v.boolean()),
whatsappVerifiedAt: v.optional(v.number()),
```

---

## 5. Trigger → Bucket mapping

The engine's rule matcher uses this table:

| Event + condition | → Trigger | → Bucket |
|---|---|---|
| `meal_logged` dinner, within budget | `post-dinner-within-budget` | hydration |
| `meal_logged` dinner, over budget | `post-dinner-over-budget` | recovery |
| `meal_logged` breakfast/lunch, heavy (>500 cal) | `post-meal-heavy` | movement |
| `meal_logged` breakfast/lunch, balanced | (skip — don't be noisy) | — |
| `scan_completed`, total >600 cal | `post-scan-heavy` | movement |
| `scan_completed`, normal | (skip) | — |
| `time_breakfast_check` 9 AM, no breakfast logged | `breakfast-skipped` | prompt |
| `time_lunch_check` 1 PM, no lunch logged | `lunch-skipped` | prompt |
| `time_dinner_check` 8 PM, no dinner logged | `dinner-skipped` | prompt |
| `time_daily_summary` 9:30 PM | `daily-recap` | reflection |
| `streak_milestone` 3 days | `streak-3-days` | praise |
| `streak_milestone` 7/14/30 days | `streak-N-days` | praise |
| `gap_detected` ≥2 days no logs | `re-engagement` | prompt |
| `weekly_insight` Sun 10 AM | `weekly-recap` | reflection |

---

## 6. Data flow

### 6.1 Flow A: User logs a meal → personalized nudge in ~60s

1. User taps "Log meal" → `meals.logMeal` mutation runs
2. Mutation inserts `mealLogs` row + inserts `nudgeEvents` row with `status: pending`
3. Returns to client immediately (no AI wait)
4. Within 60 seconds, cron `processNudgeQueue` runs and picks up the pending event
5. Worker pipeline (per event):
   1. **Load context:** profile (goal, TDEE, target), today's meal logs, last 24h notifications
   2. **Gatekeep:**
      - Quiet hours? → mark skipped (`reason: "quiet"`)
      - 5/day cap hit? → mark skipped (`reason: "cap"`)
      - Same bucket within 12h? → mark skipped (`reason: "dedup"`)
      - Older than 4h? → mark skipped (`reason: "stale"`)
   3. **Rule match:** event + state → trigger + bucket
   4. **Signal layer:** compute kg-impact from suggested action, user's TDEE, days
   5. **Pick template:** weighted random from active templates for trigger
   6. **Call Gemini:** rewrite template using context (name, last meal, signal). If Gemini fails, fall back to raw template with `{name}` substitution.
   7. **Persist:** insert `notifications` row with all fields
   8. **Deliver:**
      - Always: notification row exists → in-app reactive query picks it up
      - Conditionally: if `whatsappOptIn && whatsappVerifiedAt`, send via WhatsApp Cloud API (best-effort, non-blocking)
   9. Mark event `processed` with `notificationId`
6. Frontend's reactive query auto-updates: bell badge + dashboard banner

### 6.2 Flow B: Time-based reminder (9 AM "no breakfast")

1. Cron `seedTimeBasedEvents` runs daily at 9 AM IST
2. Queries active users (logged in last 14 days)
3. For each user without breakfast logged today, inserts `nudgeEvents` row
4. Worker picks them up on next cycle (same pipeline as Flow A)
5. Notification gets `expiresAt = today's 1 PM IST` so it auto-hides at lunch

### 6.3 Flow C: User reads a notification

1. User clicks 🔔 → `notifications.recent` query
   - `where userId=X AND (expiresAt IS NULL OR expiresAt > now)`
   - `order createdAt desc, limit 20`
2. User clicks a notification → `notifications.markRead` mutation
3. Reactive count updates in navbar

### 6.4 Flow D: WhatsApp opt-in (two-step verification)

1. User toggles "Get nudges on WhatsApp" → modal opens
2. User enters phone (with country selector, default +91) + ticks consent → "Send code"
3. `users.requestWhatsappOptIn` action:
   - Validates E.164 format
   - Patches `profile.whatsappNumber`
   - Generates 6-digit code, stores in `authVerificationCodes` (existing table)
   - Sends WhatsApp template "Your Thalify verification code is {code}"
4. User receives code, enters in modal
5. `users.confirmWhatsappOptIn` action:
   - Verifies code (with 30-min expiry)
   - Patches `profile.whatsappOptIn = true`, `whatsappVerifiedAt = now()`
   - Sends WhatsApp confirmation: "✓ You'll get nudges here. Reply STOP to unsubscribe."
6. User can opt out anytime: reply "STOP" via webhook OR toggle off in app

### 6.5 Flow E: WhatsApp inbound webhook

1. Meta hits `/api/whatsapp/inbound` (Convex HTTP action)
2. Verify HMAC signature with app secret — reject mismatches (401)
3. Parse message:
   - `STOP` → set `whatsappOptIn = false`
   - `HELP` → reply with template "How to use Thalify..."
   - Other → ignore (no two-way chat in v1)
4. Don't store inbound message bodies — only `messageId` for delivery tracking

---

## 7. Signal layer math

Pre-computed per nudge before AI call.

**Inputs:**
- User's daily target (from `profiles.calorieGoal`)
- Today's intake (`sum(mealLogs.totalCal)`)
- User's goal (lose / maintain / diabetes / gain)
- The "implied calorie save" for the trigger (lookup table — see below)

**Per-trigger implied-cal-save table** (lives in `convex/nudgeRules.ts`):

| Trigger | impliedCalSave | Action being suggested |
|---|---|---|
| `post-dinner-within-budget` | 150 | Skip late-night snack/chai |
| `post-dinner-over-budget` | (signal uses today's `delta = intake - target`) | Don't add more food |
| `post-meal-heavy` | 100 | 15-min walk burns this off |
| `post-scan-heavy` | 100 | Same |
| `breakfast-skipped` | -100 | (negative — eating breakfast prevents lunch overeating) |
| `lunch-skipped` | -100 | Same |
| `dinner-skipped` | 0 | (skip math — just nudge to log) |
| `over-budget-night` | (use today's `delta`) | Tomorrow lighter resets |
| `daily-recap` | 0 | (no math — reflective tone) |
| `streak-N-days` | 0 | (no math — celebratory tone) |
| `re-engagement` | 0 | (no math — gentle re-entry) |
| `weekly-recap` | (use 7-day avg `delta`) | — |

**Math:**
```
savedCalsPerDay = lookupImpliedCalSave(trigger, userToday)
kg7Days  = clamp(savedCalsPerDay × 7  / 7700, -0.5, 0.5)   // cap at sustainable rate
kg30Days = clamp(savedCalsPerDay × 30 / 7700, -2.0, 2.0)
```

(7700 kcal ≈ 1 kg fat tissue is the textbook approximation.)

If `savedCalsPerDay === 0` → return `signalPrediction = null` (AI generates non-numerical nudge).

**Caps:**
- Predictions capped at 0.5 kg/week sustainable rate (no aggressive framing)
- If user has no body stats / no TDEE → return `null` and AI generates a non-numerical nudge

**Goal-specific framing:**
- `gain`: flip framing to muscle gain — "this snack adds 0.3 kg of progress"
- `diabetes`: emphasize blood-sugar swing rather than weight, e.g., "this swap keeps your post-meal spike under 30 mg/dL"
- `lose`/`maintain`: standard kg-loss framing

---

## 8. Error handling

### 8.1 Gemini failures

| Failure | Response |
|---|---|
| Short throttle (<10s) | Auto-retry once (already in `claude.ts`) |
| Long throttle (>=10s) | Fall back to raw template + `{name}` substitution. Mark `aiFallback: true`. |
| Daily quota exhausted | Same as long throttle. Log warning. |
| Empty/malformed response | Same fallback. |
| Network/timeout | Mark event `failed`, retry next worker run (max 3 attempts). |

### 8.2 WhatsApp failures

| Failure | Response |
|---|---|
| Cloud API down (5xx) | Save notification anyway. Retry queue with exponential backoff (5 min → 30 min → 2 h → drop). |
| Invalid number (Meta error 131026) | Set `whatsappOptIn = false`. Insert in-app notification: "WhatsApp delivery failed — update your number in settings." |
| Template not approved (132001) | In-app only. Log alarm. |
| User blocked WA business (131047) | Disable opt-in, in-app notification. |
| Rate limit on Meta side (130429) | Retry queue. |
| Webhook signature mismatch | Return 401, log security event. |

**Critical principle:** WhatsApp is best-effort. Notification row is source of truth; in-app always works.

### 8.3 Worker / queue

- Crash mid-run: rows stay `pending`, picked up next run (idempotent)
- Stale events: auto-skip after 4 hours (no wasted Gemini calls on irrelevant events)
- Concurrent runs: Convex cron prevents overlap by default

### 8.4 User-state edge cases

- No body stats → skip signal math, AI generates non-numerical nudge
- Day-1 user → no nudges first day (avoid signup flood)
- Goal=gain → flip prediction framing
- Account deletion → `admin.deleteUserByEmail` extends to wipe `nudgeEvents` + `notifications`

### 8.5 Operational pause switch

- Convex env var `NUDGES_ENABLED` = `"true"` | `"false"`
- If `false`, worker exits early — kills all nudges instantly
- Useful for emergency stop post-launch

---

## 9. Testing strategy

### 9.1 Unit tests (`convex/nudges.test.ts`)

Pure logic — heaviest test coverage:
- `matchTrigger()` — every trigger condition has a test case
- `frequencyCap()` — 5/day boundary tests
- `bucketDedup()` — 12-hour boundary tests
- `quietHours()` — 11 PM and 7 AM boundary tests
- `computeSignal()` — math correctness, goal-flip logic, body-stats-missing case, 0.5 kg/week cap
- `pickTemplate()` — null when no actives, weighted-random correctness (1000-trial statistical test)
- WhatsApp opt-in: E.164 validation, code expiry, rate limit, STOP keyword

### 9.2 Integration tests (`convex/nudges.integration.test.ts`)

End-to-end with Convex test runner:
- meal_logged event → 1 worker cycle → notification row created
- Gemini failure → notification has `aiFallback: true` and message contains substituted name
- Stale event auto-skipped after 4h
- WhatsApp adapter failure does not block in-app delivery
- Frequency cap enforced across batched events (queue 10 → only 5 succeed)

### 9.3 Manual smoke checklist (run before merge to main)

1. Log a meal → bell badge `1` within 60 sec → click → see personalized kg-impact nudge
2. Log 6 meals rapid-fire → 6th produces no notification (cap working)
3. Set system clock to 11:30 PM → log meal → no nudge (quiet hours)
4. Skip breakfast until 9 AM → cron seeds event → notification fires with `expiresAt: 1 PM`
5. Opt in to WhatsApp → receive 6-digit code on phone → enter → confirmation message arrives

### 9.4 What's NOT tested

- AI tone / output quality — manually review first 10 nudges
- Real Gemini API calls — mocked at `claude.ts` boundary
- Real WhatsApp Cloud API — mocked at adapter boundary
- Cron timing precision — trust the platform
- Visual regression of bell/banner — eyeball it

---

## 10. Security & privacy

- **WhatsApp content:** Never include lab values or sensitive medical data. Hard rule in AI prompt.
- **Opt-in SMS pump prevention:** Rate limit `requestWhatsappOptIn` to 3/hr, 5/day per phone number.
- **Webhook authentication:** HMAC SHA256 signature verification on every Meta inbound. Reject mismatches.
- **Phone number masking in logs:** Display as `+91-98XX-XX3210`.
- **No inbound message storage:** Process WhatsApp inbound webhook, act on it (STOP/HELP), discard body. Only persist `messageId` for delivery tracking.

---

## 11. Operational monitoring

| Metric | Alert threshold | Action |
|---|---|---|
| `aiFallback=true` ratio | >10% over 24h | Gemini quota or instability — investigate |
| `whatsapp_failed` event spike | sudden 10× rise | Meta API issue or template revoked — check |
| Pending events accumulating | queue >500 | Worker stuck — restart |
| WhatsApp opt-out rate | >20%/week | Nudges feel spammy — review tone/frequency |

---

## 12. Files to create / modify

### New
- `convex/nudges.ts` — queue mutation, worker action
- `convex/nudgeTemplates.ts` — template CRUD (admin)
- `convex/nudgeRules.ts` — pure rule matcher functions
- `convex/nudgeSignal.ts` — pure signal math functions
- `convex/whatsapp/adapter.ts` — Cloud API client
- `convex/whatsapp/optIn.ts` — opt-in mutations + verification
- `convex/whatsapp/webhook.ts` — Convex HTTP action for Meta inbound
- `convex/crons.ts` — cron registration for time-based events + worker
- `convex/seedNudgeTemplates.ts` — one-time migration to seed 25 templates
- `convex/__fixtures__/nudges.ts` — test fixtures
- `convex/nudges.test.ts` — unit tests
- `convex/nudges.integration.test.ts` — integration tests
- `src/components/NotificationBell.tsx` — navbar dropdown
- `src/components/NotificationBanner.tsx` — dashboard toast
- `src/components/WhatsappOptInModal.tsx` — opt-in flow UI
- `src/hooks/useNotifications.ts` — reactive query wrapper

### Modified
- `convex/schema.ts` — add 3 new tables + profile fields
- `convex/meals.ts` — `logMeal` emits nudgeEvents
- `convex/scan.ts` — `scanMeal` emits nudgeEvents
- `convex/admin.ts` — `deleteUserByEmail` extends to nudgeEvents/notifications
- `src/components/Navbar.tsx` — add 🔔 with NotificationBell
- `src/pages/Dashboard.tsx` — add NotificationBanner

---

## 13. Open implementation decisions (defer to writing-plans)

- Exact wording / tone of each of the 25 seed templates
- Default weights for template selection
- Specific time-cron schedules (9:00:00 AM exactly vs 9:00–9:01 window)
- Gemini system prompt for nudge personalization (will need 5–6 iterations)
- WhatsApp template names + Meta submission text
- Exact bell dropdown UX (does click on a notification deep-link to the relevant page?)

These are implementation-detail decisions. The architecture above is what's locked in.

---

## 14. Out of scope — separate specs

- **Razorpay paywall** (₹100/mo, unlocks unlimited usage + WhatsApp) — separate spec
- **WhatsApp Meta business verification + template approval** — operational task that runs in parallel with implementation
