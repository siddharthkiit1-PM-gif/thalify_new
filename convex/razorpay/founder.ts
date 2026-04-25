/**
 * Founder slot management — atomic reservation of the next founder
 * number (1-50) when a paid webhook lands. Critical that this is
 * race-safe: even if 100 users pay in the same second, only the first
 * 50 webhook deliveries Razorpay makes get a founder slot.
 *
 * Convex mutations are transactional, so reading + writing the counter
 * inside a single internalMutation gives us the atomicity for free.
 */
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const FOUNDER_CAP = 50;
const FOUNDER_AMOUNT_PAISE = 9900; // ₹99.00
const FOUNDER_COUNTER_KEY = "founders_paid";
const APP_URL = process.env.APP_URL ?? "https://thalify.vercel.app";

/**
 * Atomically reserve the next founder slot for a user.
 * Returns the assigned number (1..FOUNDER_CAP) or null if sold out.
 *
 * Idempotent: if the user already has a founder number, we just return
 * it (handles the case where Razorpay retries the same webhook).
 */
export const reserveFounderSlot = internalMutation({
  args: {
    userId: v.id("users"),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
  },
  handler: async (ctx, { userId, razorpayOrderId, razorpayPaymentId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      // User paid but doesn't have a profile? Refund — they need to
      // complete onboarding first.
      return { ok: false as const, reason: "no-profile" as const };
    }

    // Idempotency: same payment processed twice → no-op.
    if (profile.razorpayPaymentId === razorpayPaymentId && profile.founderNumber) {
      return {
        ok: true as const,
        founderNumber: profile.founderNumber,
        alreadyAssigned: true,
      };
    }

    // User already lifetime — they shouldn't be paying again. Refund.
    if (profile.plan === "lifetime") {
      return { ok: false as const, reason: "already-lifetime" as const };
    }

    // Read + increment the counter atomically (single transaction)
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", FOUNDER_COUNTER_KEY))
      .unique();
    const currentCount = counter?.value ?? 0;

    if (currentCount >= FOUNDER_CAP) {
      return { ok: false as const, reason: "sold-out" as const };
    }

    const assigned = currentCount + 1;
    if (counter) {
      await ctx.db.patch(counter._id, { value: assigned, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("counters", {
        key: FOUNDER_COUNTER_KEY,
        value: assigned,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(profile._id, {
      plan: "lifetime",
      lifetimeReason: "founder",
      founderNumber: assigned,
      paidAt: Date.now(),
      razorpayOrderId,
      razorpayPaymentId,
      // Reset usage so they get a fresh 3000 immediately
      tokensUsedThisMonth: 0,
      usageResetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return { ok: true as const, founderNumber: assigned, alreadyAssigned: false };
  },
});

/**
 * Mark a payment as captured + log the founder assignment outcome
 * in the payments audit table.
 */
export const recordPaymentCaptured = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    amount: v.number(),
    founderNumberAssigned: v.optional(v.number()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("razorpayOrderId", args.razorpayOrderId))
      .unique();
    const patch = {
      razorpayPaymentId: args.razorpayPaymentId,
      status: "captured" as const,
      capturedAt: Date.now(),
      founderNumberAssigned: args.founderNumberAssigned,
      failureReason: args.failureReason,
    };
    if (existing) await ctx.db.patch(existing._id, patch);
  },
});

export const recordPaymentRefunded = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, { razorpayOrderId, failureReason }) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("razorpayOrderId", razorpayOrderId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "refunded", failureReason });
    }
  },
});

/**
 * Auto-refund handler for slot-51+ overflow + amount mismatches +
 * already-lifetime double-purchases. Calls Razorpay Refunds API,
 * marks the payment as refunded, sends an apology email.
 */
export const issueRefund = internalAction({
  args: {
    razorpayPaymentId: v.string(),
    razorpayOrderId: v.string(),
    reason: v.string(), // "sold-out" | "amount-mismatch" | "already-lifetime" | "no-profile"
    userEmail: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, { razorpayPaymentId, razorpayOrderId, reason, userEmail, userName }) => {
    const { refundPayment } = await import("./adapter");
    const { sendEmail } = await import("../email");

    try {
      await refundPayment({
        paymentId: razorpayPaymentId,
        reason,
        notes: { auto_refunded_by: "thalify_founder_paywall" },
      });
      await ctx.runMutation(internal.razorpay.founder.recordPaymentRefunded, {
        razorpayOrderId,
        failureReason: `auto-refund: ${reason}`,
      });
    } catch (err) {
      console.error(`[razorpay] refund failed for ${razorpayPaymentId}:`, err);
      // Even if refund call fails, we still record the attempt and email
      // the user — admin will need to manually refund via the dashboard
      await ctx.runMutation(internal.razorpay.founder.recordPaymentRefunded, {
        razorpayOrderId,
        failureReason: `MANUAL-REFUND-NEEDED: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Apology email (best-effort)
    if (userEmail) {
      const reasonLine = {
        "sold-out": "All 50 founder slots were claimed before your payment processed. We've issued a full refund.",
        "amount-mismatch": "We received an unexpected amount and refunded it as a precaution.",
        "already-lifetime": "Your account already has lifetime access — no need to pay again. We've refunded the charge.",
        "no-profile": "We couldn't link your payment to a profile yet. We've refunded the charge — please complete onboarding and try again.",
      }[reason] ?? "Your ₹99 payment has been refunded.";

      try {
        await sendEmail({
          to: { email: userEmail, name: userName },
          subject: "Your Thalify ₹99 payment has been refunded",
          html: `<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 20px; color: #1C1917;">
            <h1 style="font-size: 22px; margin: 0 0 16px;">Refund processed</h1>
            <p style="font-size: 15px; line-height: 1.55; color: #3A332D;">
              Hi${userName ? ` ${userName.split(/\s+/)[0]}` : ""},
            </p>
            <p style="font-size: 15px; line-height: 1.55; color: #3A332D;">
              ${reasonLine}
            </p>
            <p style="font-size: 14px; color: #8A7E72; line-height: 1.55; margin-top: 24px;">
              The refund will reflect in your account within 5-7 business days
              depending on your bank. If you have any questions, just reply to
              this email.
            </p>
            <p style="font-size: 13px; color: #8A7E72; margin-top: 28px;">
              — Siddharth, Thalify
            </p>
          </div>`,
        });
      } catch (err) {
        console.warn("[razorpay] refund-apology email failed:", err);
      }
    }
  },
});

/**
 * Send the founder welcome email after a slot is successfully reserved.
 */
export const sendFounderWelcomeEmail = internalAction({
  args: {
    userEmail: v.string(),
    userName: v.optional(v.string()),
    founderNumber: v.number(),
  },
  handler: async (_ctx, { userEmail, userName, founderNumber }) => {
    const { sendEmail } = await import("../email");
    const firstName = userName?.split(/\s+/)[0] ?? "there";

    try {
      await sendEmail({
        to: { email: userEmail, name: userName },
        subject: `You're Founder #${founderNumber} of Thalify 🌿`,
        html: `<div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 36px 24px; background: #FEFCF8; color: #1C1917;">
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; color: #2D5F3A; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
            Founder · #${founderNumber} of 50
          </div>
          <h1 style="font-size: 30px; margin: 0 0 16px; line-height: 1.15; letter-spacing: -0.015em; font-weight: 400;">
            Welcome aboard, ${firstName}.
          </h1>
          <p style="font-size: 16px; line-height: 1.6; color: #3A332D; margin: 0 0 18px;">
            You're one of the first 50 people to back Thalify. That's a real bet — and you've earned <strong>lifetime access</strong> for it.
          </p>
          <div style="background: #F7F3EC; border-left: 3px solid #2D5F3A; border-radius: 12px; padding: 18px 20px; margin: 24px 0;">
            <div style="font-size: 13px; color: #2D5F3A; font-weight: 600; margin-bottom: 6px;">What you've unlocked</div>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #3A332D;">
              <li>3,000 AI actions / month — every month, forever</li>
              <li>Unlimited photo scans, Health Buddy chats, lab analysis</li>
              <li>Telegram bot — connect once, get nudges + log meals there</li>
              <li>Family meal optimizer + 28-day pattern insights</li>
              <li>Founder badge in the app (see your number on the dashboard)</li>
            </ul>
          </div>
          <p style="font-size: 15px; line-height: 1.6; color: #3A332D;">
            Your charge of ₹99 has cleared. No more bills, ever.
          </p>
          <a href="${APP_URL}/dashboard" style="display: inline-block; background: linear-gradient(180deg, #357045 0%, #2D5F3A 100%); color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; margin-top: 12px;">
            Open Thalify →
          </a>
          <p style="font-size: 13px; color: #8A7E72; margin-top: 36px; line-height: 1.6;">
            Thank you for being one of the first. If anything's off — a meal scans wrong, the bot doesn't reply, the dashboard breaks — reply to this email. I read every founder message.
          </p>
          <p style="font-size: 13px; color: #8A7E72; margin-top: 20px;">
            — Siddharth (siddharth.kiit1@gmail.com)
          </p>
        </div>`,
      });
    } catch (err) {
      console.error("[razorpay] founder-welcome email failed:", err);
    }
  },
});

/**
 * Read-only helper used elsewhere in the codebase.
 */
export const getFounderCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", FOUNDER_COUNTER_KEY))
      .unique();
    return counter?.value ?? 0;
  },
});

export { FOUNDER_CAP, FOUNDER_AMOUNT_PAISE };
