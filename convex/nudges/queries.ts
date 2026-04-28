import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const RECENT_LIMIT = 20;

export const recent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const now = Date.now();
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(RECENT_LIMIT * 2);
    return all
      .filter((n) => n.expiresAt === undefined || n.expiresAt > now)
      .slice(0, RECENT_LIMIT);
  },
});

/**
 * The single most recent non-expired signal for this user — what we'd surface
 * as the topmost card on the Patterns tab. Returns null if there's nothing
 * fresh. The Patterns page renders a fallback ("we're watching") when null.
 */
export const topSignal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const now = Date.now();
    // Look back ~7 days; older signals aren't "current."
    const cutoff = now - 7 * 24 * 3600 * 1000;
    const recents = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gt("createdAt", cutoff),
      )
      .order("desc")
      .take(20);
    const live = recents.find(
      (n) => n.expiresAt === undefined || n.expiresAt > now,
    );
    return live ?? null;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const now = Date.now();
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .collect();
    return all.filter(
      (n) => !n.read && (n.expiresAt === undefined || n.expiresAt > now),
    ).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const n = await ctx.db.get(id);
    if (!n || n.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { read: true, readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    for (const n of all) {
      if (!n.read) await ctx.db.patch(n._id, { read: true, readAt: now });
    }
  },
});
