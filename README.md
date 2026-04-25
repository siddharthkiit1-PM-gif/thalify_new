# Thalify

> **AI health coach for Indian food.** Snap a thali, get calories + macros in 3 seconds. Chat with a coach in Hinglish that actually knows what dal-chawal looks like. Get gentle nudges on Telegram. Upload lab reports → get specific Indian foods that move your markers.

🌐 **Live:** https://thalify.vercel.app
🤖 **Telegram bot:** [@thalify_health_bot](https://t.me/thalify_health_bot)
📦 **GitHub:** https://github.com/siddharthkiit1-PM-gif/thalify_new
✉️ **Contact:** [siddharth.kiit1@gmail.com](mailto:siddharth.kiit1@gmail.com)

---

## What it actually is

Most Indians who try to lose weight either give up or eat sad. Every diet app on the App Store was built for someone who shops at Whole Foods and meal-preps quinoa on Sundays — not someone whose dinner is whatever Mummy cooked tonight, eaten in five different katoris off a shared plate.

**Thalify is built for the second person.**

You snap a photo of your thali. In three seconds, you see the calories — in Indian terms. *"Rajma, 1 katori — 180 cal. Roti, 2 pieces — 160 cal. Filter coffee with jaggery — 60 cal."* Not "1 cup beans" or "1 serving of bread."

You ask the coach a question — in English, Hindi, Hinglish, whatever lands first. It already knows what you logged at lunch, what your goal is, what you don't like, and that it's 9 PM in Bengaluru. The advice comes back as *"have curd-rice, skip the second roti, walk 15 min after"* — not *"consider a balanced macronutrient profile."*

An hour after dinner, you get one line in Telegram: *"You're 200 cal under today, Sam. Glass of water + a short walk and you sleep great."* No essay, no preachy tone, no ten-emoji preamble.

You upload your blood test once a quarter. Instead of *"improve your HbA1c"*, you get *"swap white rice for brown rice 4 days a week, add 1 boiled egg at breakfast for protein."* Specific. Indian. Doable.

You tell the family meal optimizer what's on tonight's menu — *dal, rice, paneer, roti.* It tells you which to keep, which to halve, which to skip — for **your** number, not the family's average. Same plate, different portions, no separate "diet food."

### The honest version of what's inside

| Surface | What it does | Where it lives |
|---|---|---|
| **Photo scan** | Identifies every dish on your plate, returns Indian-portion macros | `/scan`, plus 📷 to the Telegram bot |
| **Health Buddy chat** | Coach trained on Indian food + your live profile + today's meals + the hour | `/chat`, plus text to the Telegram bot |
| **Telegram bot** | Two-way: send photos to log, send questions to chat, get nudges back | [@thalify_health_bot](https://t.me/thalify_health_bot) |
| **Nudges** | Gentle one-liners after every meal — never wakes you up at 3 AM | In-app bell + Telegram |
| **Lab report analysis** | Photo of bloodwork → specific Indian foods to move HbA1c, B12, iron, cholesterol | `/lab` |
| **Family meal optimizer** | Per-user portion guidance from a shared family menu | `/family` |
| **Pattern insights** | 28-day eating heatmap + weekly AI summary of what's working | `/patterns` |
| **Founder offer** | First 50 paying customers → **lifetime access for ₹99 once** (3,000 AI actions / month forever). After 50, monthly tier. | `/upgrade` |

We don't tell you to skip dinner. We don't tell you rice is the enemy. We don't pretend ghee is poison. We count katoris, not kale. And we speak the language you actually think in — all five of them.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 19 + TypeScript, plain CSS (the "Warm Science" design system in `src/index.css`) |
| Backend | [Convex](https://convex.dev) — typed queries/mutations/actions, real-time sync, built-in auth |
| Auth | `@convex-dev/auth` Password provider, 8-char emailed reset codes |
| AI | Google Gemini Flash (`gemini-2.5-flash-lite`) — vision + chat, free 1500 req/day |
| Email | Brevo transactional API (free 300/day) — waitlist welcome, signup welcome, password reset |
| Telegram | Direct Bot API (free, no third-party) — webhook + inline keyboards |
| Payments | **Razorpay Standard Checkout** — UPI / card / netbanking, INR; webhook-driven server confirmation |
| Hosting | **Vercel** (frontend) + **Convex Cloud** (backend) |
| CI/CD | `git push origin main` → Vercel auto-deploys in ~10 sec |

---

## Branch + deployment strategy

Two completely isolated stacks:

| | **Production** | **Dev** |
|---|---|---|
| Git branch | `main` | `dev` |
| Frontend URL | **https://thalify.vercel.app** (also `n-beta-flame.vercel.app`, `get-thalify.vercel.app`, `thalify-app.vercel.app`) | Vercel preview URL per-commit |
| Convex deployment | `coordinated-corgi-211.convex.cloud` | `perfect-hornet-293.convex.cloud` |
| Database | Real users, real meal logs | Sandbox — throw-away data |
| Brevo sender | `"Thalify"` | `"Thalify (Dev)"` |
| Telegram webhook | Points at prod Convex | (off — bot is shared, currently wired to prod) |

**The rule:** all day-to-day work happens on `dev`. Promote to `main` only when you're shipping.

The frontend resolves the correct Convex URL at runtime via hostname (see `src/main.tsx:10-20`) — no per-branch env vars needed.

---

## Quick start for new engineers

### Prerequisites
- Node.js 20+
- `npm` (CI uses npm — bun/pnpm work locally but lockfiles will diverge)
- Access to the Convex `healthcoach-ai` project (ask the founder)
- Optional: Vercel access if you'll trigger manual deploys

### Setup
```bash
git clone https://github.com/siddharthkiit1-PM-gif/thalify_new.git
cd thalify_new
git checkout dev               # never work on main directly
npm install

# Point local frontend at dev Convex
npx convex deployment select siddharth-agrawal-c9f82:healthcoach-ai:dev-thalify
# Writes .env.local (gitignored) with the dev URLs
```

### Run locally — two terminals
```bash
npx convex dev    # T1: hot-reloads backend
npm run dev       # T2: hot-reloads frontend on http://localhost:5173
```

Local browser → dev Convex → isolated from prod. Sign in or create a fresh dev account.

---

## Project structure

```
.
├── convex/                          ← Backend (Convex Cloud)
│   ├── schema.ts                    ← All tables: users, profiles, mealLogs,
│   │                                  scanResults, chatMessages, familyMenus,
│   │                                  labResults, waitlist, rateLimits,
│   │                                  nudgeEvents, nudgeTemplates, notifications
│   ├── auth.ts / auth.config.ts     ← Convex Auth Password provider
│   ├── http.ts                      ← Mounts auth + WhatsApp + Telegram webhook routes
│   ├── crons.ts                     ← processNudgeQueue (60s) + 5 time-based seeders
│   │
│   ├── users.ts                     ← getProfile, createProfile, setPhotoStoragePreference
│   ├── meals.ts                     ← getTodayLogs, logMeal, getRecentLogs (+ internal variants)
│   ├── scan.ts                      ← scanMeal action + scanMealAsUser internal
│   ├── chat.ts                      ← chatWithCoach action + chatAsUser internal (Health Buddy AI)
│   ├── family.ts                    ← optimizeFamily: INDIAN_FOODS baseline + AI enrichment
│   ├── lab.ts                       ← analyzeLabReport (vision on blood tests)
│   ├── patterns.ts                  ← analyzePatterns (AI on 30 days of logs)
│   ├── waitlist.ts                  ← joinWaitlist + dedup + Brevo email
│   ├── email.ts                     ← Brevo helper + HTML templates
│   ├── accountEmails.ts             ← Signup welcome + Brevo contact add
│   ├── passwordReset.ts             ← Custom reset email provider
│   ├── admin.ts                     ← deleteUserByEmail, reviveQuietSkippedEvents, runWorkerOnce
│   │
│   ├── ai/claude.ts                 ← Gemini client wrapper + error classification
│   │                                  (filename is historical — we migrated from Claude)
│   ├── data/indianFoods.ts          ← 100+ dishes with verified calories/macros/portions
│   ├── data/foodMatcher.ts          ← Fuzzy match user dish names to DB
│   ├── lib/calorie.ts               ← Mifflin-St Jeor + Katch-McArdle BMR/TDEE math
│   ├── lib/rateLimit.ts             ← Per-user sliding-window limiter
│   ├── lib/security.ts              ← HTML escape helper
│   │
│   ├── nudges/                      ← Nudge engine (event queue → AI rewriter → delivery)
│   │   ├── rules.ts                 ← matchTrigger: event type → bucket
│   │   ├── signal.ts                ← computeSignal: kg-impact predictions
│   │   ├── gatekeepers.ts           ← Quiet hours (00:00-07:00 IST), freq cap, dedup, stale
│   │   ├── templatePicker.ts        ← Weighted-random template selection
│   │   ├── aiWriter.ts              ← Gemini personalization with template fallback
│   │   ├── worker.ts                ← processNudgeQueue: orchestrator
│   │   ├── timeSeeders.ts           ← Cron seeders (breakfast/lunch/dinner check, recap)
│   │   ├── seed.ts                  ← 25 starter templates
│   │   ├── queue.ts                 ← enqueue mutation
│   │   └── queries.ts               ← Frontend queries (recent, unreadCount, markRead)
│   │
│   ├── telegram/                    ← Telegram integration (free, primary push channel)
│   │   ├── adapter.ts               ← Bot API calls: sendText (with inline keyboards),
│   │   │                              editMessageText, answerCallbackQuery,
│   │   │                              sendChatAction, downloadFileAsBase64
│   │   ├── connect.ts               ← Deep-link opt-in flow (one-tap, no phone number)
│   │   ├── webhook.ts               ← Routes /start, STOP, text, photo, callback_query
│   │   └── handlers.ts              ← handleText (Health Buddy reply), handlePhoto
│   │                                  (scan + present buttons), handleCallback (log/skip)
│   │
│   ├── whatsapp/                    ← WhatsApp adapter — DORMANT, launching next month
│   │   ├── adapter.ts               ← Twilio sandbox + Meta Cloud API support
│   │   ├── optIn.ts                 ← 6-digit verification code flow
│   │   └── webhook.ts               ← STOP keyword + signature verification
│   │
│   └── razorpay/                    ← Founder paywall (₹99 → lifetime, first 50)
│       ├── adapter.ts               ← Razorpay REST wrapper: createOrder,
│       │                              fetchPayment, refundPayment, HMAC-SHA256
│       │                              webhook + checkout signature verification
│       ├── orders.ts                ← createPaymentOrder action (frontend-callable)
│       │                              + payments-table audit mutations
│       ├── founder.ts               ← Atomic founder-slot reservation (1-50,
│       │                              race-safe via Convex transactional mutation),
│       │                              auto-refund for slot 51+, founder welcome email
│       └── webhook.ts               ← /razorpay/webhook httpAction with signature
│                                      verification + amount/currency validation +
│                                      event router (payment.captured / failed /
│                                      refunds)
│
├── convex/lib/quota.ts              ← Plan-based usage quota — single source of
│                                      truth for "can this user do this action".
│                                      Free tier: per-action monthly caps (5 scans,
│                                      10 chats, 1 lab, 2 family, 1 pattern).
│                                      Lifetime tier: 3,000 unified actions / month.
│
├── src/                             ← Frontend (Vite + React)
│   ├── main.tsx                     ← Runtime Convex URL resolver (prod vs dev)
│   ├── App.tsx                      ← Router + protected routes
│   ├── index.css                    ← Design tokens (--sage-700, --cream, --tg-blue, etc.)
│   │
│   ├── pages/
│   │   ├── Waitlist.tsx             ← Landing page (channel-bar, hero, pillars, FAQ)
│   │   ├── Auth.tsx                 ← Login/Register/Forgot-password flows
│   │   ├── Onboarding.tsx           ← 3-step wizard (goal, diet, city)
│   │   ├── Dashboard.tsx            ← Today's calories + macros + Telegram CTA
│   │   ├── Scan.tsx                 ← Photo upload → AI scan + inline opt-in checkbox
│   │   ├── Chat.tsx                 ← Health Buddy chat UI
│   │   ├── Family.tsx               ← Per-user plate guidance from family menu
│   │   ├── Lab.tsx                  ← Lab report upload → markers + Indian-food advice
│   │   └── Patterns.tsx             ← 28-day heatmap + AI pattern analysis
│   │
│   └── components/
│       ├── Navbar.tsx               ← Top nav + NotificationBell + user dropdown
│       ├── NotificationBell.tsx     ← Unread badge + dropdown of recent nudges
│       ├── NotificationBanner.tsx   ← Toast on dashboard for latest unread nudge
│       ├── TelegramConnectModal.tsx ← 3-state modal (ready / waiting / connected)
│       ├── TelegramLogo.tsx         ← Brand-blue airplane SVG (used wherever
│       │                              Telegram is referenced)
│       ├── BodyStatsCard.tsx        ← TDEE calculator card
│       ├── ProtectedRoute.tsx       ← Auth-gated route wrapper
│       └── ui/…                     ← Progress, Severity, SectionLabel primitives
│
├── docs/superpowers/                ← Design specs + implementation plans
│   ├── specs/2026-04-25-nudge-engine-design.md
│   └── plans/2026-04-25-nudge-engine.md     ← ✅ shipped
│
├── vercel.json                      ← SPA rewrites + security headers (CSP, HSTS, etc.)
├── package.json
└── tsconfig*.json
```

---

## Environment variables

### Convex (set per-deployment via `npx convex env set KEY value`)

| Variable | Purpose | Set on |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio key | prod + dev |
| `BREVO_API_KEY` | Brevo transactional email | prod + dev |
| `BREVO_SENDER_EMAIL` | Verified Brevo sender | prod + dev |
| `BREVO_SENDER_NAME` | Display name in "From" | `"Thalify"` (prod) / `"Thalify (Dev)"` (dev) |
| `JWT_PRIVATE_KEY` | Convex Auth signing key (PKCS8 RSA) | prod + dev |
| `JWKS` | Public JWKS matching the JWT key | prod + dev |
| `SITE_URL` | Base URL for auth redirects | prod / preview URL |
| `APP_URL` | Base URL for email CTA links | same as SITE_URL |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) | prod (currently also dev) |
| `TELEGRAM_BOT_USERNAME` | Without `@` (e.g. `thalify_health_bot`) | prod (currently also dev) |
| `TELEGRAM_WEBHOOK_SECRET` | Random string echoed in `X-Telegram-Bot-Api-Secret-Token` | prod (currently also dev) |
| `NUDGES_ENABLED` | `true` to run the worker; flip to `false` for emergency pause | prod + dev |
| `RAZORPAY_KEY_ID` | Razorpay API key (live mode, `rzp_live_...`) | **prod only** — never set on dev |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret | **prod only** |
| `RAZORPAY_WEBHOOK_SECRET` | 256-bit HMAC secret matching the webhook in Razorpay dashboard | **prod only** |
| `WHATSAPP_*` | Reserved for future launch | not set yet |

List all: `npx convex env list`. Specific: `npx convex env get KEY`.

### Local-only (`.env.local`, gitignored — auto-written by `npx convex deployment select`)
```
CONVEX_DEPLOYMENT=dev:perfect-hornet-293
VITE_CONVEX_URL=https://perfect-hornet-293.convex.cloud
VITE_CONVEX_SITE_URL=https://perfect-hornet-293.convex.site
```

### Vercel
No env vars set — frontend resolves the Convex URL at runtime via hostname.

---

## Common commands

```bash
# ── Frontend ─────────────────────────────────────────────
npm run dev                     # Vite on :5173
npm run build                   # Typecheck + Vite build
npm run lint                    # ESLint
npm run test                    # Vitest (39 tests cover the nudge engine)

# ── Convex (backend) ─────────────────────────────────────
npx convex dev                  # Watch mode — hot-reloads functions + types
npx convex dev --once           # One-time push
npx convex env list             # Env vars on selected deployment
npx convex env set KEY value    # Set env var
npx convex logs                 # Tail function logs
npx convex data TABLE           # Print rows

# Switch deployments
npx convex deployment select siddharth-agrawal-c9f82:healthcoach-ai:dev-thalify
# Or one-shot:
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex env list

# Admin: delete a user + all their data
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 \
  npx convex run admin:deleteUserByEmail '{"email":"x@y.com"}'

# ── Git / deploy ─────────────────────────────────────────
git checkout dev                # default working branch
git push origin dev             # → Vercel preview URL (auto)

# Promote to production
git checkout main
git merge dev --no-ff -m "merge: <what shipped>"
git push origin main            # → Vercel auto-deploys to thalify.vercel.app (~10 sec)
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex deploy   # backend
```

> 💡 The auto-deploy chain (`git push origin main` → Vercel) was wired on 2026-04-26.
> Before that, every prod ship was a manual `vercel --prod` from local.

---

## How the nudge engine works

```
Event source                  Producer                  Worker (60s cron)               Delivery
────────────                  ────────                  ─────────────────                ────────
User logs a meal     ┐                              ┌→ matchTrigger (rules.ts)           ┌→ NotificationBell
User scans a meal    ├──→ enqueue(nudgeEvents) ────→│  computeSignal (signal.ts)         ├→ NotificationBanner
Time crons (5/day)   ┘     (status: pending)        │  gatekeepers (quiet, cap, dedup)   ├→ Telegram bot
                                                    │  pickTemplate (weighted)           └  (WhatsApp coming)
                                                    │  writeNudge (Gemini personalize)
                                                    └→ persistNudge (notifications row)
```

**Quiet hours:** worker skips system-initiated events between 00:00-07:00 IST. *User-initiated events (meal_logged, scan_completed) bypass quiet hours* — if you're awake at 1 AM logging dinner, you're awake enough for a nudge.

**Frequency cap:** max 5 nudges per user per 24h.
**Bucket dedup:** same bucket (hydration / movement / praise / etc.) won't fire twice within 12h.
**Stale:** events older than 4h get marked `skipped` so dead nudges don't suddenly appear in the morning.

39 unit tests cover the pure-logic modules (`npm run test`).

---

## How the Telegram bot works

The bot is **two-way**:

| You send | Bot does |
|---|---|
| `/start <token>` | Links your Telegram chat to your Thalify account (token comes from the Connect modal) |
| `/start` (no token) | Onboarding hint |
| `/help` | Capability summary |
| `STOP` | Unsubscribes from nudges |
| Text message | Routes to Health Buddy AI (same prompt + your live profile + today's meals + chat history) → reply in 1-3 sentences |
| 📷 Photo | Scans via our AI model → presents inline buttons `[✓ Log as <time-of-day suggestion>] [Skip]` + override row `[Breakfast] [Lunch] [Snack] [Dinner]` → tap to log → message edits in place to confirmation |
| Voice / video / file | Polite "I do text + photos for now" |

**Architecture:** webhook (`convex/telegram/webhook.ts`) classifies the update + schedules the slow work via `runAfter(0, ...)` so the HTTP response returns to Telegram inside their 60s budget. Real handlers live in `convex/telegram/handlers.ts`.

**Idempotency:** scanResults carries `consumedAt` + `consumedAsMealLogId`. Re-tapping a stale "Log" button on a cached message is a no-op.

---

## How the founder paywall works

The first 50 paying customers get **lifetime access for ₹99 once** — no monthly bills, ever. After 50, we switch to a monthly subscription tier (TBD).

```
User clicks "Become Founder" on dashboard or hits a quota wall
       ↓
/upgrade page (live "X of 50 left" counter)
       ↓
Convex action createPaymentOrder ──► POST https://api.razorpay.com/v1/orders
       ↓                                              ↓
Server stores Order in `payments` table              razorpay_order_id returned
(status: "created")                                   ↓
       ↓                                       Razorpay Checkout JS overlay opens
       ↓                                              ↓
       ↓                                       User pays via UPI / card / netbanking
       ↓                                              ↓
       ↓                                       Razorpay captures payment automatically
       ↓                                              ↓
                              POST → https://coordinated-corgi-211.convex.site/razorpay/webhook
                                              ↓
                          1. Verify X-Razorpay-Signature (HMAC-SHA256, constant-time)
                          2. Validate amount === 9900 paise (₹99) + currency === INR
                          3. Atomic counter increment in `counters` table:
                              - if count ≤ 50 → reserve slot, mark profile lifetime
                              - if count > 50 → trigger Razorpay refund + apology email
                          4. Send founder welcome email via Brevo (#N of 50)
                                              ↓
                          Profile flips to plan="lifetime", founderNumber=N
                                              ↓
                          Live useQuery on /upgrade page re-renders → "You're Founder #N"
```

### Live-mode safety (built in)

Real money flows through this system, so:

- **Webhook signature verification** on every inbound call (constant-time HMAC compare prevents timing attacks)
- **Amount must be exactly 9900 paise (₹99)** — anything else gets auto-refunded
- **Currency must be INR** — anything else gets auto-refunded
- **Idempotent** — Razorpay retries failed webhook deliveries; re-tapping a stale "Pay" button or the same webhook landing twice can't double-credit founder slots (`razorpayPaymentId` is checked)
- **Atomic founder counter** — Convex transactional mutations guarantee that even at 100 concurrent payments, only the first 50 webhook arrivals get founder slots
- **Refund is automatic + immediate** — slot 51+ / amount mismatch / already-lifetime → instant Razorpay refund call + apology email via Brevo
- **Audit trail** — every order + payment + webhook event lives in the `payments` table forever, even if profile is later deleted

### Quota

| Tier | Per-action limits / month |
|---|---|
| Free | 5 scans · 10 chats · 1 lab · 2 family · 1 pattern |
| Lifetime (founder + future subscription) | 3,000 unified actions (any type counts as 1) |

Limits reset every 30 days from first use. Quota check runs in the same transaction as the existing rate limiter, so there's no race between abuse-protection and paywall enforcement.

`enforceUserQuota()` (`convex/lib/quota.ts`) is the single source of truth. Currently in **soft mode** — counts every action but doesn't block (`ENFORCE_QUOTA = false` constants in scan.ts, chat.ts, lab.ts, family.ts, patterns.ts). Flip to `true` once you're ready for the wall to actually block free users hitting limits.

### Webhook URL (prod)

`https://coordinated-corgi-211.convex.site/razorpay/webhook`

Configured in Razorpay dashboard → Webhooks. Subscribed events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`, `order.paid`.

---

## Security

- Every auth-required mutation/action calls `getAuthUserId(ctx)`
- Anything that writes user-scoped data is an `internalMutation` — only callable from trusted backend code, never from the client (prevents mass-assignment)
- All email templates HTML-escape user-controlled fields
- No raw SQL — Convex is type-safe; SQL injection impossible
- React's default text rendering is XSS-safe and we never use unsafe innerHTML escapes anywhere in the codebase
- Frontend hardened in `vercel.json`: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy
- Secrets (`GEMINI_API_KEY`, `BREVO_API_KEY`, `JWT_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, etc.) live only in Convex env vars — never shipped to the browser
- Telegram webhook verifies `X-Telegram-Bot-Api-Secret-Token` header on every inbound update

---

## Common gotchas

- **Working on dev but accidentally ran `npx convex deploy`?** That pushes to whichever deployment is selected in `.env.local`. Always check `npx convex env list | head -1` first. For prod always be explicit: `CONVEX_DEPLOYMENT=prod:… npx convex deploy`
- **Auth session stuck / "No auth provider"?** The `JWKS` / `JWT_PRIVATE_KEY` env pair must match on the deployment. If you regenerate one, regenerate both.
- **Brevo email not arriving?** Sender must be verified — check `https://app.brevo.com/senders`. Current sender is `siddharth.kiit1@gmail.com`. Brevo's logs at `https://app.brevo.com/statistics/events` show delivery outcome.
- **Telegram bot silent?** Check the webhook health: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` — `pending_update_count` should be 0 and `last_error_message` should be absent.
- **Preview deploy hits prod Convex?** Check `src/main.tsx:16` — the hostname check must exactly match `n-beta-flame.vercel.app` / `thalify.vercel.app` / etc.
- **Razorpay webhook returning 401?** `RAZORPAY_WEBHOOK_SECRET` mismatch between Razorpay dashboard and Convex env. Re-generate the secret in dashboard, then `CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex env set RAZORPAY_WEBHOOK_SECRET '...'`.
- **Founder paid but didn't get lifetime?** `npx convex logs` will show `[razorpay]` lines for every webhook event + failure mode. Most common cause: payment.captured fired before user completed onboarding → `reserveFounderSlot` returned `no-profile` → auto-refund kicked in. The user got their money back.
- **Razorpay refund not in customer's bank yet?** Indian bank refund processing takes 5-7 business days. Check `Refunds` in the Razorpay dashboard for status. Our `payments` table tracks our local view.
- **Want to release a founder slot for testing?** `CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex run admin:resetFounderSlot '{"userId":"users:..."}'` — admin command (TODO: build this when needed).

---

## Roadmap

| | Status |
|---|---|
| Photo scan, Health Buddy chat, lab analysis, family optimizer | ✅ shipped |
| Nudge engine (events → AI → in-app bell + Telegram delivery) | ✅ shipped |
| Telegram two-way bot (chat + photo scan + inline buttons) | ✅ shipped |
| GitHub → Vercel auto-deploy chain | ✅ shipped (2026-04-26) |
| Founder paywall: ₹99 once → lifetime, first 50 customers (Razorpay) | ✅ shipped (2026-04-26) |
| Quota enforcement (kill switch — flip `ENFORCE_QUOTA = true`) | 🟡 soft-mode — counts but doesn't block; flip when ready |
| Subscription tier (₹99/mo via Razorpay Subscriptions for customer 51+) | ⏳ planned — Razorpay backend already has the primitives |
| Telegram paywall (magic-link upgrade prompt when free user hits limit) | ⏳ planned — small follow-up to enforcement |
| Account settings page (plan, usage meter, cancel) | ⏳ planned |
| WhatsApp delivery (branded sender) | 🟡 next month — adapter is wired, awaiting Twilio Senders / Meta WABA setup |
| Multi-user family profiles | ⏳ planned |
| Multi-language UI (currently English; AI handles Hindi/Hinglish) | ⏳ planned |
| Browser push notifications (web standard, no third party) | ⏳ planned |
| Voice-note transcription on Telegram | ⏳ planned |

---

## Contributing

This is currently a solo project shipping fast. If you spot a bug or want to suggest something, email **siddharth.kiit1@gmail.com** or open a GitHub issue.

---

## License

Licensed under the **Apache License, Version 2.0** ([LICENSE](./LICENSE)).

In plain English: you can use this code commercially, modify it, distribute it, sublicense it, and use it privately — at no cost. If you redistribute, you must:
- include a copy of the License,
- preserve copyright + the [NOTICE](./NOTICE) file, and
- mark any files you've modified.

Apache 2.0 also gives an **explicit patent grant** from contributors to users — important in the AI/health space. The license terminates if you sue claiming the work infringes a patent.

The Thalify name and logo are not licensed under Apache 2.0 — those remain trademarks of Siddharth Agrawal. Don't ship a fork called "Thalify".

---

## Contact

Built by **Siddharth Agrawal** in Bengaluru.
[siddharth.kiit1@gmail.com](mailto:siddharth.kiit1@gmail.com)
