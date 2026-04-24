# Thalify

AI health coach for Indian food. Point your phone at a thali, get calories + macros in 3 seconds. Chat with an AI coach in Hinglish. Upload lab reports for nutrition recommendations. Optimize family meals.

**Live production:** https://n-beta-flame.vercel.app
**GitHub:** https://github.com/siddharthkiit1-PM-gif/thalify_new

---

## Tech stack

- **Frontend:** Vite + React 19 + TypeScript, plain CSS (Warm Science design system)
- **Backend:** [Convex](https://convex.dev) — typed queries/mutations/actions + real-time sync + auth
- **Auth:** `@convex-dev/auth` Password provider with email+password, 8-char reset codes
- **AI:** Google Gemini Flash (`gemini-flash-latest`) — vision + chat, free 1500 req/day
- **Email:** Brevo transactional API (300 emails/day free) — waitlist welcome + signup congrats + password reset
- **Hosting:** Vercel (frontend), Convex Cloud (backend)

---

## Branch strategy — important

We run two completely isolated stacks.

| | **Production** | **Dev** |
|---|---|---|
| Git branch | `main` | `dev` |
| Frontend URL | https://n-beta-flame.vercel.app | Vercel preview URL (per-commit) |
| Convex deployment | `coordinated-corgi-211.convex.cloud` | `perfect-hornet-293.convex.cloud` |
| Database | Real users, real meal logs | Sandbox — test/throw-away data |
| Brevo sender name | "Thalify" | "Thalify (Dev)" |

**The rule:** all day-to-day work happens on `dev`. Promoting to `main` triggers a prod deploy and happens only on explicit request.

The frontend picks the correct Convex deployment at runtime via hostname — see `src/main.tsx`. No per-branch env var setup needed.

---

## Quick start for new engineers

### 1. Prerequisites
- Node.js 20+
- `npm` (or bun/pnpm — but CI uses npm)
- A Convex account with access to the `healthcoach-ai` project
- A Vercel account with access to the project (only needed if you're deploying)

### 2. Clone and install
```bash
git clone https://github.com/siddharthkiit1-PM-gif/thalify_new.git
cd thalify_new
git checkout dev            # never work on main directly
npm install
```

### 3. Point local dev at the dev Convex deployment
```bash
npx convex deployment select siddharth-agrawal-c9f82:healthcoach-ai:dev-thalify
```
This writes `.env.local` (gitignored) with:
```
CONVEX_DEPLOYMENT=dev:perfect-hornet-293
VITE_CONVEX_URL=https://perfect-hornet-293.convex.cloud
VITE_CONVEX_SITE_URL=https://perfect-hornet-293.convex.site
```

### 4. Run locally
Two terminals:
```bash
# Terminal 1: Convex dev (watches convex/*.ts, hot-reloads backend)
npx convex dev

# Terminal 2: Vite dev server (watches src/, hot-reloads frontend)
npm run dev
```
Open http://localhost:5173 — all your actions hit the dev Convex deployment, isolated from prod.

---

## Project structure

```
.
├── convex/                        ← Backend (Convex Cloud)
│   ├── schema.ts                  ← All tables: users, profiles, mealLogs,
│   │                                 scanResults, chatMessages, familyMenus,
│   │                                 labResults, waitlist, rateLimits
│   ├── auth.ts                    ← Convex Auth Password provider + reset config
│   ├── auth.config.ts             ← Registers the JWT provider
│   ├── http.ts                    ← Mounts auth HTTP routes
│   ├── users.ts                   ← getProfile, createProfile, updateBodyStats
│   ├── meals.ts                   ← getTodayLogs, logMeal, getRecentLogs
│   ├── scan.ts                    ← scanMeal action (Gemini vision) + rate-limited
│   ├── chat.ts                    ← chatWithCoach action (Gemini chat) + history
│   ├── family.ts                  ← optimizeFamily: INDIAN_FOODS baseline + Gemini enrichment
│   ├── lab.ts                     ← analyzeLabReport (Gemini vision on blood tests)
│   ├── patterns.ts                ← analyzePatterns (Gemini on 30 days of logs)
│   ├── waitlist.ts                ← joinWaitlist action + dedup + Brevo email
│   ├── email.ts                   ← Brevo helper + HTML templates
│   ├── accountEmails.ts           ← Signup congrats email + Brevo contact add
│   ├── passwordReset.ts           ← Custom reset email provider (Brevo)
│   ├── admin.ts                   ← deleteUserByEmail (internal cleanup)
│   │
│   ├── ai/claude.ts               ← Gemini client wrapper + error classification
│   │                                 (name is historical — we migrated from Claude)
│   ├── data/indianFoods.ts        ← 100+ dishes with verified calories/macros/portions
│   ├── data/foodMatcher.ts        ← Fuzzy match user dish names to DB
│   ├── lib/calorie.ts             ← Mifflin-St Jeor + Katch-McArdle BMR/TDEE math
│   ├── lib/rateLimit.ts           ← Per-user sliding-window limiter
│   └── lib/security.ts            ← HTML escape helper
│
├── src/                           ← Frontend (Vite + React)
│   ├── main.tsx                   ← Runtime Convex URL resolver (prod vs dev)
│   ├── App.tsx                    ← Router + protected routes
│   ├── index.css                  ← Design tokens: --sage-700, --cream, --sand, etc.
│   │
│   ├── pages/
│   │   ├── Waitlist.tsx           ← Landing page + signup form
│   │   ├── Auth.tsx               ← Login/Register/Forgot-password flows
│   │   ├── Onboarding.tsx         ← 3-step wizard (goal, diet, city)
│   │   ├── Dashboard.tsx          ← Today's calories, macros, BodyStatsCard
│   │   ├── Scan.tsx               ← Photo upload → AI scan result
│   │   ├── Chat.tsx               ← Coach chat UI
│   │   ├── Family.tsx             ← Dish input → before/after plate optimizer
│   │   ├── Lab.tsx                ← Lab report upload → markers + advice
│   │   └── Patterns.tsx           ← Heatmap + AI pattern analysis
│   │
│   └── components/
│       ├── Navbar.tsx             ← Top nav + user dropdown + logout
│       ├── ProtectedRoute.tsx     ← Auth-gated route wrapper
│       ├── BodyStatsCard.tsx      ← TDEE calculator card
│       ├── ErrorBoundary.tsx      ← Crash catch-all
│       ├── OfflineToast.tsx       ← Offline detection banner
│       └── ui/…                   ← Progress, Severity, SectionLabel primitives
│
├── vercel.json                    ← SPA rewrites + security headers (CSP, HSTS, etc.)
├── package.json
└── tsconfig*.json
```

---

## Environment variables

### Convex deployments
Set via `npx convex env set KEY value` on the selected deployment.

| Variable | Purpose | Scope |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio key for Gemini Flash | Both prod + dev |
| `BREVO_API_KEY` | Brevo transactional email API key | Both prod + dev |
| `BREVO_SENDER_EMAIL` | Verified sender in Brevo | Both prod + dev |
| `BREVO_SENDER_NAME` | Display name in "From" | `"Thalify"` (prod) / `"Thalify (Dev)"` (dev) |
| `JWT_PRIVATE_KEY` | RSA PKCS8 key for signing auth tokens | Both (same key on both for simplicity) |
| `JWKS` | Public JWKS matching the JWT_PRIVATE_KEY | Both |
| `SITE_URL` | Base URL for auth redirects | `https://n-beta-flame.vercel.app` (prod) / preview URL (dev) |
| `APP_URL` | Base URL for email CTA links | Same as SITE_URL |

List current vars: `npx convex env list`
Get a specific var: `npx convex env get KEY`

### Local-only (.env.local — gitignored)
Auto-written by `npx convex deployment select`. Never commit these.
```
CONVEX_DEPLOYMENT=dev:perfect-hornet-293
VITE_CONVEX_URL=https://perfect-hornet-293.convex.cloud
VITE_CONVEX_SITE_URL=https://perfect-hornet-293.convex.site
```

### Vercel
No env vars currently set — the frontend resolves the Convex URL at runtime based on hostname (see `src/main.tsx:10-20`).

---

## Common commands

```bash
# ── Frontend ─────────────────────────────────────────────
npm run dev                     # Vite dev server on :5173
npm run build                   # Typecheck + build
npm run lint                    # ESLint
npm run test                    # Vitest

# ── Convex (backend) ─────────────────────────────────────
npx convex dev                  # Watch mode: hot-reloads functions + types
npx convex dev --once           # One-time push (no watch)
npx convex env list             # Show env vars on selected deployment
npx convex env set KEY value    # Set env var
npx convex logs                 # Tail function logs
npx convex data TABLE           # Print rows from a table

# Switch between prod and dev Convex
npx convex deployment select siddharth-agrawal-c9f82:healthcoach-ai:dev-thalify
# then use env override for one command:
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex env list

# Delete a user + all their data (admin)
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 \
  npx convex run admin:deleteUserByEmail '{"email":"x@y.com"}'

# ── Git / deploy ─────────────────────────────────────────
git checkout dev                # default working branch
git push origin dev             # deploys a Vercel preview (hits dev Convex)

# Promote to production (do only when prod-ready)
git checkout main
git merge dev
git push origin main            # auto-deploys to n-beta-flame.vercel.app
CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 npx convex deploy
```

---

## Feature notes

### Nutrition calculation
- **BMR** via Mifflin-St Jeor (standard) or Katch-McArdle (when body fat % known — more accurate)
- **TDEE** = BMR × activity multiplier (1.2 sedentary → 1.9 athlete)
- **Target** = TDEE + goal adjustment (lose -500, diabetes -300, maintain 0, gain +400). Floored at 1,200 for safety.
- All formulas in `convex/lib/calorie.ts` with inline citations.

### Food database
- 100+ Indian dishes in `convex/data/indianFoods.ts` with cal/protein/carbs/fat + portion metadata
- Values verified against Tarla Dalal, HealthifyMe, FatSecret India, NutritionValue.org, USDA FDC
- `convex/data/foodMatcher.ts` handles fuzzy matching: aliases, spelling variants, token overlap
- Some dishes accept synonyms via the FOOD_ALIASES map (e.g. `chapathi` → `chapati`)

### Rate limiting
Per-user sliding windows on every AI endpoint (`convex/lib/rateLimit.ts`):
```
scan    10/min   60/hr   200/day
chat    20/min   200/hr  1000/day
family  10/min   40/hr   100/day
lab      5/min   20/hr    40/day
patterns 5/min   20/hr    40/day
waitlist 3/min   10/hr    30/day  (keyed by email)
signup welcome 2/min  5/hr  10/day
```

### Security
- All auth-requiring mutations/actions check `getAuthUserId`
- Mutations that write user-scoped data are `internalMutation` (can only be called from trusted actions — prevents mass-assignment from client)
- Email templates HTML-escape user-controlled fields (name, email)
- Convex has no raw SQL — SQL injection impossible by design
- React escapes all rendered content by default; no `dangerouslySetInnerHTML` anywhere
- CSP + HSTS + X-Frame-Options DENY in `vercel.json`
- Secrets (`GEMINI_API_KEY`, `BREVO_API_KEY`, `JWT_PRIVATE_KEY`) only live in Convex env vars — never shipped to the browser

---

## Common gotchas

- **Working on dev but accidentally ran `npx convex deploy`?** That pushes to whichever deployment is selected in `.env.local`. Always check `npx convex env list | head -1` to confirm you're on dev before running `deploy`. For prod, always explicit: `CONVEX_DEPLOYMENT=prod:… npx convex deploy`.
- **Auth session stuck / "No auth provider"?** The JWKS / JWT_PRIVATE_KEY env pair must match on the deployment. If you regenerate one, regenerate both.
- **Brevo email not arriving?** Sender must be verified — check `https://app.brevo.com/senders`. Current sender is `siddharth.kiit1@gmail.com`. Brevo's logs at `https://app.brevo.com/statistics/events` show delivery outcome.
- **Preview deploy hits prod Convex?** Check `src/main.tsx:16` — the hostname check is case-sensitive and must exactly match `n-beta-flame.vercel.app`.

---

## What's not built yet (roadmap)

- Multi-user family profiles (current "family optimizer" is single-user only)
- WhatsApp nudges (button exists on dashboard but not wired)
- Weekly trend charts (only day-level totals today)
- Multi-language UI (landing page claims 5 languages — backend supports Hindi/Hinglish in AI prompts, UI is English-only)
- Meal editing after scan (currently scan results are write-once)

---

## Contact

Questions / access requests: agrawalsiddharth18@gmail.com
