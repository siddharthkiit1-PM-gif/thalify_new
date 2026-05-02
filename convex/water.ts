/**
 * Water tracking — per-instance logs (one row per glass/bottle).
 *
 * Day-summed in queries via the by_userId_date index. Default daily
 * target is 8 × 250ml = 2000ml; we surface that in the UI but every
 * row stores the exact ml the user logged so future analytics can
 * reason about container habits.
 */

import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const DAILY_TARGET_ML = 2000;

function todayDateIST(): string {
  // YYYY-MM-DD in Asia/Kolkata so a midnight glass sits in the right day
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

const SOURCE = v.union(v.literal("web"), v.literal("telegram"));

// ─── Public mutations / queries ──────────────────────────────────────

export const logWater = mutation({
  args: {
    amountMl: v.number(),
    source: SOURCE,
    containerType: v.optional(v.string()),
  },
  handler: async (ctx, { amountMl, source, containerType }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (amountMl <= 0 || amountMl > 5000) {
      throw new Error("Water amount must be between 1 and 5000 ml");
    }
    return await ctx.db.insert("waterLogs", {
      userId,
      date: todayDateIST(),
      amountMl: Math.round(amountMl),
      source,
      containerType,
      createdAt: Date.now(),
    });
  },
});

export const deleteWaterLog = mutation({
  args: { waterLogId: v.id("waterLogs") },
  handler: async (ctx, { waterLogId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const log = await ctx.db.get(waterLogId);
    if (!log || log.userId !== userId) throw new Error("Water log not found");
    await ctx.db.delete(waterLogId);
  },
});

export const getTodayWater = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { totalMl: 0, target: DAILY_TARGET_ML, logs: [] as Array<{ _id: string; amountMl: number; createdAt: number; containerType: string | null; source: string }> };
    }
    const date = todayDateIST();
    const logs = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", date))
      .order("desc")
      .collect();
    const totalMl = logs.reduce((s, l) => s + l.amountMl, 0);
    return {
      totalMl,
      target: DAILY_TARGET_ML,
      logs: logs.map((l) => ({
        _id: l._id,
        amountMl: l.amountMl,
        createdAt: l.createdAt,
        containerType: l.containerType ?? null,
        source: l.source,
      })),
    };
  },
});

// ─── Internal — used by Telegram webhook ─────────────────────────────

export const logWaterForUser = internalMutation({
  args: {
    userId: v.id("users"),
    amountMl: v.number(),
    source: SOURCE,
    containerType: v.optional(v.string()),
  },
  handler: async (ctx, { userId, amountMl, source, containerType }) => {
    return await ctx.db.insert("waterLogs", {
      userId,
      date: todayDateIST(),
      amountMl: Math.round(amountMl),
      source,
      containerType,
      createdAt: Date.now(),
    });
  },
});

export const getTodayWaterForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const date = todayDateIST();
    const logs = await ctx.db
      .query("waterLogs")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", date))
      .collect();
    return {
      totalMl: logs.reduce((s, l) => s + l.amountMl, 0),
      count: logs.length,
      target: DAILY_TARGET_ML,
    };
  },
});
