import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const createProfile = mutation({
  args: {
    goal: v.union(v.literal("lose"), v.literal("maintain"), v.literal("diabetes"), v.literal("gain")),
    dietType: v.union(v.literal("veg"), v.literal("veg_eggs"), v.literal("nonveg"), v.literal("jain"), v.literal("vegan")),
    city: v.union(v.literal("bangalore"), v.literal("mumbai"), v.literal("delhi"), v.literal("other")),
    allergies: v.array(v.string()),
    dislikes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const calorieGoalMap = { lose: 1600, maintain: 1900, diabetes: 1700, gain: 2300 };

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      return await ctx.db.patch(existing._id, {
        ...args,
        calorieGoal: calorieGoalMap[args.goal],
        onboardingComplete: true,
      });
    }

    return await ctx.db.insert("profiles", {
      userId,
      ...args,
      calorieGoal: calorieGoalMap[args.goal],
      onboardingComplete: true,
      scanCount: 0,
    });
  },
});
