import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const RE_ENGAGEMENT_GAP_DAYS = 3;
const RE_ENGAGEMENT_LOOKBACK_DAYS = 30; // only target users who logged at least once in the last 30 days
const REPETITION_LOOKBACK_DAYS = 7;
const REPETITION_MIN_DAYS = 4; // food must appear in 4+ distinct days to trigger

function dateAtDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().split("T")[0];
}

function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find users with a 3+ day silence streak. We only target users who logged at
 * least once in the past 30 days — first-time users who never logged shouldn't
 * get a "we miss you" message before they ever started.
 */
export const querySilentUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const lookbackDate = dateAtDaysAgo(RE_ENGAGEMENT_LOOKBACK_DAYS);
    const cutoffDate = dateAtDaysAgo(RE_ENGAGEMENT_GAP_DAYS);

    const recentLogs = await ctx.db.query("mealLogs").collect();
    const lastLogByUser = new Map<Id<"users">, string>();
    for (const log of recentLogs) {
      if (log.date < lookbackDate) continue;
      const prev = lastLogByUser.get(log.userId);
      if (!prev || log.date > prev) lastLogByUser.set(log.userId, log.date);
    }

    const silent: Id<"users">[] = [];
    for (const [userId, lastDate] of lastLogByUser.entries()) {
      if (lastDate < cutoffDate) silent.push(userId);
    }
    return silent;
  },
});

export const seedReEngagement = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: number }> => {
    const userIds: Id<"users">[] = await ctx.runQuery(
      internal.nudges.signalSeeders.querySilentUsers,
      {},
    );
    for (const userId of userIds) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId,
        type: "gap_detected",
      });
    }
    return { seeded: userIds.length };
  },
});

/**
 * For each active user, scan the last 7 days of meal logs and find a single
 * food name that appears in 4+ distinct days. Enqueue a `food_repetition_detected`
 * event with the canonical (most-frequent original casing) food name.
 *
 * Names are normalized (lowercase, whitespace-collapsed) for matching but the
 * user-facing string is preserved from one of the actual log items.
 */
export const queryFoodRepetitions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sinceDate = dateAtDaysAgo(REPETITION_LOOKBACK_DAYS);
    const logs = await ctx.db.query("mealLogs").collect();

    type Bucket = { displayName: string; dates: Set<string> };
    const perUser = new Map<Id<"users">, Map<string, Bucket>>();

    for (const log of logs) {
      if (log.date < sinceDate) continue;
      let foodMap = perUser.get(log.userId);
      if (!foodMap) {
        foodMap = new Map();
        perUser.set(log.userId, foodMap);
      }
      for (const item of log.items) {
        const key = normalizeFoodName(item.name);
        if (!key) continue;
        const existing = foodMap.get(key);
        if (existing) {
          existing.dates.add(log.date);
        } else {
          foodMap.set(key, { displayName: item.name, dates: new Set([log.date]) });
        }
      }
    }

    const hits: { userId: Id<"users">; foodName: string; days: number }[] = [];
    for (const [userId, foodMap] of perUser.entries()) {
      let best: { displayName: string; days: number } | null = null;
      for (const bucket of foodMap.values()) {
        const days = bucket.dates.size;
        if (days < REPETITION_MIN_DAYS) continue;
        if (!best || days > best.days) best = { displayName: bucket.displayName, days };
      }
      if (best) {
        hits.push({ userId, foodName: best.displayName, days: best.days });
      }
    }
    return hits;
  },
});

export const seedFoodRepetition = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: number }> => {
    const hits: { userId: Id<"users">; foodName: string; days: number }[] =
      await ctx.runQuery(internal.nudges.signalSeeders.queryFoodRepetitions, {});
    for (const hit of hits) {
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId: hit.userId,
        type: "food_repetition_detected",
        payload: { foodName: hit.foodName, days: hit.days },
      });
    }
    return { seeded: hits.length };
  },
});
