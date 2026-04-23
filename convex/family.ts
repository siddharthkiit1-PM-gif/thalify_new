import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { INDIAN_FOODS } from "./data/indianFoods";

type Goal = "lose" | "maintain" | "diabetes" | "gain";

function buildOptimizedPlate(
  dishes: string[],
  goal: Goal,
) {
  const result: { name: string; action: "keep" | "reduce" | "skip" | "add"; recommendation: string; cal: number }[] = [];

  let carbCount = 0;
  let totalProtein = 0;
  const entries: { dish: string; food: typeof INDIAN_FOODS[string] | null }[] = [];

  for (const dish of dishes) {
    const key = dish.toLowerCase().replace(/ /g, "_");
    const food = INDIAN_FOODS[key] ?? null;
    if (food?.category === "carb") carbCount++;
    if (food) totalProtein += food.protein;
    entries.push({ dish, food });
  }

  for (const { dish, food } of entries) {
    if (!food) {
      result.push({ name: dish, action: "keep", recommendation: `We don't recognise "${dish}" yet — keeping as-is.`, cal: 0 });
      continue;
    }
    let action: "keep" | "reduce" | "skip" = "keep";
    let recommendation = "Good choice — keep this.";

    if ((goal === "lose" || goal === "diabetes") && food.category === "carb" && carbCount > 1) {
      action = "reduce";
      recommendation = "Reduce to half portion to stay within your carb limit.";
    } else if (food.category === "fat" && goal === "lose") {
      action = "reduce";
      recommendation = "Use sparingly — 1 tsp max.";
    } else if (food.cal > 300 && goal === "diabetes") {
      action = "reduce";
      recommendation = "High-calorie item — take a smaller portion.";
    }

    result.push({ name: dish, action, recommendation, cal: food.cal });
  }

  if (totalProtein < 20) {
    result.push({ name: "Cucumber Raita", action: "add", recommendation: "Add raita for protein and probiotics.", cal: INDIAN_FOODS["raita"].cal });
  }

  return result;
}

export const optimizeFamily = action({
  args: {
    dishes: v.array(v.string()),
    date: v.string(),
  },
  handler: async (ctx, { dishes, date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.runQuery(api.users.getProfile);
    const goal = (profile?.goal ?? "maintain") as Goal;

    const optimizedPlate = buildOptimizedPlate(dishes, goal);

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
