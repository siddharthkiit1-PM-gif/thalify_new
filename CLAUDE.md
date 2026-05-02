# Thalify — project context for Claude

> Paste this whole file at the start of any AI session that needs project context. Claude Code reads it automatically when working in this repo.

## Product (1 line)

**Thalify** is an AI-powered Indian-food nutrition coach. Users log meals (photo or text), get AI nudges via Telegram + in-app, see patterns, and pay ₹99 once for lifetime access (founder model, capped at 50).

Live: <https://thalify.vercel.app>

## Tech stack

- **Frontend**: React 19 + Vite + TypeScript + plain CSS (no Tailwind). Fonts via Google Fonts (DM Serif Display + Plus Jakarta Sans + JetBrains Mono).
- **Backend**: Convex (typed serverless). Single source of truth.
- **Auth**: `@convex-dev/auth` with Password provider + custom email-code reset. 10-day session.
- **AI**: Google Gemini Flash Lite (vision + text) via `convex/ai/claude.ts` (named that for legacy reasons; it's actually Gemini).
- **Telegram bot**: webhook → action queue. Handles photo scans + text-meal-logging + Health Buddy chat.
- **Payments**: Razorpay Standard Checkout (Orders API + webhook). Auto-refund for slot 51+ overflow.
- **Email**: Brevo for welcome + password reset emails.
- **Hosting**: Vercel for frontend; Convex Cloud for backend; both auto-deploy on push to `main` via the `vercel.ts` buildCommand pipeline (`npx convex deploy --cmd 'npm run build'`).

## Branches

- **`main`** — production. Every push triggers Vercel build that runs `convex deploy` first, then `vite build`. **Both layers ship from a single push.**
- **`dev`** — preview. Same buildCommand but skips convex deploy (preview builds talk to existing prod convex).
- We've used `dev` as a design-iteration playground (Block-Print v2 orbit-thali experiment) while keeping `main` stable. Currently `dev` and `main` may be intentionally divergent — check `git log origin/main..origin/dev` before assuming sync.

## Deployment basics

- Push to `main` → Vercel deploys both convex prod + frontend (~20s).
- Vercel project name: `n` (not `thalify`). Deploys aliased to `thalify.vercel.app`.
- Convex prod deployment: `coordinated-corgi-211` (URL `coordinated-corgi-211.convex.cloud`).
- Convex dev deployment: `perfect-hornet-293`.
- The `CONVEX_DEPLOY_KEY` env var is set in Vercel for both Production + Preview scopes; without it the buildCommand fails.

## File layout (the parts that matter)

```
convex/
  schema.ts                  All tables — read first when reasoning about data model
  auth.ts / auth.config.ts   Convex Auth setup, 10-day session
  passwordReset.ts           Brevo email + 8-char reset code
  passwordHistory.ts         Last-5 password reuse guard, PBKDF2-100k
  meals.ts                   logMeal, updateMealLog, deleteMealLog, getTodayLogs
  scan.ts                    scanMeal (image), extractMealFromTextAsUser (text intake from Telegram)
  chat.ts                    Health Buddy. chatAsUser used by Telegram. Has empathy mode.
  family.ts                  optimizeFamily — meal optimizer
  patterns.ts                analyzePatterns — weekly insight action used by /patterns page
  users.ts                   getCurrentUser (with isAdmin flag), getProfile, createProfile, getFounderSlotsRemaining
  admin.ts                   Admin-only queries: dailyActiveUsers, listUsersFunnel, recentMealLogsAcrossUsers, fire* one-shots
  adminScans.ts              Scan-quality review (used by /admin Scan section)
  accountEmails.ts           Welcome + signup-success emails via Brevo
  email.ts                   Brevo adapter
  storage.ts                 Convex file storage (photos)
  crons.ts                   ALL scheduled crons live here
  lib/
    quota.ts                 Per-action monthly caps (free vs lifetime)
    rateLimit.ts             Per-action burst limit
    tiers.ts                 isUnlimitedUser (admin emails skip quotas)
    security.ts              escapeHtml, etc.
  nudges/
    rules.ts                 matchTrigger — the brain that picks a trigger from an event
    signal.ts                computeSignal — "if you eat this, you save ~0.5 kg over 30 days"
    gatekeepers.ts           withinFrequencyCap, passesBucketDedup, isInQuietHours, frequencyCapForPlan
    aiWriter.ts              writeNudge — has 4 prompts: SYSTEM_PROMPT (default), POST_MEAL_INSIGHT, WATER_CHECK, WEEKLY_RECAP
    worker.ts                processNudgeQueue (60s cron) — picks events, runs gates, writes, sends
    queue.ts                 enqueue mutation
    queries.ts               recent, unreadCount, markRead, markAllRead, topSignal (used by /patterns top-signal card)
    seed.ts                  All nudge templates (idempotent — variants checked by name)
    timeSeeders.ts           Seeders triggered from time-based crons (daily-log-prompt, water-check, etc.)
    signalSeeders.ts         Seeders triggered from data-signals (re-engagement, food-repetition, upgrade-prompt)
    weeklyStats.ts           getWeeklyStatsForUser — 7-day aggregates for the data-driven Sunday recap
  telegram/
    adapter.ts               sendText, editMessageText, answerCallbackQuery, downloadFileAsBase64
    connect.ts               Deep-link binding flow
    webhook.ts               HTTP action that Telegram calls
    handlers.ts              handleText (with text-meal-extract first, chat fallback), handlePhoto, handleCallback
  razorpay/
    adapter.ts               createOrder, fetchPayment, refundPayment, signature verification
    founder.ts               Atomic counter for slot reservation, refund overflow, welcome email
    orders.ts                createPaymentOrder action (called from /upgrade page)
    webhook.ts               HTTP action — verifies signature, routes payment events

src/
  index.css                  Design tokens (CSS variables) + utility classes (.btn, .card, .input, .chip, .label)
  main.tsx                   Convex client setup, ErrorBoundary, routes
  App.tsx                    Routes
  pages/
    Waitlist.tsx + Waitlist.css   The "good" landing page (DO NOT touch unless explicitly asked)
    Auth.tsx                 Login + Register + Password reset
    Onboarding.tsx           3-step wizard (goal / diet / city + dislikes)
    Dashboard.tsx            Today's meals + macros + coach insight + quick actions
    Scan.tsx                 Photo upload + AI scan + edit before logging
    Chat.tsx                 Health Buddy
    Family.tsx               Family meal optimizer (with per-item select + mealType picker before logging)
    Lab.tsx                  Lab report parsing + Indian-food guidance
    Patterns.tsx             Top signal card + heatmap + 14d chart + AI insight
    Upgrade.tsx              Founder paywall (Razorpay overlay)
    Admin.tsx                /admin page — gated by currentUser.isAdmin
  components/
    Navbar.tsx               Logo, links, notification bell, avatar dropdown
    BodyStatsCard.tsx        Profile body stats inline display
    NotificationBanner.tsx + NotificationBell.tsx
    TelegramConnectModal.tsx + TelegramLogo.tsx
    WeekStreakBar.tsx        Mon-Sun streak (green/yellow/red logic + tap-to-see-meals)
    EditMealModal.tsx        Tap-to-edit meal modal (mealType + total cal + delete)
    ProtectedRoute.tsx       Auth/onboarding guard
    OfflineToast.tsx
    ErrorBoundary.tsx
    ui/
      Card.tsx               Variant + pad (sand/cream/sage/outline/hairline)
      Section.tsx            Eyebrow + title + subtitle + optional leading/trailing slots
      Badge.tsx              Tone-based pill
      StatCard.tsx           Used in admin grids
      EmptyState.tsx
      Progress.tsx
      ThaliAtoms.tsx         ThaliMark, Mango, Katori, OrbitThali (from Block-Print v2 — used on dev)
      SectionLabel.tsx
      Severity.tsx
  hooks/useIsMobile.ts        Single window-resize-safe mobile breakpoint
  lib/razorpay.ts             Lazy-loads checkout.js
```

## Schema tables (key ones)

- `users` — Convex Auth core. `email`, `name`, `_creationTime`.
- `profiles` — One per user. `goal` (lose / maintain / diabetes / gain), `dietType`, `calorieGoal`, `weightKg`, `plan` (free / lifetime), `telegramOptIn`, `telegramChatId`, `whatsappOptIn` (legacy, unused), `allowPhotoStorage`.
- `mealLogs` — Every meal, indexed `by_userId_date`. Items array with name/portion/cal/protein/carbs/fat.
- `scanResults` — Every photo scan or text-extracted meal. Has `consumedAt` + `consumedAsMealLogId` once user logs from buttons.
- `chatMessages` — Health Buddy history.
- `familyMenus` / `labResults` — Self-explanatory.
- `waitlist` — Pre-launch signups (still ingests).
- `rateLimits` / `counters` — Internal.
- `payments` — Razorpay audit log. `status`: created / captured / refunded / failed.
- `nudgeEvents` — Queue of trigger events. Status: pending / processed / skipped / failed.
- `nudgeTemplates` — Library of nudge templates by trigger + variant.
- `notifications` — Output of the nudge engine. Has `deliveredViaTelegram` flag.
- `passwordHistory` — Last 5 PBKDF2 hashes per user.

## Nudge engine — the most-changed system

- **Cron `processNudgeQueue`** runs every 60s, picks pending events, processes each.
- **`matchTrigger(event, state)`** — pure function (`rules.ts`) that picks a trigger string + bucket from an event. Returns null = no nudge.
- **Gates** (in order, all in `worker.ts`):
  1. Stale check (>4h old → skip)
  2. Quiet hours (12am-7am IST) — bypassed for `meal_logged`, `scan_completed`
  3. State build (`buildUserState`) — pulls profile + today's logs + recent notifs
  4. Frequency cap — bypassed for triggers in `UNTHROTTLED_TRIGGERS = ["post-meal-insight", "water-check", "daily-log-prompt"]`
  5. Bucket dedup (12h same-bucket) — same bypass list
  6. Template pick (random from active matching the trigger)
  7. AI rewrite (`writeNudge`) — branches on trigger to pick from 4 system prompts
  8. Persist + send Telegram (if `telegramOptIn`)

### Active triggers (and when they fire)

| Trigger | Source | Frequency |
|---|---|---|
| `post-dinner-over-budget` | `meal_logged` (dinner over goal) | per-meal, capped |
| `post-dinner-within-budget` | `meal_logged` (dinner within) | per-meal, capped |
| `post-meal-heavy` | `meal_logged` (>500 cal lunch/breakfast) or scan >600 | per-meal, capped |
| **`post-meal-insight`** | EVERY `meal_logged` + `scan_completed` (catchall) | always — no cap, no dedup |
| `breakfast-skipped` / `lunch-skipped` / `dinner-skipped` | Old per-meal time crons (mostly disabled now in favor of single daily prompt) | conditional |
| **`daily-log-prompt`** | Cron 7 PM IST, only if `mealCountToday === 0` | always when triggered, no cap |
| **`water-check`** | Cron 12 PM + 6 PM IST | always, no cap |
| `re-engagement` | Cron 6 PM IST, scans for 3+ day silence | conditional, capped |
| `food-repetition` | Cron 11 AM IST, detects 4+ days same food | conditional, capped |
| `upgrade-prompt` | Cron Wed 10 AM IST, free user with 3+ days logged + no upgrade nudge in 7d | weekly per user |
| `streak-3-days` / `streak-7-days` / `streak-14-days` / `streak-30-days` | `streak_milestone` event | conditional |
| `daily-recap` | Cron 9:30 PM IST | always, capped |
| `weekly-recap` | Cron Sunday 10 AM IST | always, **uses real 7-day stats** via `weeklyStats.ts` |

### Per-trigger AI prompts (in `aiWriter.ts`)

- `SYSTEM_PROMPT` — default, generic 1-line rewrite.
- `POST_MEAL_INSIGHT_SYSTEM_PROMPT` — full meal context + day's macros → 1-2 line buddy insight.
- `WATER_CHECK_SYSTEM_PROMPT` — goal + day's totals + IST hour-of-day → personalized water reminder.
- `WEEKLY_RECAP_SYSTEM_PROMPT` — 7-day aggregates → 2-3 line evidence-based recap with one prescribed action.

### Health Buddy (chat.ts)

- System prompt has all rules including **EMPATHY MODE rule 9**: when user says they haven't eaten / busy / forgot, lead with one short empathy line, then ONE concrete easy-meal Indian suggestion.
- `chat.chatAsUser` is the action Telegram routes typed messages to (via the chat fallback path; meal-extract runs first).

## Telegram flow

1. Webhook receives message → `convex/telegram/webhook.ts`
2. Photo → `handlePhoto` → `scan.scanMealAsUser` → present buttons → `handleCallback` → `meals.logMealForUser`
3. Text → `handleText` → first try `scan.extractMealFromTextAsUser`:
   - If extractor returns `intent: "log_meal"` → present same buttons → button-tap logs
   - If extractor returns `intent: "chat"` → fall through to `chat.chatAsUser`
4. Telegram delivery happens automatically inside `worker.ts` for any nudge if `state.telegramOptIn === true`.

## Auth + onboarding flow

- Register → user created + auto-signed-in → `useEffect` in Auth.tsx redirects to `/onboarding`
- Welcome email fires async (Brevo)
- Onboarding step 1 personalized with first name
- After 3 steps → `createProfile` → `/dashboard`
- Password reset: 8-char code via Brevo email, valid 30 min, **last-5 password reuse guard** (PBKDF2-100k salted)

## Admin

- `users.getCurrentUser` returns `isAdmin: boolean` based on hardcoded `ADMIN_EMAILS` set in `users.ts`.
- **Three duplicate ADMIN_EMAILS sets exist** (`users.ts`, `adminScans.ts`, and `tiers.ts UNLIMITED_EMAILS`). All currently in sync — but a future refactor should hoist into one shared lib (`convex/lib/admin.ts`) to prevent drift. There was a real bug where adminScans.ts had only 2 of 3 emails → `/admin` page crashed because `recentScans` threw "Admin only" mid-render.
- `admin.ts PERSONAL_ADMIN_EMAIL` is intentionally stricter (single email) for personal-stats endpoints.

### Admin queries (CLI-callable)

- `admin:dailyActiveUsersInternal` — today's stats
- `admin:listUsersFunnelInternal` — every user with dormant flag + activity
- `admin:recentMealLogsAcrossUsers` — last N meal logs with names attached
- `admin:diagnoseNudgesForEmail` — why isn't a specific user getting nudges (events + notifs + telegram state)
- `admin:fireWaterCheckForEmail` / `fireWeeklyRecapForEmail` — fire one nudge on demand for testing
- `admin:updateDailyLogPromptCopy` — one-shot template-text patcher

### `/admin` page sections (Admin.tsx)

- Today / Customer base / Payments stat grids (from `dailyActiveUsers`)
- **Users panel** — funnel summary + filter tabs (All / Dormant / Active / Onboarding incomplete) + table
- Scan review — paginated scan list with edited/inaccurate filters

## Design system (refined-minimalist tokens, NOT the Block-Print v2)

- Colors: `--cream`, `--sand`, `--sand-2`, `--sage-100/500/700/900`, `--ink`, `--ink-2`, `--muted`, `--border`, `--red`, `--amber`, `--wa-green`, `--tg-blue`. Block-Print v2 also added `--paper`, `--rim`, `--haldi`, `--leaf`, `--curry`, `--tomato` (only used in dev's orbit-thali Dashboard experiment, kept available).
- Spacing scale: `--space-1` (4px) through `--space-12` (96px). Do not invent in-between values.
- Radii: `--radius-xs` (6px) through `--radius-xl` (28px). Use the scale.
- Type scale: `--fs-display-1` (44px) → `--fs-display-2` (32px) → `--fs-h1` (28px) → `--fs-h2` (22px) → `--fs-h3` (18px) → `--fs-body-lg` (16px) → `--fs-body` (14.5px) → `--fs-small` (13px) → `--fs-micro` (11.5px) → `--fs-label` (11px). Plus `--fs-hero`/`--fs-numeral-xl`/`--fs-numeral-lg` for clamped responsive sizes.
- Fonts: `--serif` (DM Serif Display), `--sans` (Plus Jakarta Sans), `--mono` (JetBrains Mono).
- Hairline edge: `--hairline` (1px solid var(--border)).
- Components live in `src/components/ui/`. Use these instead of inline-styling cards/sections.

## Vercel + Convex deploy gotchas

- `git push --force` to an OLDER SHA does NOT trigger Vercel build (it sees nothing new). Push an empty commit on top to retrigger.
- Schema changes deploy with the convex deploy step in buildCommand. Validation runs server-side; bad schema = build fails.
- Convex `--prod` flag targets `coordinated-corgi-211`. Without it, CLI runs against dev (`perfect-hornet-293`).

## What NOT to do

- **Do not modify `Waitlist.tsx` / `Waitlist.css`** unless explicitly asked. It's the gold-standard page.
- **Do not delete files** in destructive operations without confirming. Use the trash bin liberally.
- **Do not amend commits** that have been pushed (use new commits).
- **Do not skip pre-commit hooks** (`--no-verify`).
- **Do not touch the password storage logic** in `@convex-dev/auth` — only our own `passwordHistory.ts` is ours to change.
- **Do not change the `meals.logMeal` mutation signature** — Telegram and web both depend on it.
- **Do not bypass the user's confirmation** for force-push, hard-reset, prod data deletion.

## Common ops cheatsheet

```sh
# Verify state
git log origin/main -3 --oneline
npx vercel ls n --yes | head -5
npx convex function-spec --prod | grep -c identifier

# Run admin queries on prod
npx convex run admin:listUsersFunnelInternal --prod
npx convex run admin:recentMealLogsAcrossUsers --prod '{"limit":50}'
npx convex run admin:diagnoseNudgesForEmail --prod '{"email":"x@y.com"}'
npx convex run admin:fireWaterCheckForEmail --prod '{"email":"x@y.com"}'

# Re-seed templates after schema changes (idempotent)
npx convex run nudges/seed:seedTemplates --prod

# Manually deploy convex prod (bypasses Vercel build)
npx convex deploy --yes
```

## Active project state (always check first)

- `main` HEAD: `git log origin/main -1 --oneline`
- `dev` HEAD: `git log origin/dev -1 --oneline`
- Last prod deploy: `npx vercel ls n --yes | grep Production | head -1`
- Number of prod functions: `npx convex function-spec --prod | grep -c identifier`

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
