import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getScanById = query({
  args: { scanResultId: v.id("scanResults") },
  handler: async (ctx, { scanResultId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const scan = await ctx.db.get(scanResultId);
    if (!scan || scan.userId !== userId) return null;
    const imageUrl = scan.imageStorageId ? await ctx.storage.getUrl(scan.imageStorageId) : null;
    return { ...scan, imageUrl };
  },
});

export const updateScanItems = mutation({
  args: {
    scanResultId: v.id("scanResults"),
    items: v.array(v.object({
      name: v.string(), portion: v.string(),
      cal: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(),
    })),
  },
  handler: async (ctx, { scanResultId, items }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const scan = await ctx.db.get(scanResultId);
    if (!scan || scan.userId !== userId) throw new Error("Scan not found");
    if (items.length === 0) throw new Error("At least one item required");
    if (items.length > 30) throw new Error("Too many items");
    for (const i of items) {
      if (i.name.length > 80 || i.portion.length > 40) throw new Error("Name/portion too long");
      if (i.cal < 0 || i.cal > 5000) throw new Error("Calories out of range");
    }

    const totalCal = items.reduce((s, i) => s + i.cal, 0);
    const totalProtein = items.reduce((s, i) => s + i.protein, 0);
    await ctx.db.patch(scanResultId, { items, totalCal, totalProtein, edited: true });
  },
});

export const recordScanFeedback = mutation({
  args: {
    scanResultId: v.id("scanResults"),
    feedback: v.union(v.literal("accurate"), v.literal("inaccurate"), v.literal("partial")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { scanResultId, feedback, notes }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const scan = await ctx.db.get(scanResultId);
    if (!scan || scan.userId !== userId) throw new Error("Scan not found");
    const truncatedNotes = notes?.trim().slice(0, 500);
    await ctx.db.patch(scanResultId, { userFeedback: feedback, feedbackNotes: truncatedNotes });
  },
});

export const deleteScanPhoto = mutation({
  args: { scanResultId: v.id("scanResults") },
  handler: async (ctx, { scanResultId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const scan = await ctx.db.get(scanResultId);
    if (!scan || scan.userId !== userId) throw new Error("Scan not found");
    if (scan.imageStorageId) {
      await ctx.storage.delete(scan.imageStorageId);
      await ctx.db.patch(scanResultId, { imageStorageId: undefined });
    }
  },
});
