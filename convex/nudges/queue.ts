import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const enqueue = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("meal_logged"),
      v.literal("scan_completed"),
      v.literal("time_breakfast_check"),
      v.literal("time_lunch_check"),
      v.literal("time_dinner_check"),
      v.literal("time_daily_summary"),
      v.literal("streak_milestone"),
      v.literal("gap_detected"),
      v.literal("weekly_insight"),
    ),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, { userId, type, payload }) => {
    await ctx.db.insert("nudgeEvents", {
      userId,
      type,
      payload,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
