import { action, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { generateText, extractJson, classifyError } from "./ai/claude";
import { matchDish } from "./data/foodMatcher";
import { checkRateLimit } from "./lib/rateLimit";
import { enforceUserQuota } from "./lib/quota";

const ENFORCE_QUOTA = false;

export const enforceFamilyRateLimit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await checkRateLimit(ctx, userId, "family");
    await enforceUserQuota(ctx, userId, "family", { enforce: ENFORCE_QUOTA });
  },
});

type Action = "keep" | "reduce" | "skip" | "add";

type OptimizedDish = {
  name: string;
  action: Action;
  recommendation: string;
  cal: number;
  protein: number;
  portion: string;
  matched: boolean;
};

type AiAdvice = {
  dishes: { name: string; action: Action; recommendation: string }[];
  additions?: { name: string; recommendation: string }[];
};

function baselineOptimization(
  dishes: string[],
  goal: string,
): OptimizedDish[] {
  const entries = dishes.map(dish => ({ dish, food: matchDish(dish) }));
  const carbCount = entries.filter(e => e.food.category === "carb").length;
  const proteinTotal = entries.reduce((sum, e) => sum + e.food.protein, 0);

  const result: OptimizedDish[] = entries.map(({ dish, food }) => {
    let action: Action = "keep";
    let recommendation = food.matched
      ? `About ${food.cal} cal per ${food.portion}.`
      : `We don't have nutrition data for "${dish}" yet — showing rough estimate.`;

    if ((goal === "lose" || goal === "diabetes") && food.category === "carb" && carbCount > 1) {
      action = "reduce";
      recommendation = `Reduce to half portion — this meal already has ${carbCount} carb items (${food.cal} cal at full ${food.portion}).`;
    } else if (food.category === "fat" && (goal === "lose" || goal === "diabetes")) {
      action = "reduce";
      recommendation = "Use sparingly — 1 tsp max at your calorie goal.";
    } else if (food.cal > 350 && goal !== "gain") {
      action = "reduce";
      recommendation = `High-calorie item (${food.cal} cal per ${food.portion}) — take a smaller portion.`;
    }

    return {
      name: dish,
      action,
      recommendation,
      cal: food.cal,
      protein: food.protein,
      portion: food.portion,
      matched: food.matched,
    };
  });

  if (proteinTotal < 20) {
    const raita = matchDish("raita");
    result.push({
      name: "Cucumber Raita",
      action: "add",
      recommendation: "Add raita for protein and probiotics — this meal is low on protein.",
      cal: raita.cal,
      protein: raita.protein,
      portion: raita.portion,
      matched: true,
    });
  }

  return result;
}

async function enrichWithClaude(
  baseline: OptimizedDish[],
  goal: string,
  dietType: string,
  dislikes: string,
): Promise<OptimizedDish[]> {
  const baselineSummary = baseline.map(d => `${d.name}: ${d.cal} cal, ${d.protein}g protein`).join("\n");

  const systemPrompt = `You are a senior clinical nutritionist specializing in Indian family meal planning.

You will receive a list of dishes with their known calorie/protein values and an initial rule-based recommendation. Your job is to refine the recommendations using clinical knowledge — adjust actions and rewrite advice to be specific and warm.

Return ONLY a valid JSON object:
{
  "dishes": [{"name": "exact dish name from input", "action": "keep|reduce|skip", "recommendation": "1 specific sentence"}],
  "additions": [{"name": "suggested addition", "recommendation": "why add it"}]
}

Rules:
- Keep the exact dish names from the input
- Action must be one of: keep, reduce, skip
- Recommendations must reference specific Indian food knowledge (portion sizes in katori/roti, cooking methods, macro balance)
- Only suggest additions if genuinely needed for nutritional balance
- Zero other text. JSON only.`;

  const userMessage = `User profile:
- Health goal: ${goal}
- Diet type: ${dietType}
- Food dislikes: ${dislikes || "none"}

Family meal (with actual nutrition data):
${baselineSummary}

Refine the recommendations.`;

  const raw = await generateText({
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1024,
  });

  const advice = extractJson<AiAdvice>(raw);

  const normalizeName = (s: string) =>
    s.toLowerCase().trim().replace(/s\b/g, "").replace(/\s+/g, " ").replace(/[^a-z ]/g, "");
  const baselineKeys = new Set(baseline.map(d => normalizeName(d.name)));
  const baselineMatcherKeys = new Set(baseline.map(d => matchDish(d.name).key));

  const enriched: OptimizedDish[] = baseline.map(d => {
    const dKey = normalizeName(d.name);
    const aiDish = advice.dishes?.find(x => normalizeName(x.name) === dKey);
    if (aiDish && (aiDish.action === "keep" || aiDish.action === "reduce" || aiDish.action === "skip")) {
      return { ...d, action: aiDish.action, recommendation: aiDish.recommendation };
    }
    return d;
  });

  if (advice.additions && Array.isArray(advice.additions)) {
    for (const add of advice.additions) {
      const addKey = normalizeName(add.name);
      if (baselineKeys.has(addKey)) continue;
      const matched = matchDish(add.name);
      if (baselineMatcherKeys.has(matched.key)) continue;
      enriched.push({
        name: add.name,
        action: "add",
        recommendation: add.recommendation,
        cal: matched.cal,
        protein: matched.protein,
        portion: matched.portion,
        matched: matched.matched,
      });
    }
  }

  return enriched;
}

export const optimizeFamily = action({
  args: {
    dishes: v.array(v.string()),
    date: v.string(),
  },
  handler: async (ctx, { dishes, date }): Promise<{ plate: OptimizedDish[]; warning: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (dishes.length === 0) throw new Error("Please add at least one dish.");
    if (dishes.length > 15) throw new Error("Too many dishes — max 15 per meal.");
    for (const dish of dishes) {
      if (typeof dish !== "string" || dish.length > 60) throw new Error("Dish name too long — keep under 60 characters.");
    }

    await ctx.runMutation(internal.family.enforceFamilyRateLimit, { userId });

    const profile = await ctx.runQuery(api.users.getProfile);
    const goal = profile?.goal ?? "maintain";
    const dietType = profile?.dietType ?? "veg";
    const dislikes = profile?.dislikes?.join(", ") ?? "";

    const baseline = baselineOptimization(dishes, goal);

    let finalPlate = baseline;
    let warning: string | null = null;
    try {
      finalPlate = await enrichWithClaude(baseline, goal, dietType, dislikes);
    } catch (err) {
      const classified = classifyError(err);
      warning = classified.userMessage;
    }

    await ctx.runMutation(api.family.saveFamilyMenu, {
      date,
      dishes,
      optimizedPlate: finalPlate.map(d => ({
        name: d.name, action: d.action, recommendation: d.recommendation, cal: d.cal,
      })),
    });

    return { plate: finalPlate, warning };
  },
});

export const saveFamilyMenu = mutation({
  args: {
    date: v.string(),
    dishes: v.array(v.string()),
    optimizedPlate: v.array(v.object({
      name: v.string(),
      action: v.union(v.literal("keep"), v.literal("reduce"), v.literal("skip"), v.literal("add")),
      recommendation: v.string(),
      cal: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("familyMenus", { userId, ...args });
  },
});
