import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";

const WINDOWS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

export const LIMITS = {
  scan: { perMinute: 10, perHour: 60, perDay: 200 },
  chat: { perMinute: 20, perHour: 200, perDay: 1000 },
  family: { perMinute: 10, perHour: 40, perDay: 100 },
  lab: { perMinute: 5, perHour: 20, perDay: 40 },
  patterns: { perMinute: 5, perHour: 20, perDay: 40 },
  waitlist: { perMinute: 3, perHour: 10, perDay: 30 },
  signupWelcome: { perMinute: 2, perHour: 5, perDay: 10 },
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
    throw new Error(`Daily limit reached for this feature. Resets in 24 hours.`);
  }

  const updated = [...events, now];
  if (existing) {
    await ctx.db.patch(existing._id, { events: updated, updatedAt: now });
  } else {
    await ctx.db.insert("rateLimits", { key, events: updated, updatedAt: now });
  }
}
