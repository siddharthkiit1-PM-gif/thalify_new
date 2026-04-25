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
