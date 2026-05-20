import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

const ACTIVE_DAYS = 14;

/**
 * "Active" = any signal of engagement in the last N days, NOT just meal logs.
 *
 * The earlier version used mealLogs only — which silently dropped users from
 * the water-check + daily-log-prompt audience the moment they went 14 days
 * without manually logging a meal (even if they were scanning, chatting,
 * logging water, or actively chatting with the Telegram bot). For a
 * Telegram-first product that's exactly backwards: those are the users we
 * MOST want to keep nudging.
 *
 * We also always include lifetime + telegramOptIn users — paying founders
 * explicitly chose this channel; never cut them off based on a meal-log heuristic.
 */
export const queryActiveUsers = internalQuery({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    const sinceMs = Date.now() - days * 24 * 3600 * 1000;
    const sinceDate = new Date(sinceMs).toISOString().split("T")[0];
    const userIds = new Set<Id<"users">>();

    // 1. Meal logs (original signal)
    const logs = await ctx.db.query("mealLogs").collect();
    for (const log of logs) {
      if (log.date >= sinceDate) userIds.add(log.userId);
    }

    // 2. Scans (user opened scan flow even if they didn't log)
    const scans = await ctx.db.query("scanResults").collect();
    for (const s of scans) {
      if (s.createdAt >= sinceMs) userIds.add(s.userId);
    }

    // 3. Water logs
    const waters = await ctx.db.query("waterLogs").collect();
    for (const w of waters) {
      if (w.createdAt >= sinceMs) userIds.add(w.userId);
    }

    // 4. Health Buddy chat (only user messages — AI replies don't count)
    const chats = await ctx.db.query("chatMessages").collect();
    for (const c of chats) {
      if (c.createdAt >= sinceMs && c.from === "user") userIds.add(c.userId);
    }

    // 5. Lifetime + telegramOptIn → always in. Founders paid + opted in;
    //    a quiet stretch of manual logging is not a signal to silence them.
    const profiles = await ctx.db.query("profiles").collect();
    for (const p of profiles) {
      if (p.plan === "lifetime" && p.telegramOptIn === true) {
        userIds.add(p.userId);
      }
    }

    return Array.from(userIds);
  },
});

type SeedType =
  | "time_breakfast_check"
  | "time_lunch_check"
  | "time_dinner_check"
  | "time_daily_summary"
  | "weekly_insight"
  | "daily_log_prompt"
  | "water_check_time";

async function seedFor(
  ctx: GenericActionCtx<DataModel>,
  type: SeedType,
): Promise<{ seeded: number }> {
  const userIds: Id<"users">[] = await ctx.runQuery(
    internal.nudges.timeSeeders.queryActiveUsers,
    { days: ACTIVE_DAYS },
  );
  for (const userId of userIds) {
    await ctx.runMutation(internal.nudges.queue.enqueue, { userId, type });
  }
  return { seeded: userIds.length };
}

export const seedBreakfastChecks = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "time_breakfast_check"),
});
export const seedLunchChecks = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "time_lunch_check"),
});
export const seedDinnerChecks = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "time_dinner_check"),
});
export const seedDailySummaries = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "time_daily_summary"),
});
export const seedWeeklyInsights = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "weekly_insight"),
});
export const seedDailyLogPrompt = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "daily_log_prompt"),
});
export const seedWaterCheck = internalAction({
  args: {},
  handler: async (ctx) => seedFor(ctx, "water_check_time"),
});
