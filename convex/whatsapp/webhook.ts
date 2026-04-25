import { httpAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? "";

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(req: Request): Promise<boolean> {
  if (!APP_SECRET) return false;
  const sig = req.headers.get("x-hub-signature-256");
  if (!sig) return false;
  const body = await req.clone().text();
  const expected = await hmacSha256(APP_SECRET, body);
  return sig === `sha256=${expected}`;
}

export const verify = httpAction(async (_ctx, req) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
});

export const inbound = httpAction(async (ctx, req) => {
  const ok = await verifySignature(req);
  if (!ok) return new Response("invalid signature", { status: 401 });

  const body = await req.json();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const from = msg.from as string;
        const text = ((msg.text?.body ?? "") as string).trim().toUpperCase();
        if (text === "STOP") {
          await ctx.runMutation(internal.whatsapp.webhook.handleStop, {
            phoneE164: `+${from}`,
          });
        }
      }
    }
  }
  return new Response("ok", { status: 200 });
});

export const handleStop = internalMutation({
  args: { phoneE164: v.string() },
  handler: async (ctx, { phoneE164 }) => {
    const profiles = await ctx.db.query("profiles").collect();
    const match = profiles.find((p) => p.whatsappNumber === phoneE164);
    if (match) await ctx.db.patch(match._id, { whatsappOptIn: false });
  },
});
