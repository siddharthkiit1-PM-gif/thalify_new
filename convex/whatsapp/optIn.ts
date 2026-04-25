import { action, mutation, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { sendText, sendTemplate } from "./adapter";

const E164_REGEX = /^\+\d{10,15}$/;
const CODE_TTL_MS = 30 * 60 * 1000;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const requestOptIn = action({
  args: { phoneE164: v.string() },
  handler: async (ctx, { phoneE164 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!E164_REGEX.test(phoneE164)) {
      throw new Error("Phone must be in E.164 format like +919876543210");
    }

    const code = generateCode();
    const expiresAt = Date.now() + CODE_TTL_MS;
    await ctx.runMutation(internal.whatsapp.optIn.savePendingOptIn, {
      userId,
      phoneE164,
      code,
      expiresAt,
    });

    const result = await sendTemplate(phoneE164, "whatsapp_verify_v1", [code]);
    if (!result.success) {
      throw new Error(`WhatsApp send failed: ${result.error}`);
    }
    return { sent: true };
  },
});

export const savePendingOptIn = internalMutation({
  args: {
    userId: v.id("users"),
    phoneE164: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, phoneE164, code, expiresAt }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      whatsappNumber: phoneE164,
      whatsappPendingCode: code,
      whatsappPendingCodeExpiresAt: expiresAt,
    });
  },
});

export const confirmOptIn = action({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const result: { activated: boolean; phoneE164?: string } = await ctx.runMutation(
      internal.whatsapp.optIn.verifyAndActivate,
      { userId, code },
    );
    if (!result.activated) throw new Error("Invalid or expired code");

    if (result.phoneE164) {
      await sendText(
        result.phoneE164,
        "Done — you'll get Thalify nudges here. Reply STOP to unsubscribe.",
      );
    }
    return { activated: true };
  },
});

export const verifyAndActivate = internalMutation({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, { userId, code }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile?.whatsappNumber) return { activated: false };
    if (
      !profile.whatsappPendingCode ||
      profile.whatsappPendingCode !== code ||
      !profile.whatsappPendingCodeExpiresAt ||
      profile.whatsappPendingCodeExpiresAt < Date.now()
    ) {
      return { activated: false };
    }

    await ctx.db.patch(profile._id, {
      whatsappOptIn: true,
      whatsappVerifiedAt: Date.now(),
      whatsappPendingCode: undefined,
      whatsappPendingCodeExpiresAt: undefined,
    });
    return { activated: true, phoneE164: profile.whatsappNumber };
  },
});

export const optOut = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, { whatsappOptIn: false });
  },
});

export const getStatus = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return {
      number: profile?.whatsappNumber,
      optedIn: profile?.whatsappOptIn === true,
    };
  },
});
