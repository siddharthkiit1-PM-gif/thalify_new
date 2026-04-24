import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";

const WINDOWS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

export const LIMITS = {
  // Unlimited / allowlisted users (see lib/tiers.ts)
  scan: { perMinute: 10, perHour: 60, perDay: 200 },
  chat: { perMinute: 20, perHour: 200, perDay: 1000 },
  // Free-tier caps for regular users — 5 scans + 5 chats per day
  scan_free: { perMinute: 2, perHour: 5, perDay: 5 },
  chat_free: { perMinute: 3, perHour: 5, perDay: 5 },
  family: { perMinute: 10, perHour: 40, perDay: 100 },
  lab: { perMinute: 5, perHour: 20, perDay: 40 },
  patterns: { perMinute: 5, perHour: 20, perDay: 40 },
  waitlist: { perMinute: 3, perHour: 10, perDay: 30 },
  signupWelcome: { perMinute: 2, perHour: 5, perDay: 10 },
};

/**
 * User-friendly messages for when a user hits the 5/day free cap.
 * These are keyed off the free-tier action names.
 */
const FREE_TIER_DAILY_MESSAGES: Record<string, string> = {
  scan_free: "Free tier limit reached — you've used your 5 scans for today. Resets at midnight IST.",
  chat_free: "Free tier limit reached — you've used your 5 Health Buddy chats for today. Resets at midnight IST.",
};

/**
 * Simple sliding-window rate limiter backed by the rateLimits table.
 * Throws a user-friendly error if the user exceeds any of the three windows.
 */
export async function checkRateLimit(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<"users"> | string,
  action: keyof typeof LIMITS,
): Promise<void> {
  const limits = LIMITS[action];
  const now = Date.now();
  const key = `${userId}:${action}`;

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", q => q.eq("key", key))
    .unique();

  const events = (existing?.events ?? []).filter(t => now - t < WINDOWS.day);

  const last1m = events.filter(t => now - t < WINDOWS.minute).length;
  const last1h = events.filter(t => now - t < WINDOWS.hour).length;
  const last1d = events.length;

  if (last1m >= limits.perMinute) {
    throw new Error(`Too many requests — please wait a moment before trying again.`);
  }
  if (last1h >= limits.perHour) {
    throw new Error(`Hourly limit reached for this feature. Please try again later.`);
  }
  if (last1d >= limits.perDay) {
    const customMsg = FREE_TIER_DAILY_MESSAGES[action as string];
    throw new Error(customMsg ?? `Daily limit reached for this feature. Resets in 24 hours.`);
  }

  const updated = [...events, now];
  if (existing) {
    await ctx.db.patch(existing._id, { events: updated, updatedAt: now });
  } else {
    await ctx.db.insert("rateLimits", { key, events: updated, updatedAt: now });
  }
}
