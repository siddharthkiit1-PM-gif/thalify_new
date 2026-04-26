/**
 * Telegram opt-in flow via deep-link tokens.
 *
 * 1. User clicks "Connect Telegram" → frontend calls generateConnectLink
 * 2. We mint a single-use token, store it on the profile, return the t.me deep link
 * 3. User taps Start in Telegram → bot receives /start <token> via webhook
 * 4. webhook.ts calls completeConnect(token, chatId) which flips telegramOptIn=true
 * 5. Frontend's live useQuery sees the profile flip and shows "Connected ✓"
 */
import { action, mutation, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { sendText } from "./adapter";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function generateToken(): string {
  // 16 hex chars — 64 bits of entropy, fine for single-use
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const generateConnectLink = action({
  args: {},
  handler: async (ctx): Promise<{ url: string; expiresAt: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const username = process.env.TELEGRAM_BOT_USERNAME;
    if (!username) throw new Error("TELEGRAM_BOT_USERNAME not configured");

    const token = generateToken();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    await ctx.runMutation(internal.telegram.connect.savePendingConnect, {
      userId,
      token,
      expiresAt,
    });
    return {
      url: `https://t.me/${username}?start=${token}`,
      expiresAt,
    };
  },
});

export const savePendingConnect = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, token, expiresAt }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      telegramConnectToken: token,
      telegramConnectExpiresAt: expiresAt,
    });
  },
});

export const completeConnect = internalMutation({
  args: { token: v.string(), chatId: v.string() },
  handler: async (ctx, { token, chatId }) => {
    const profiles = await ctx.db.query("profiles").collect();
    const match = profiles.find((p) => p.telegramConnectToken === token);
    if (!match) return { ok: false, reason: "token-not-found" as const };
    if (
      !match.telegramConnectExpiresAt ||
      match.telegramConnectExpiresAt < Date.now()
    ) {
      return { ok: false, reason: "expired" as const };
    }

    // One chat = one user. If anyone else already has this chatId bound
    // (e.g. user created a second account and re-connected the same
    // Telegram), unbind them so nudges don't fire twice to the same chat.
    const others = await ctx.db
      .query("profiles")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", chatId))
      .collect();
    for (const other of others) {
      if (other._id !== match._id) {
        await ctx.db.patch(other._id, {
          telegramChatId: undefined,
          telegramOptIn: false,
          telegramVerifiedAt: undefined,
        });
      }
    }

    await ctx.db.patch(match._id, {
      telegramChatId: chatId,
      telegramOptIn: true,
      telegramVerifiedAt: Date.now(),
      telegramConnectToken: undefined,
      telegramConnectExpiresAt: undefined,
    });
    return { ok: true, userId: match.userId };
  },
});

export const handleStop = internalMutation({
  args: { chatId: v.string() },
  handler: async (ctx, { chatId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", chatId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { telegramOptIn: false });
  },
});

/**
 * Resolve a Telegram chat_id → Thalify userId via the by_telegramChatId index.
 * Used by the inbound message handler to know who's chatting.
 */
export const getUserByChatId = internalQuery({
  args: { chatId: v.string() },
  handler: async (ctx, { chatId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", chatId))
      .unique();
    if (!profile || profile.telegramOptIn !== true) return null;
    return { userId: profile.userId };
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, {
      telegramOptIn: false,
      telegramChatId: undefined,
    });
  },
});

/**
 * Send a one-off greeting / confirmation. Called from the webhook after
 * a successful /start, so we send from inside the action context where
 * fetch is available.
 */
export async function sendConfirmation(chatId: string, ok: boolean) {
  return sendText(
    chatId,
    ok
      ? "✓ Connected to Thalify. You'll get personalized nudges here based on your meals."
      : "Hmm, that connection link is no longer valid. Open Thalify and click 'Connect Telegram' again.",
  );
}
