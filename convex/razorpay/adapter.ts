/**
 * Razorpay REST API wrapper.
 *
 * Three endpoints we touch:
 *   POST /v1/orders                     — create an Order before checkout
 *   POST /v1/payments/{id}/refund       — refund a captured payment (used for slot 51+ overflow)
 *   GET  /v1/payments/{id}              — fetch payment for verification fallback
 *
 * All calls authenticated via HTTP Basic Auth: `{KEY_ID}:{KEY_SECRET}` base64-encoded.
 * Live mode is implied by the prefix on RAZORPAY_KEY_ID — `rzp_live_` vs `rzp_test_`.
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";

function basicAuth(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured");
  }
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string>;
  created_at: number;
};

export type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  status: "queued" | "pending" | "processed" | "failed";
  created_at: number;
};

export async function createOrder(opts: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const resp = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      authorization: basicAuth(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: opts.amountInPaise,
      currency: "INR",
      receipt: opts.receipt.slice(0, 40), // Razorpay enforces 40-char limit
      notes: opts.notes ?? {},
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Razorpay createOrder failed: ${JSON.stringify(data?.error ?? data)}`);
  }
  return data as RazorpayOrder;
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const resp = await fetch(`${RAZORPAY_API}/payments/${paymentId}`, {
    headers: { authorization: basicAuth() },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Razorpay fetchPayment failed: ${JSON.stringify(data?.error ?? data)}`);
  }
  return data as RazorpayPayment;
}

export async function refundPayment(opts: {
  paymentId: string;
  amountInPaise?: number; // omit for full refund
  notes?: Record<string, string>;
  reason?: string; // arbitrary string saved on the refund
}): Promise<RazorpayRefund> {
  const body: Record<string, unknown> = {};
  if (opts.amountInPaise) body.amount = opts.amountInPaise;
  body.notes = { ...(opts.notes ?? {}), reason: opts.reason ?? "no-reason-given" };
  body.speed = "normal";

  const resp = await fetch(`${RAZORPAY_API}/payments/${opts.paymentId}/refund`, {
    method: "POST",
    headers: {
      authorization: basicAuth(),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Razorpay refund failed: ${JSON.stringify(data?.error ?? data)}`);
  }
  return data as RazorpayRefund;
}

/**
 * Verify the X-Razorpay-Signature header on an inbound webhook.
 * Razorpay signs the raw request body with HMAC-SHA256 using the
 * webhook secret configured in the dashboard.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare (prevents timing attacks)
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify the inline checkout signature returned by Razorpay's frontend
 * after a successful payment. Used as a defence-in-depth check against
 * the webhook (we don't actually rely on this — webhook is the source of
 * truth — but it lets the success page show the founder badge instantly
 * rather than waiting for the webhook to land).
 *
 *   generated = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export async function verifyCheckoutSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<boolean> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const payload = `${opts.orderId}|${opts.paymentId}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== opts.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ opts.signature.charCodeAt(i);
  }
  return diff === 0;
}
