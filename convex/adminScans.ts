import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const ADMIN_EMAILS = new Set([
  "siddharth.kiit1@gmail.com",
  "agrawalsiddharth18@gmail.com",
]);

async function requireAdmin(ctx: { auth: unknown; db: { get: (id: unknown) => Promise<{ email?: string } | null> } }): Promise<void> {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  const email = user?.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.has(email)) throw new Error("Admin only");
}

export const recentScans = query({
  args: { limit: v.optional(v.number()), onlyEdited: v.optional(v.boolean()), onlyNegativeFeedback: v.optional(v.boolean()) },
  handler: async (ctx, { limit = 50, onlyEdited = false, onlyNegativeFeedback = false }) => {
    await requireAdmin(ctx as never);
    const scans = await ctx.db
      .query("scanResults")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(limit, 200));

    const filtered = scans.filter((s) => {
      if (onlyEdited && !s.edited) return false;
      if (onlyNegativeFeedback && s.userFeedback !== "inaccurate") return false;
      return true;
    });

    const results = await Promise.all(filtered.map(async (s) => {
      const user = await ctx.db.get(s.userId);
      const imageUrl = s.imageStorageId ? await ctx.storage.getUrl(s.imageStorageId) : null;
      return {
        _id: s._id,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
        createdAt: s.createdAt,
        edited: s.edited ?? false,
        userFeedback: s.userFeedback ?? null,
        feedbackNotes: s.feedbackNotes ?? null,
        rawItems: s.rawItems ?? s.items,
        finalItems: s.items,
        totalCal: s.totalCal,
        imageUrl,
      };
    }));

    return results;
  },
});

export const scanStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx as never);
    const all = await ctx.db.query("scanResults").collect();
    const edited = all.filter((s) => s.edited).length;
    const accurate = all.filter((s) => s.userFeedback === "accurate").length;
    const inaccurate = all.filter((s) => s.userFeedback === "inaccurate").length;
    const partial = all.filter((s) => s.userFeedback === "partial").length;
    const withPhoto = all.filter((s) => s.imageStorageId).length;
    return {
      total: all.length,
      edited,
      accurate,
      inaccurate,
      partial,
      withPhoto,
      editRate: all.length > 0 ? edited / all.length : 0,
    };
  },
});
