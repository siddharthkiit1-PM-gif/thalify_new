import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { CLAUDE_MODEL, getClient, extractText, extractJson, classifyError } from "./ai/claude";
import { matchDish } from "./data/foodMatcher";

type Action = "keep" | "reduce" | "skip" | "add";

type OptimizedDish = {
  name: string;
  action: Action;
  recommendation: string;
  cal: number;
  protein: number;
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
      ? `Good choice — about ${food.cal} cal per serving.`
      : `We don't recognise "${dish}" — using rough estimate.`;

    if ((goal === "lose" || goal === "diabetes") && food.category === "carb" && carbCount > 1) {
      action = "reduce";
      recommendation = `Reduce to half portion to stay within your carb budget (${food.cal} cal at full portion).`;
    } else if (food.category === "fat" && (goal === "lose" || goal === "diabetes")) {
      action = "reduce";
      recommendation = "Use sparingly — 1 tsp max.";
    } else if (food.cal > 300 && goal !== "gain") {
      action = "reduce";
      recommendation = `High-calorie item (${food.cal} cal) — take a smaller portion.`;
    }

    return { name: dish, action, recommendation, cal: food.cal, protein: food.protein };
  });

  if (proteinTotal < 20) {
    const raita = matchDish("raita");
    result.push({
      name: "Cucumber Raita",
      action: "add",
      recommendation: "Add raita for protein and probiotics — this meal is low on protein.",
      cal: raita.cal,
      protein: raita.protein,
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

  const client = getClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const advice = extractJson<AiAdvice>(extractText(response));

  const byName = new Map(baseline.map(d => [d.name.toLowerCase(), d]));
  const enriched: OptimizedDish[] = baseline.map(d => {
    const aiDish = advice.dishes?.find(x => x.name.toLowerCase() === d.name.toLowerCase());
    if (aiDish && (aiDish.action === "keep" || aiDish.action === "reduce" || aiDish.action === "skip")) {
      return { ...d, action: aiDish.action, recommendation: aiDish.recommendation };
    }
    return d;
  });

  if (advice.additions && Array.isArray(advice.additions)) {
    for (const add of advice.additions) {
      if (byName.has(add.name.toLowerCase())) continue;
      const matched = matchDish(add.name);
      enriched.push({
        name: add.name,
        action: "add",
        recommendation: add.recommendation,
        cal: matched.cal,
        protein: matched.protein,
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
