import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

const ACTIVE_DAYS = 14;

export const queryActiveUsers = internalQuery({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000)
      .toISOString()
      .split("T")[0];
    const logs = await ctx.db.query("mealLogs").collect();
    const userIds = new Set<Id<"users">>();
    for (const log of logs) {
      if (log.date >= sinceDate) userIds.add(log.userId);
    }
    return Array.from(userIds);
  },
});

type SeedType =
  | "time_breakfast_check"
  | "time_lunch_check"
  | "time_dinner_check"
  | "time_daily_summary"
  | "weekly_insight";

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
