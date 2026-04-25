/**
 * Server-side order creation. Frontend calls `createPaymentOrder` →
 * we create a Razorpay Order and return the order_id + key_id so the
 * frontend can hand them to the Razorpay Checkout JS overlay.
 *
 * We DON'T mark the user as paid here — Razorpay's webhook is the
 * source of truth (handled in webhook.ts).
 */
import { action, internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { createOrder } from "./adapter";
import { FOUNDER_AMOUNT_PAISE, FOUNDER_CAP } from "./founder";

export const createPaymentOrder = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    razorpayOrderId: string;
    razorpayKeyId: string;
    amount: number;
    currency: string;
    foundersRemaining: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Pre-check: don't let already-lifetime users create new orders
    const profile: { plan?: string; founderNumber?: number } | null = await ctx.runQuery(
      internal.users.getProfileForUser,
      { userId },
    );
    if (!profile) throw new Error("Complete onboarding first");
    if (profile.plan === "lifetime") {
      throw new Error("You already have lifetime access");
    }

    // Pre-check: founder slots remaining (race-resolved by webhook handler
    // anyway — this is just a friendlier early failure)
    const filled: number = await ctx.runQuery(internal.razorpay.founder.getFounderCount);
    const remaining = Math.max(0, FOUNDER_CAP - filled);
    if (remaining === 0) {
      throw new Error("All 50 founder slots are taken. Subscription tier launching soon.");
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) throw new Error("Razorpay not configured");

    // Receipt format: max 40 chars. Use last 6 of userId + timestamp tail.
    const userTail = userId.slice(-8);
    const tsTail = Date.now().toString().slice(-7);
    const receipt = `tly_f_${userTail}_${tsTail}`; // e.g. tly_f_kj38hxz1_5639827

    const order = await createOrder({
      amountInPaise: FOUNDER_AMOUNT_PAISE,
      receipt,
      notes: {
        userId,
        plan: "founder_lifetime",
      },
    });

    await ctx.runMutation(internal.razorpay.orders.recordOrderCreated, {
      userId,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      notes: order.notes,
    });

    return {
      razorpayOrderId: order.id,
      razorpayKeyId: keyId,
      amount: order.amount,
      currency: order.currency,
      foundersRemaining: remaining,
    };
  },
});

export const recordOrderCreated = internalMutation({
  args: {
    userId: v.id("users"),
    razorpayOrderId: v.string(),
    amount: v.number(),
    currency: v.string(),
    notes: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("payments", {
      userId: args.userId,
      razorpayOrderId: args.razorpayOrderId,
      amount: args.amount,
      currency: args.currency,
      status: "created",
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

/**
 * Used by the webhook handler to fetch the original userId for a paid order.
 */
export const getPaymentByOrderId = query({
  args: { razorpayOrderId: v.string() },
  handler: async (ctx, { razorpayOrderId }) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("razorpayOrderId", razorpayOrderId))
      .unique();
  },
});
