import { internalMutation } from "../_generated/server";

type Seed = {
  bucket: string;
  trigger: string;
  variant: string;
  template: string;
  weight?: number;
};

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

  // Re-engagement after 3+ days of silence — weight/goal-aware variants
  { bucket: "prompt", trigger: "re-engagement", variant: "re-v2", template: "{name}, 3 days off the radar. At {weightKg} kg, one logged meal today keeps the trend honest — even just a chai counts." },
  { bucket: "prompt", trigger: "re-engagement", variant: "re-v3", template: "Coming back in is the hardest part, {name}. Open Thalify, snap your next meal, done in 20 seconds." },
  { bucket: "prompt", trigger: "re-engagement", variant: "re-v4", template: "{name}, your {calorieGoal} cal/day plan is waiting. Skip the guilt — log whatever you ate today, even roughly." },
  { bucket: "prompt", trigger: "re-engagement", variant: "re-v5", template: "Quiet week, {name}? The data only helps when it's there. One photo brings it all back." },

  // Daily log prompt — once a day, only fires if user hasn't logged anything today
  { bucket: "prompt", trigger: "daily-log-prompt", variant: "dlp-v1", template: "{name}, haven't seen a meal logged today. Snap a photo if you can — or just type what you remember. Both work." },
  { bucket: "prompt", trigger: "daily-log-prompt", variant: "dlp-v2", template: "Quick one, {name} — log today's meals before the day blurs. Photo or text, your call." },
  { bucket: "prompt", trigger: "daily-log-prompt", variant: "dlp-v3", template: "{name}, 30 seconds: photo of dinner, or type out what you ate. Your future self loves consistency." },

  // Food repetition — fires when same food appears in 4+ of last 7 days
  { bucket: "prompt", trigger: "food-repetition", variant: "fr-v1", template: "{name}, you've had {food} 4+ days this week. Bored or busy? One swap — say sprouts or paneer bhurji — keeps the protein interesting." },
  { bucket: "prompt", trigger: "food-repetition", variant: "fr-v2", template: "Routine's a strength, {name}, but {food} shows up a lot lately. Try mixing in a different sabzi tomorrow — your gut will notice." },
  { bucket: "prompt", trigger: "food-repetition", variant: "fr-v3", template: "{name}, {food} is your default this week. Worth a small change-up: dal-chawal one day, khichdi another, keeps micronutrients varied." },
  { bucket: "prompt", trigger: "food-repetition", variant: "fr-v4", template: "Heads up, {name} — {food} repeating most days. Same calories, more variety, better long-term. One swap this week is enough." },

  // Reflection (3)
  { bucket: "reflection", trigger: "daily-recap", variant: "dr-v1", template: "{name}, day's a wrap. Tomorrow, lead with protein at breakfast — sets the tone." },
  { bucket: "reflection", trigger: "weekly-recap", variant: "wr-v1", template: "Week wrapped, {name}. Fresh sheet tomorrow. One small change: protein at breakfast every day this week." },
  { bucket: "reflection", trigger: "daily-recap", variant: "dr-v2", template: "Quiet day, {name}. Tomorrow's plan: protein-first breakfast." },

  // Plan (3)
  { bucket: "plan", trigger: "tomorrow-plan", variant: "tp-v1", template: "{name}, tomorrow's plan: dal + roti + sabzi at lunch. Keeps you under your target without feeling deprived." },
  { bucket: "plan", trigger: "weekend-plan", variant: "wp-v1", template: "Weekend, {name} — eat well, walk more. One indulgent meal is fine; just log it." },
  { bucket: "plan", trigger: "post-doctor-plan", variant: "pdp-v1", template: "After your doctor visit, {name}, focus on consistency over perfection. One meal at a time." },

  // Upgrade prompt — only fires for free users who've logged 3+ days, with a
  // 7-day cooldown. Templates carry the /upgrade link so Telegram users can
  // tap straight to checkout.
  { bucket: "plan", trigger: "upgrade-prompt", variant: "up-v1", template: "{name}, you've been showing up — that's the hard part. Founder spot is ₹99 once, lifetime: https://thalify.vercel.app/upgrade" },
  { bucket: "plan", trigger: "upgrade-prompt", variant: "up-v2", template: "Quick one, {name} — first 50 Founders get lifetime access for ₹99 (cheaper than 1 month of most apps). thalify.vercel.app/upgrade" },
  { bucket: "plan", trigger: "upgrade-prompt", variant: "up-v3", template: "{name}, your habit's forming. Lock it in: ₹99 once = lifetime AI scans + unlimited chat. thalify.vercel.app/upgrade" },
  { bucket: "plan", trigger: "upgrade-prompt", variant: "up-v4", template: "Worth flagging, {name}: Founder pricing (₹99 once, lifetime) ends at 50 customers. You qualify — thalify.vercel.app/upgrade" },
];

export const seedTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotent: insert only templates whose `variant` doesn't already exist.
    // Lets us add new variants over time without wiping the existing ones.
    const existing = await ctx.db.query("nudgeTemplates").collect();
    const existingVariants = new Set(existing.map((t) => t.variant));

    let inserted = 0;
    for (const t of SEED_TEMPLATES) {
      if (existingVariants.has(t.variant)) continue;
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
    return { inserted, skipped: existing.length };
  },
});
