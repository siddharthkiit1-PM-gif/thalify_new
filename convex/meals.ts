import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const getTodayLogs = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("mealLogs")
      .withIndex("by_userId_date", q => q.eq("userId", userId).eq("date", date))
      .collect();
  },
});

export const logMeal = mutation({
  args: {
    date: v.string(),
    mealType: v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("snack"), v.literal("dinner")),
    items: v.array(v.object({
      name: v.string(), portion: v.string(),
      cal: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(),
    })),
    totalCal: v.number(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const mealId = await ctx.db.insert("mealLogs", { userId, ...args });
    await ctx.scheduler.runAfter(0, internal.nudges.queue.enqueue, {
      userId,
      type: "meal_logged",
      payload: {
        mealType: args.mealType,
        totalCal: args.totalCal,
        itemNames: args.items.map((i) => i.name),
      },
    });
    return mealId;
  },
});

export const getRecentLogs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("mealLogs")
      .withIndex("by_userId_date", q => q.eq("userId", userId))
      .order("desc")
      .take(90);
  },
});

// ── Internal-callable variants used by the Telegram webhook ─────────────

export const getTodayLogsForUser = internalQuery({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    return await ctx.db
      .query("mealLogs")
      .withIndex("by_userId_date", q => q.eq("userId", userId).eq("date", date))
      .collect();
  },
});

export const logMealForUser = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    mealType: v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("snack"), v.literal("dinner")),
    items: v.array(v.object({
      name: v.string(), portion: v.string(),
      cal: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(),
    })),
    totalCal: v.number(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, { userId, ...args }) => {
    const mealId = await ctx.db.insert("mealLogs", { userId, ...args });
    await ctx.scheduler.runAfter(0, internal.nudges.queue.enqueue, {
      userId,
      type: "meal_logged",
      payload: {
        mealType: args.mealType,
        totalCal: args.totalCal,
        itemNames: args.items.map((i) => i.name),
      },
    });
    return mealId;
  },
});
