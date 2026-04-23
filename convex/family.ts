import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

type OptimizedDish = {
  name: string;
  action: "keep" | "reduce" | "skip" | "add";
  recommendation: string;
  cal: number;
};

export const optimizeFamily = action({
  args: {
    dishes: v.array(v.string()),
    date: v.string(),
  },
  handler: async (ctx, { dishes, date }): Promise<OptimizedDish[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.runQuery(api.users.getProfile);
    const goal = profile?.goal ?? "maintain";
    const dietType = profile?.dietType ?? "veg";
    const dislikes = profile?.dislikes?.join(", ") || "none";

    const systemPrompt = `You are a senior clinical nutritionist specializing in Indian family meal planning.

Given a list of Indian dishes for a family meal, analyze each dish and provide optimization recommendations.

Return ONLY a valid JSON array. Each dish gets one object with:
{"name": "dish name", "action": "keep|reduce|skip|add", "recommendation": "specific 1-sentence advice", "cal": estimated_calories_per_serving}

For "add" items, recommend 1-2 additions that complement the meal nutritionally.

Action rules:
- "keep": dish is appropriate for the health goal
- "reduce": eat half portion or less
- "skip": avoid entirely or swap for better option
- "add": suggest a missing nutritional element

Return ONLY the JSON array. No markdown, no code fences, no explanation.`;

    const userMessage = `Family meal dishes: ${dishes.join(", ")}

User health goal: ${goal}
Diet type: ${dietType}
Food dislikes: ${dislikes}

Analyze each dish and provide optimization recommendations for this Indian family meal. Also suggest 1-2 additions if the meal lacks protein, fiber, or probiotics.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let optimizedPlate: OptimizedDish[];
    try {
      const response = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const raw = (response.content[0] as { type: string; text: string }).text;
      const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0] ?? raw;
      optimizedPlate = JSON.parse(jsonStr) as OptimizedDish[];
    } catch {
      optimizedPlate = dishes.map(dish => ({
        name: dish,
        action: "keep" as const,
        recommendation: "Good choice for your meal.",
        cal: 200,
      }));
    }

    await ctx.runMutation(api.family.saveFamilyMenu, { date, dishes, optimizedPlate });

    return optimizedPlate;
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
