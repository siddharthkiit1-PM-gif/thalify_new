/**
 * Razorpay webhook — source of truth for payment status.
 *
 * Even though the Razorpay Checkout JS overlay returns success/failure
 * to the browser, we treat the webhook as the only authoritative event.
 * This protects against:
 *   - Browser closed mid-flow → user paid but UI never updated
 *   - Spoofed client-side success
 *   - Network glitches eating the success callback
 *
 * Idempotency: Razorpay retries failed webhook deliveries with
 * exponential backoff for up to 24h. Every handler must be safe to
 * run twice on the same event. We achieve this via:
 *   - Atomic founder-slot reservation (returns alreadyAssigned=true
 *     on re-run for the same payment)
 *   - Refund handler checks payment status before issuing
 *
 * Live-mode safety checks:
 *   - HMAC-SHA256 signature verification on every call
 *   - Amount === FOUNDER_AMOUNT_PAISE (₹99.00) — refund anything else
 *   - Currency === INR
 *   - Razorpay event type whitelist
 */
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { verifyWebhookSignature } from "./adapter";
import { FOUNDER_AMOUNT_PAISE } from "./founder";
import type { Doc } from "../_generated/dataModel";

type RazorpayWebhookPayload = {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method?: string;
        email?: string;
        contact?: string;
        notes?: Record<string, string>;
        error_description?: string;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
      };
    };
  };
  created_at: number;
};

export const inbound = httpAction(async (ctx, req) => {
  // 1. Read raw body for signature verification (must be exact bytes)
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return new Response("missing signature", { status: 401 });
  }
  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return new Response("invalid signature", { status: 401 });
  }

  // 2. Parse + dispatch
  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  console.log(`[razorpay] event: ${body.event}`);

  switch (body.event) {
    case "payment.captured": {
      const p = body.payload.payment?.entity;
      if (!p) break;

      // Live-mode safety: only process founder payments at exact ₹99 INR
      if (p.currency !== "INR") {
        console.warn(`[razorpay] non-INR payment captured: ${p.id} (${p.currency})`);
        await ctx.scheduler.runAfter(0, internal.razorpay.founder.issueRefund, {
          razorpayPaymentId: p.id,
          razorpayOrderId: p.order_id,
          reason: "amount-mismatch",
          userEmail: p.email,
          userName: undefined,
        });
        break;
      }
      if (p.amount !== FOUNDER_AMOUNT_PAISE) {
        console.warn(
          `[razorpay] amount mismatch on ${p.id}: got ${p.amount}, expected ${FOUNDER_AMOUNT_PAISE}`,
        );
        await ctx.scheduler.runAfter(0, internal.razorpay.founder.issueRefund, {
          razorpayPaymentId: p.id,
          razorpayOrderId: p.order_id,
          reason: "amount-mismatch",
          userEmail: p.email,
          userName: undefined,
        });
        break;
      }

      // Look up the order to find the userId (we recorded it at order creation)
      const payment: Doc<"payments"> | null = await ctx.runQuery(
        internal.razorpay.webhook.findPaymentByOrderId,
        { razorpayOrderId: p.order_id },
      );
      if (!payment) {
        // Order wasn't created via our flow — refund as a safety
        console.warn(`[razorpay] orphan payment captured: ${p.id} for unknown order ${p.order_id}`);
        await ctx.scheduler.runAfter(0, internal.razorpay.founder.issueRefund, {
          razorpayPaymentId: p.id,
          razorpayOrderId: p.order_id,
          reason: "no-profile",
          userEmail: p.email,
        });
        break;
      }

      // Atomic slot reservation
      const result: {
        ok: boolean;
        founderNumber?: number;
        alreadyAssigned?: boolean;
        reason?: "no-profile" | "already-lifetime" | "sold-out";
      } = await ctx.runMutation(internal.razorpay.founder.reserveFounderSlot, {
        userId: payment.userId,
        razorpayOrderId: p.order_id,
        razorpayPaymentId: p.id,
      });

      if (!result.ok) {
        console.warn(`[razorpay] slot reservation failed: ${result.reason}`);
        const user: { name: string | null; email: string | null } | null = await ctx.runQuery(
          internal.users.getUserByIdInternal,
          { userId: payment.userId },
        );
        await ctx.scheduler.runAfter(0, internal.razorpay.founder.issueRefund, {
          razorpayPaymentId: p.id,
          razorpayOrderId: p.order_id,
          reason: result.reason ?? "no-profile",
          userEmail: user?.email ?? p.email,
          userName: user?.name ?? undefined,
        });
        await ctx.runMutation(internal.razorpay.founder.recordPaymentCaptured, {
          razorpayOrderId: p.order_id,
          razorpayPaymentId: p.id,
          amount: p.amount,
          failureReason: result.reason,
        });
        break;
      }

      // Slot reserved (or already was). Send welcome email if first time.
      await ctx.runMutation(internal.razorpay.founder.recordPaymentCaptured, {
        razorpayOrderId: p.order_id,
        razorpayPaymentId: p.id,
        amount: p.amount,
        founderNumberAssigned: result.founderNumber,
      });

      if (!result.alreadyAssigned && result.founderNumber !== undefined) {
        const user: { name: string | null; email: string | null } | null = await ctx.runQuery(
          internal.users.getUserByIdInternal,
          { userId: payment.userId },
        );
        if (user?.email) {
          await ctx.scheduler.runAfter(0, internal.razorpay.founder.sendFounderWelcomeEmail, {
            userEmail: user.email,
            userName: user.name ?? undefined,
            founderNumber: result.founderNumber,
          });
        }
      }
      break;
    }

    case "payment.failed": {
      const p = body.payload.payment?.entity;
      if (!p) break;
      console.warn(
        `[razorpay] payment failed: ${p.id} (order=${p.order_id}) — ${p.error_description ?? "no reason"}`,
      );
      await ctx.runMutation(internal.razorpay.webhook.recordPaymentFailed, {
        razorpayOrderId: p.order_id,
        razorpayPaymentId: p.id,
        reason: p.error_description ?? "unknown",
      });
      break;
    }

    case "refund.processed":
    case "refund.created": {
      const r = body.payload.refund?.entity;
      if (!r) break;
      console.log(`[razorpay] refund ${r.id} for payment ${r.payment_id}`);
      // We've already marked the payment as refunded in our table when
      // we triggered the refund. This webhook just confirms it.
      break;
    }

    default:
      // Quietly accept other events (subscription.*, order.paid, etc.)
      // Razorpay treats any 2xx as ack — we don't need to handle every one.
      break;
  }

  return new Response("ok", { status: 200 });
});

// ── Internal helpers used by the webhook handler ─────────────────────

import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const findPaymentByOrderId = internalQuery({
  args: { razorpayOrderId: v.string() },
  handler: async (ctx, { razorpayOrderId }) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("razorpayOrderId", razorpayOrderId))
      .unique();
  },
});

export const recordPaymentFailed = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, { razorpayOrderId, razorpayPaymentId, reason }) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("razorpayOrderId", razorpayOrderId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "failed",
        razorpayPaymentId,
        failureReason: reason,
      });
    }
  },
});
