# Thalify — project context for Claude

> Last updated: 2026-05-11. This file is loaded automatically when working in this repo. Read it whole at the start of any session that needs context — product, tech, business, and the lessons we've already paid for.

## Product (1 line)

**Thalify** is an AI-powered Indian-food nutrition coach. Users log meals (photo or text), get AI nudges via Telegram + in-app, see weekly patterns, and pay **₹99 once** for lifetime access (founder model, capped at 50 slots).

- Live: <https://thalify.vercel.app>
- Telegram bot: configured via `TELEGRAM_BOT_USERNAME` env var; deep-link binding handled in `convex/telegram/connect.ts`
- Source: <https://github.com/siddharthkiit1-PM-gif/thalify_new> (private)

---

## Business

### Pricing & monetization

- **Founder lifetime: ₹99 once**, capped at 50 slots (₹4,950 max from this cohort). Auto-refund for slot 51+ and amount mismatches via `convex/razorpay/founder.ts`.
- **Free tier**: per-action monthly caps (`freeScansUsedThisMonth`, `freeChatsUsedThisMonth`, etc. on `profiles`). Free users get the upgrade nudge weekly via Wed 10 AM IST cron.
- **Subscription model** for new users after slot #50 is intentionally *not built yet* — that's the next monetization decision once we know retention numbers.
- **Admin-comp lifetime** (`lifetimeReason: "beta"`) doesn't count toward the 50 — used for ourselves + selective beta access.

### Customer base (live counts — query, don't memorize)

- Total signups, dormant, active 7d/30d: `npx convex run admin:listUsersFunnelInternal --prod`
- Paying founders + comp'd lifetime: `npx convex run admin:listLifetimeMembersInternal --prod`
- Payments + revenue: `npx convex run admin:dailyActiveUsersInternal --prod` (returns `paymentsCaptured`, `paymentsRefunded`, etc.)

### Email channels

- **Brevo** for all transactional email (signup welcome, password reset, founder welcome, refund apology). Templates inline as HTML strings in `convex/email.ts` adapter callers.
- **Founder welcome email** (`razorpay/founder.ts → sendFounderWelcomeEmail`) leads with health-prioritization framing ("Thank you for choosing Thalify… for putting your health before anything else"), the founder badge, lifetime perks, and a feedback CTA to `siddharth.kiit1@gmail.com`. Backfill via `admin:backfillFounderWelcomeEmail`.

### Growth + support

- **Founder feedback** goes to `siddharth.kiit1@gmail.com` (in the welcome email + the in-app "reply to this email" prompt). "We take every founder's feedback very critically" — that copy is intentional, don't soften it.
- **Waitlist** still ingests via `convex/waitlist.ts` — pre-launch signups parked there.
- No paid acquisition currently — organic, friends/family, and Telegram-bot share.

---

## People & accounts

- **Owner / sole dev**: Siddharth Agrawal
- **GitHub**: `siddharthkiit1-PM-gif/thalify_new` (private). Local git author email: `siddharth.kiit1@gmail.com` — must match GitHub login for Vercel auto-deploy.
- **Vercel**: account `agrawalsiddharth18@gmail.com`, project name `n` (not `thalify`), aliased to `thalify.vercel.app`. Connected via GitHub App; if the repo goes private again, the GitHub App needs to be re-granted access via Vercel → Project Settings → Git → Reconnect.
- **Convex**: prod `coordinated-corgi-211`, dev `perfect-hornet-293`. `CONVEX_DEPLOY_KEY` env var set in Vercel for both Production and Preview scopes.
- **Razorpay**: live keys configured server-side (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in Convex env).
- **Brevo**: API key + sender email in Convex env (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`).
- **Telegram bot**: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` Convex envs.
- **Gemini**: `GEMINI_API_KEY` Convex env. Currently on **paid** tier (upgraded for higher rate limits + smarter models).

### Admin email lists (kept in three places — keep in sync)

- `convex/users.ts` `ADMIN_EMAILS` — gates `currentUser.isAdmin`
- `convex/adminScans.ts` `ADMIN_EMAILS` — gates scan-review reads
- `convex/lib/tiers.ts` `UNLIMITED_EMAILS` — bypasses all quotas/rate-limits

All three should match. There was a real bug where `adminScans.ts` had only 2 of 3 emails → `/admin` page crashed mid-render. **Future refactor**: hoist to one shared `convex/lib/admin.ts`.

- `convex/admin.ts` `PERSONAL_ADMIN_EMAIL` = `agrawalsiddharth66@gmail.com` — intentionally stricter (single email) for personal-stats endpoints.

---

## Tech stack

- **Frontend**: React 19 + Vite + TypeScript + plain CSS (no Tailwind). Fonts via Google Fonts (DM Serif Display + Plus Jakarta Sans + JetBrains Mono).
- **Backend**: Convex (typed serverless). Single source of truth.
- **Auth**: `@convex-dev/auth` Password provider + custom email-code reset. 10-day session, last-5 password reuse guard (PBKDF2-SHA256 100k iterations).
- **AI**: Google **Gemini 2.5 Flash Lite** (default, vision-capable) and **Gemini 2.5 Flash** (prompt-heavy paths). Wrapper at `convex/ai/claude.ts` — named for legacy reasons; it's Gemini end-to-end. See "AI model strategy" below.
- **Telegram bot**: webhook (`/telegramWebhook` HTTP action) → handler. Handles photo scans, text-meal-logging, water intent, Health Buddy chat fallback.
- **Payments**: Razorpay Standard Checkout (Orders API + webhook). HMAC-SHA256 signature verification. Atomic founder-slot counter in `counters` table; auto-refund for slot 51+ / amount mismatch / orphan / already-lifetime.
- **Email**: Brevo for welcome, password reset, founder welcome, refund apology.
- **Hosting**: Vercel for frontend; Convex Cloud for backend. Both ship on every push to `main` via the `vercel.ts` buildCommand pipeline (`npx convex deploy --cmd 'npm run build'`).
- **File storage**: Convex storage (`ctx.storage.store(blob)`) for meal photos — gated by `profile.allowPhotoStorage !== false`.

---

## Branches

- **`main`** — production. Every push triggers Vercel build that runs `convex deploy` first, then `vite build`. **Both layers ship from a single push.**
- **`dev`** — preview. Same buildCommand but skips `convex deploy` (preview builds talk to existing prod convex).
- We've used `dev` as a design-iteration playground (Block-Print v2 orbit-thali experiment) while keeping `main` stable. Currently `dev` and `main` may be intentionally divergent — check `git log origin/main..origin/dev` before assuming sync. To fast-forward dev to main: `git push origin main:dev`.

---

## Deployment basics

- Push to `main` → Vercel deploys both convex prod + frontend (~20s build).
- Vercel project name: `n`. Aliased to `thalify.vercel.app`.
- Convex prod: `coordinated-corgi-211` (URL `coordinated-corgi-211.convex.cloud`).
- Convex dev: `perfect-hornet-293`.
- `CONVEX_DEPLOY_KEY` env var must be set in Vercel for both Production + Preview; without it the buildCommand fails.
- **Private-repo gotcha**: when the GitHub repo went private, the Vercel GitHub App lost access → builds 404'd. Fix: Vercel → Project Settings → Git → Disconnect + reconnect, then push an empty commit to retrigger.
- **Git author email gotcha**: if local git author email doesn't match a GitHub account, Vercel rejects the deploy with "No GitHub account matching commit author email." Fix: `git config --global user.email "siddharth.kiit1@gmail.com"`.

---

## File layout (the parts that matter)

```
convex/
  schema.ts                  All tables — read first when reasoning about data model
  auth.ts / auth.config.ts   Convex Auth setup, 10-day session
  passwordReset.ts           Brevo email + 8-char reset code
  passwordHistory.ts         Last-5 password reuse guard, PBKDF2-100k
  meals.ts                   logMeal, updateMealLog, deleteMealLog, getTodayLogs,
                             logMealForUser (Telegram-side, no auth)
  scan.ts                    scanMeal (image, web), scanMealAsUser (Telegram),
                             extractMealFromTextAsUser (Telegram text intake)
  scanFeedback.ts            Per-scan thumbs-up/down + notes capture
  chat.ts                    Health Buddy. chatAsUser used by Telegram. Has empathy mode.
  family.ts                  optimizeFamily — meal optimizer
  family.test.ts             Tests for the optimizer's tier/protein logic
  patterns.ts                analyzePatterns — weekly insight action used by /patterns
  lab.ts                     Lab-report photo → Gemini parse → markers + Indian-food guidance
  water.ts                   logWater (web), logWaterForUser (Telegram), getTodayWater,
                             deleteWaterLog
  users.ts                   getCurrentUser (with isAdmin), getProfile, createProfile,
                             getFounderSlotsRemaining, setPhotoStoragePreference
  accountEmails.ts           sendSignupWelcome (register flow) + backfillWelcome admin one-shot
  email.ts                   Brevo adapter — sendEmail, signupCongratsHtml, addContactToBrevoList
  admin.ts                   Admin-only queries — see "Admin queries" section
  adminScans.ts              Scan-quality review (used by /admin Scan section)
  storage.ts                 Convex file storage helpers (signed URLs)
  crons.ts                   ALL scheduled crons live here
  http.ts                    HTTP routes (Razorpay webhook, Telegram webhook)
  waitlist.ts                Pre-launch email capture (still ingests)
  ai/
    claude.ts                The Gemini wrapper — named for legacy reasons (started as Claude)
  lib/
    quota.ts                 Per-action monthly caps (free vs lifetime)
    rateLimit.ts             Per-action burst limit
    tiers.ts                 isUnlimitedUser (admin emails skip quotas)
    security.ts              escapeHtml, etc.
  nudges/
    rules.ts                 matchTrigger — picks a trigger string + bucket from an event
    signal.ts                computeSignal — "if you eat this, you save ~0.5 kg over 30 days"
    gatekeepers.ts           withinFrequencyCap, passesBucketDedup, isInQuietHours,
                             frequencyCapForPlan, UNTHROTTLED_TRIGGERS bypass list
    aiWriter.ts              writeNudge — 4 system prompts: SYSTEM_PROMPT, POST_MEAL_INSIGHT,
                             WATER_CHECK, WEEKLY_RECAP
    worker.ts                processNudgeQueue (60s cron) — picks events, runs gates, writes
    queue.ts                 enqueue mutation
    queries.ts               recent, unreadCount, markRead, markAllRead, topSignal
    seed.ts                  All nudge templates (idempotent — variants checked by name)
    timeSeeders.ts           Time-cron-triggered seeders (daily-log-prompt, water-check)
    signalSeeders.ts         Data-signal seeders (re-engagement, food-repetition, upgrade-prompt)
    weeklyStats.ts           getWeeklyStatsForUser — 7-day aggregates for Sunday recap
  telegram/
    adapter.ts               sendText, editMessageText, answerCallbackQuery, downloadFileAsBase64
    connect.ts               Deep-link binding flow (8-char token, 15-min expiry)
    webhook.ts               HTTP action that Telegram calls
    handlers.ts              handleText (text-meal-extract first, water-intent regex,
                             chat fallback), handlePhoto, handleCallback
  razorpay/
    adapter.ts               createOrder, fetchPayment, refundPayment, signature verification
    founder.ts               Atomic counter, slot reservation, refund overflow, welcome email
    orders.ts                createPaymentOrder action (called from /upgrade page)
    webhook.ts               HTTP action — verifies signature, routes payment events
  whatsapp/                  Legacy adapter — currently unused (Telegram replaced it)
  data/                      Static Indian-food nutrition database (cal/protein per portion)

src/
  index.css                  Design tokens (CSS variables) + utility classes + global mobile
                             safety net (overflow-x clip, img max-width, iOS-zoom-prevention)
  main.tsx                   Convex client setup, ErrorBoundary, routes
  App.tsx                    Routes
  pages/
    Waitlist.tsx + Waitlist.css   The "good" landing page (DO NOT touch unless asked)
    Auth.tsx                 Login + Register + Password reset
    Onboarding.tsx           3-step wizard (goal / diet / city + dislikes)
    Dashboard.tsx            Today's meals + macros + coach insight + quick actions + water
    Scan.tsx                 Photo upload + AI scan + edit before logging
    Chat.tsx                 Health Buddy
    Family.tsx               Family meal optimizer (per-item select + mealType picker)
    Lab.tsx                  Lab report parsing + Indian-food guidance
    Patterns.tsx             Top signal card + heatmap + 14d chart + AI insight
    Upgrade.tsx              Founder paywall (Razorpay overlay)
    Admin.tsx                /admin page — gated by currentUser.isAdmin
  components/
    Navbar.tsx               Logo, links, notification bell, avatar dropdown
                             (mobile dropdowns are viewport-fixed sheets)
    NotificationBell.tsx     Mobile-sheet + desktop-panel dropdown, body-scroll lock
    NotificationBanner.tsx   Dashboard inline banner (overflow-wrap safe)
    BodyStatsCard.tsx        Profile body stats inline display
    TelegramConnectModal.tsx + TelegramLogo.tsx
    WeekStreakBar.tsx        Mon-Sun streak (green/yellow/red logic + tap-to-see-meals)
    WaterWidget.tsx          Dashboard water tracker (200/250/500/1000ml + custom + log list)
    ProtectedRoute.tsx       Auth/onboarding guard
    OfflineToast.tsx
    ErrorBoundary.tsx
    ui/
      Card.tsx               Variant + pad (sand/cream/sage/outline/hairline)
      Section.tsx            Eyebrow + title + subtitle + leading/trailing slots
      Badge.tsx              Tone-based pill
      StatCard.tsx           Used in admin grids
      EmptyState.tsx
      Progress.tsx
      ThaliAtoms.tsx         ThaliMark, Mango, Katori, OrbitThali (Block-Print v2 — used on dev)
      SectionLabel.tsx
      Severity.tsx
  hooks/useIsMobile.ts        Single window-resize-safe mobile breakpoint (≤768px)
  hooks/useNotifications.ts   Notifications query + markRead/markAllRead
  lib/razorpay.ts             Lazy-loads checkout.js
```

---

## Schema tables (key ones)

- `users` — Convex Auth core. `email`, `name`, `_creationTime`.
- `profiles` — One per user. Fields worth knowing:
  - **Goals / diet**: `goal` (lose / maintain / diabetes / gain), `dietType` (veg / veg_eggs / nonveg / jain / vegan), `city`, `allergies[]`, `dislikes[]`, `calorieGoal`, `scanCount`.
  - **Body stats** (optional → computes TDEE): `weightKg`, `heightCm`, `age`, `sex`, `activityLevel`, `bodyFatPct`, `tdee`.
  - **Plan / paywall**: `plan` (free / lifetime), `lifetimeReason` (founder / beta / waitlist), `founderNumber` (1-50), `paidAt`, `razorpayOrderId`, `razorpayPaymentId`.
  - **Quotas**: `freeScansUsedThisMonth` / chats / labs / family / patterns counters (free tier), `tokensUsedThisMonth` (lifetime), `usageResetAt`.
  - **Telegram**: `telegramChatId`, `telegramOptIn`, `telegramVerifiedAt`, `telegramConnectToken`, `telegramConnectExpiresAt`, `telegramLastInteractionAt`.
  - **WhatsApp** (legacy, unused): `whatsappOptIn`, `whatsappNumber`, etc.
  - **Photo consent**: `allowPhotoStorage` (default true; forward-only — flipping it off does NOT retroactively delete yesterday's photos).
- `mealLogs` — Every meal, indexed `by_userId_date`. Items[] with name/portion/cal/protein/carbs/fat.
- `scanResults` — Every photo scan or text-extracted meal. `items[]` (final user-edited), `rawItems[]` (Gemini's pre-edit output, training signal), `imageStorageId`, `consumedAt`, `consumedAsMealLogId` (once user logs from buttons).
- `chatMessages` — Health Buddy history.
- `familyMenus` — Per-day optimized plate (per-item action: keep / reduce / skip / add).
- `labResults` — Markers, summary, dietary changes, urgent flags, disclaimer.
- `waterLogs` — Every glass/bottle. `amountMl`, `source` (web/telegram), `containerType` (`glass-200` / `glass-250` / `bottle-500` / `bottle-1000` / `custom`). Indexed by `by_userId_date`.
- `waitlist` — Pre-launch signups.
- `payments` — Razorpay audit log. `status`: created / captured / refunded / failed. Survives profile deletion.
- `counters` — Single-row atomic counters (e.g. `founders_paid` → 1..50).
- `nudgeEvents` — Queue of trigger events. Status: pending / processed / skipped / failed.
- `nudgeTemplates` — Library of nudge templates by trigger + variant.
- `notifications` — Output of the nudge engine. Has `deliveredViaTelegram` flag.
- `passwordHistory` — Last 5 PBKDF2 hashes per user.
- `rateLimits` — Per-action burst tracking.

---

## AI model strategy

### Two tiers (both Gemini 2.5)

- **Flash Lite** (`gemini-2.5-flash-lite`) — default for cheap / high-volume paths: meal scans (vision), text meal extraction, generic nudge rewrites, water-check rewrites.
- **Flash** (`gemini-2.5-flash`) — promoted for prompt-heavy paths where reasoning quality matters: Health Buddy chat, Patterns weekly insight, Family meal optimizer, Weekly Recap.

### Thinking-budget gotchas (paid for in real time)

Flash 2.5 burns thinking tokens that **count against `maxOutputTokens`**. We learned this the painful way (truncated nudges shipping with "Siddharth, it" as the entire body):

- **Short-form on Flash** (nudges, water-check) → `thinking_budget: 0` so all tokens go to output.
- **Long-form on Flash** (patterns, recap) → keep thinking enabled, but **quadruple** `maxOutputTokens` so the visible reply still fits after thinking burn.
- **Water-check on Flash Lite** → `thinking_budget: 0` + `maxOutputTokens: 400` (thinking 512 with budget 300 had the same truncation).

### Per-trigger AI prompts (in `nudges/aiWriter.ts`)

- `SYSTEM_PROMPT` — default, generic 1-line rewrite for non-special triggers.
- `POST_MEAL_INSIGHT_SYSTEM_PROMPT` — full meal context + day's macros → 1-2 line buddy insight.
- `WATER_CHECK_SYSTEM_PROMPT` — goal + day's totals + IST hour-of-day → personalized water reminder. **Must include an Indian-wellness pro-tip in every output** (jeera water, methi water, sip-don't-gulp, etc.).
- `WEEKLY_RECAP_SYSTEM_PROMPT` — real 7-day aggregates → 2-3 line evidence-based recap with one prescribed action for the week ahead.

---

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
  7. AI rewrite (`writeNudge`) — branches on trigger to pick one of 4 system prompts
  8. Persist to `notifications` + send Telegram (if `state.telegramOptIn === true`)

### Active triggers

| Trigger | Source | Frequency |
|---|---|---|
| `post-dinner-over-budget` | `meal_logged` (dinner over goal) | per-meal, capped |
| `post-dinner-within-budget` | `meal_logged` (dinner within) | per-meal, capped |
| `post-meal-heavy` | `meal_logged` (>500 cal lunch/breakfast) or scan >600 | per-meal, capped |
| **`post-meal-insight`** | EVERY `meal_logged` + `scan_completed` (catchall) | always — no cap, no dedup |
| `breakfast-skipped` / `lunch-skipped` / `dinner-skipped` | Old per-meal time crons (mostly disabled in favor of single daily prompt) | conditional |
| **`daily-log-prompt`** | Cron 7 PM IST, only if `mealCountToday === 0` | always when triggered, no cap |
| **`water-check`** | Cron 12 PM + 6 PM IST (+ 3 more times across the day) | always, no cap |
| `re-engagement` | Cron 6 PM IST, scans for 3+ day silence | conditional, capped |
| `food-repetition` | Cron 11 AM IST, detects 4+ days same food | conditional, capped |
| `upgrade-prompt` | Cron Wed 10 AM IST, free user with 3+ days logged + no upgrade nudge in 7d | weekly per user |
| `streak-3-days` / `streak-7-days` / `streak-14-days` / `streak-30-days` | `streak_milestone` event | conditional |
| `daily-recap` | Cron 9:30 PM IST | always, capped |
| `weekly-recap` | Cron Sunday 10 AM IST | always, **uses real 7-day stats** via `weeklyStats.ts` |

---

## Water tracking

- **Table**: `waterLogs` — per-instance log (not per-day rollup), source-tagged, container-type-tagged.
- **Web**: `WaterWidget.tsx` on Dashboard. Quick-log buttons (200 / 250 / 500 / 1000 ml + custom). Recent sips list with tap-to-undo.
- **Telegram**: text-handler regex detects intent ("drank water", "had 250ml", "बोतल पानी"). Renders inline keyboard with same presets. Callback `waterlog:N` routes through `logWaterForUser`.
- **Nudges**: 5x daily water-check crons (morning / mid-morning / noon / afternoon / evening IST). Bypasses frequency cap + bucket dedup (in `UNTHROTTLED_TRIGGERS`). Prompt requires an Indian-wellness pro-tip per output.

---

## Health Buddy (chat.ts)

- System prompt has 9+ rules including **EMPATHY MODE rule 9**: when user says they haven't eaten / busy / forgot, lead with one short empathy line, then ONE concrete easy-meal Indian suggestion.
- `chat.chatAsUser` is the action Telegram routes typed messages to — but only after `extractMealFromTextAsUser` returns `intent: "chat"`. If extractor returns `intent: "log_meal"`, the meal-log button flow fires first.
- Supports Hinglish + 4 other Indian languages (auto-detect).

---

## Telegram flow

1. Webhook receives message → `convex/telegram/webhook.ts`
2. **Photo** → `handlePhoto`:
   - Upload base64 to Convex storage (if `allowPhotoStorage !== false`)
   - `scan.scanMealAsUser` → Gemini Flash Lite vision → items[]
   - Present inline buttons (breakfast / lunch / snack / dinner) → callback `handleCallback` → `meals.logMealForUser`
3. **Text** → `handleText`:
   - Water-intent regex first → if match, render water buttons
   - Else try `scan.extractMealFromTextAsUser` (Gemini text intake):
     - `intent: "log_meal"` → present same meal buttons → button-tap logs
     - `intent: "chat"` → fall through to `chat.chatAsUser`
4. **Nudge delivery** happens automatically inside `worker.ts` for any nudge if `state.telegramOptIn === true`.

---

## Razorpay + founder paywall

### End-to-end flow

1. **User taps Upgrade** → `/upgrade` page → `razorpay/orders.createPaymentOrder` action.
2. Order created in Razorpay + logged to `payments` table (status: `created`). Razorpay Checkout overlay loads on the browser.
3. User pays. Webhook hits `/razorpayWebhook` (HTTP action in `razorpay/webhook.ts`):
   - HMAC-SHA256 signature verified.
   - Event whitelisted (`payment.captured`, `payment.failed`, `refund.*`).
   - Amount + currency checked (₹99 / INR). Mismatch → auto-refund.
4. On `payment.captured`:
   - `reserveFounderSlot` (internalMutation) atomically reads + increments `counters.founders_paid` and patches profile (`plan: "lifetime"`, `lifetimeReason: "founder"`, `founderNumber`, `paidAt`).
   - **Auto-refund** cases (return slot to user via `issueRefund`):
     - `sold-out` (slot 51+)
     - `amount-mismatch`
     - `already-lifetime` (double-purchase)
     - `no-profile` (paid but never onboarded)
5. On successful first-time reservation → schedule `sendFounderWelcomeEmail` (Brevo).

### Welcome email + backfill

- **Copy** lives inline in `razorpay/founder.ts sendFounderWelcomeEmail`. Subject leads with "Thank you for choosing Thalify, {firstName} — Founder #N (your feedback shapes what we build next)". Body's first sentence reframes the founder achievement as a health-prioritization win.
- **Feedback CTA card** asks founders to write to `siddharth.kiit1@gmail.com`. Phrase "We take every founder's feedback very critically" is intentional — don't soften it.
- **Backfill**: `npx convex run admin:backfillFounderWelcomeEmail --prod '{"dryRun":true}'` previews recipients; without `dryRun` it sends. Idempotent (Brevo will deliver, no dedup on our side — only run when copy actually changes).
- Skips admin-comp'd users (`lifetimeReason: "beta"`).

### Lifetime member audit

- `npx convex run admin:listLifetimeMembersInternal --prod` — returns all lifetime users with `lifetimeReason`, `founderNumber`, `paidAt`, `hasRazorpayPayment`.

---

## Auth + onboarding flow

- Register → user created + auto-signed-in → `useEffect` in Auth.tsx redirects to `/onboarding`
- Welcome email fires async (Brevo) — `accountEmails:sendSignupWelcome`
- Onboarding step 1 personalized with first name
- After 3 steps → `createProfile` → `/dashboard`
- Password reset: 8-char code via Brevo email, valid 30 min, **last-5 password reuse guard** (PBKDF2-SHA256-100k salted, separate from the auth library's own password store).

---

## Admin

- `users.getCurrentUser` returns `isAdmin: boolean` based on hardcoded `ADMIN_EMAILS` in `users.ts`.
- `admin.ts PERSONAL_ADMIN_EMAIL` is intentionally stricter (single email) for personal-stats endpoints.

### Admin queries (CLI-callable, all `--prod`-aware)

- `admin:dailyActiveUsersInternal` — today's stats + payments rollup + revenue.
- `admin:listUsersFunnelInternal` — every user with dormant flag + activity + plan.
- `admin:authFunnelInternal` — auth-session-based funnel (signed-up vs ever-signed-in vs active 7d).
- `admin:recentMealLogsAcrossUsers` — last N meal logs with names attached.
- `admin:diagnoseNudgesForEmail` — why isn't a specific user getting nudges (events + notifs + telegram state).
- `admin:fireWaterCheckForEmail` / `fireWeeklyRecapForEmail` — fire one nudge on demand for testing.
- `admin:updateDailyLogPromptCopy` — one-shot template-text patcher.
- `admin:grantBetaLifetime` — admin-comp lifetime to an email (sets `lifetimeReason: "beta"`).
- `admin:deleteUserByEmail` — destructive; for cleanup only. Cascades to profile, mealLogs, scans, etc.
- `admin:listLifetimeMembersInternal` — every lifetime member with reason + payment status.
- `admin:backfillFounderWelcomeEmail` — re-send welcome to all paying founders (use after copy changes).
- `admin:reviveQuietSkippedEvents` — revive nudge events that got dropped during quiet hours.
- `admin:findDuplicateTelegramConnections` / `unbindTelegramFromProfile` — Telegram cleanup.
- `admin:fixLeakyTemplates` / `cleanupBrokenNotifications` — one-shot data fixes.
- `admin:runWorkerOnce` — process the nudge queue immediately (don't wait for the 60s cron).

### `/admin` page sections (Admin.tsx)

- Today / Customer base / Payments stat grids (from `dailyActiveUsers`)
- **Users panel** — funnel summary + filter tabs (All / Dormant / Active / Onboarding incomplete) + table
- Scan review — paginated scan list with edited/inaccurate filters, photo display (consent-gated)

---

## Design system (refined-minimalist tokens, NOT the Block-Print v2)

- **Colors**: `--cream`, `--sand`, `--sand-2`, `--sage-50/100/500/700/900`, `--ink`, `--ink-2`, `--muted`, `--muted-2`, `--border`, `--border-2`, `--red`, `--amber`, `--wa-green`, `--tg-blue`. Block-Print v2 also added `--paper`, `--rim`, `--haldi`, `--leaf`, `--curry`, `--tomato` (only used in dev's orbit-thali Dashboard experiment).
- **Spacing**: `--space-1` (4px) → `--space-12` (96px). Do not invent in-between values.
- **Radii**: `--radius-xs` (6px) → `--radius-xl` (28px). Use the scale.
- **Type**: `--fs-display-0/1/2`, `--fs-h1/2/3`, `--fs-body-lg/body/small/micro/label`, plus clamped `--fs-hero`, `--fs-numeral-xl`, `--fs-numeral-lg`.
- **Fonts**: `--serif` (DM Serif Display), `--sans` (Plus Jakarta Sans), `--mono` (JetBrains Mono).
- **Hairline edge**: `--hairline` (1px solid var(--border)).
- **Components**: live in `src/components/ui/` (Card, Section, Badge, etc.). Use these instead of inline-styling cards/sections.

---

## Mobile UI philosophy

The app must be **phone-agnostic** from 320px (iPhone SE 1st gen) to 440px (iPhone 16 Pro Max), in both orientations, with iOS notch / Dynamic Island / home-indicator awareness.

### Document-wide safety net (in `src/index.css`)

These rules catch a whole class of mobile bugs at the root:

- `html, body { overflow-x: clip }` (with `hidden` fallback) — kills horizontal scroll from any rogue wide element.
- `body { overflow-wrap: break-word }` — long unbroken AI strings wrap.
- `img, svg, video, canvas { max-width: 100% }` — no image ever overflows its column.
- `body { -webkit-text-size-adjust: 100% }` — iOS doesn't aggressively up-size on rotation.
- `@media (max-width: 768px) { input, textarea, select { font-size: 16px } }` — suppresses iOS Safari focus auto-zoom.
- `@media (max-width: 768px) { button { touch-action: manipulation } }` — drops Android Chrome 300ms tap delay.

### Responsive grid pattern

**Prefer `repeat(auto-fit, minmax(Npx, 1fr))` over `useIsMobile()` + conditional inline styles.**

- Zero JS, zero render flicker, reflows continuously on rotation/resize.
- `minmax(180px, 1fr)` — 2 cols on desktop, 1 col on phones <360px (used on Patterns Wins/Improve).
- `minmax(120px, 1fr)` — 4 cols on desktop, 2x2 on phones (used on Family meal-type buttons).
- `minmax(150px, 1fr)` — 2 cols when fits, 1 col when not (used on Lab markers preview).

### Mobile dropdown pattern

On `≤768px`, panels (notification bell, avatar menu) render as a **viewport-fixed sheet** anchored 12px from each edge with subtle backdrop scrim. Body scroll is locked while open. `100dvh`-aware max-height keeps iOS Safari URL bar from clipping the bottom rows. Reference: `NotificationBell.tsx`, `Navbar.tsx` avatar menu.

### Breakpoints in `index.css`

- `@media (max-width: 768px)` — tablet/phone (hide nav links, reduce page padding, scale headlines)
- `@media (max-width: 440px)` — small phones (further padding/typography tightening)
- `@media (max-width: 360px)` — very small phones (eyebrow letter-spacing tighten)
- `@supports (padding: env(safe-area-inset-top))` — notch awareness for nav + page bottom

---

## Vercel + Convex deploy gotchas

- `git push --force` to an OLDER SHA does NOT trigger Vercel build (it sees nothing new). Push an empty commit on top to retrigger.
- Schema changes deploy with the `convex deploy` step in buildCommand. Validation runs server-side; bad schema = build fails.
- Convex `--prod` flag targets `coordinated-corgi-211`. Without it, CLI runs against dev (`perfect-hornet-293`).
- Private-repo + GitHub App access — see "Deployment basics".
- Git author email must match a GitHub account on `agrawalsiddharth18`'s Vercel — see "Deployment basics".

---

## Recent milestones (newest first)

- **2026-05-09 — Mobile UI overhaul**: notification + avatar dropdowns no longer clip past viewport (viewport-fixed sheets), Patterns/Family/Lab grids made fluid with `auto-fit minmax`, document-wide CSS safety net added (overflow-x clip, image max-width, iOS-zoom prevention, 300ms tap-delay kill).
- **2026-05-08 — Founder welcome email**: rewritten with health-first framing + feedback CTA to `siddharth.kiit1@gmail.com`. Backfill admin tool added; re-sent to all 3 existing founders (Saumya #1, Shibendu #2, Surbhi #3).
- **2026-05-07 — Telegram photo persistence**: photos from Telegram now upload to Convex storage (gated by `allowPhotoStorage`), visible in admin scan review.
- **2026-05-04 — Photo consent gating**: admin scan review respects `allowPhotoStorage`; forward-only (yesterday's photos remain).
- **2026-05-03 — Brand mark**: replaced "Th" text logo with sage-thali favicon image across app + browser tabs.
- **2026-05-02 — Auth funnel**: `/admin` users panel switched from meal-log-based to auth-session-based funnel (Active 7d / Active 30d / Dormant / Lapsed).
- **2026-04-30 — Water tracking**: `waterLogs` table, web widget, Telegram intent regex, 5x daily AI nudges. Required Indian-wellness pro-tip in every nudge.
- **2026-04-28 — AI model strategy**: promoted Patterns + Family + Health Buddy + Recap to Flash 2.5; rest on Flash Lite. Thinking-budget tuning per path.
- **2026-04-26 — Weekly recap**: Sunday 10 AM IST cron uses real 7-day aggregates (`weeklyStats.ts`) with action prescription.
- **2026-04-24 — Patterns top-signal card**: `nudges/queries.ts topSignal` query, headline insight on `/patterns`.

---

## What NOT to do

- **Do not modify `Waitlist.tsx` / `Waitlist.css`** unless explicitly asked. It's the gold-standard page.
- **Do not delete files** in destructive operations without confirming. Use the trash bin liberally.
- **Do not amend commits** that have been pushed (use new commits).
- **Do not skip pre-commit hooks** (`--no-verify`) unless explicitly asked.
- **Do not touch the password storage logic** in `@convex-dev/auth` — only our own `passwordHistory.ts` is ours to change.
- **Do not change the `meals.logMeal` mutation signature** — Telegram (`logMealForUser`) and web both depend on the same item shape.
- **Do not bypass the user's confirmation** for force-push, hard-reset, prod data deletion, or sending live emails to real customers.
- **Do not soften the founder welcome email copy** — the "health before anything else" + "we take every founder's feedback very critically" lines are intentional brand voice.
- **Do not retroactively delete photos** when a user flips `allowPhotoStorage` off — consent is forward-only.

---

## Common ops cheatsheet

```sh
# State checks
git log origin/main -3 --oneline
git log origin/dev -3 --oneline
npx vercel ls n --yes | head -5
npx convex function-spec --prod | grep -c identifier

# Admin queries on prod
npx convex run admin:listUsersFunnelInternal --prod
npx convex run admin:listLifetimeMembersInternal --prod
npx convex run admin:dailyActiveUsersInternal --prod
npx convex run admin:recentMealLogsAcrossUsers --prod '{"limit":50}'
npx convex run admin:diagnoseNudgesForEmail --prod '{"email":"x@y.com"}'

# Send / test
npx convex run admin:fireWaterCheckForEmail --prod '{"email":"x@y.com"}'
npx convex run admin:fireWeeklyRecapForEmail --prod '{"email":"x@y.com"}'
npx convex run admin:backfillFounderWelcomeEmail --prod '{"dryRun":true}'

# Re-seed templates after schema changes (idempotent)
npx convex run nudges/seed:seedTemplates --prod

# Manual deploys
npx convex deploy --yes              # prod
git push origin main                 # full stack (convex + vite)
git push origin main:dev             # fast-forward dev to main

# Run worker once (process nudge queue immediately)
npx convex run admin:runWorkerOnce --prod
```

---

## Active project state (always check first)

```sh
git log origin/main -1 --oneline
git log origin/dev -1 --oneline
npx vercel ls n --yes | grep Production | head -1
npx convex function-spec --prod | grep -c identifier
npx convex run admin:dailyActiveUsersInternal --prod
```

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
