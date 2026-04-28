/**
 * Password-reuse guard.
 *
 * We keep the last 5 salted SHA-256 hashes of each user's plaintext passwords.
 * On reset, the candidate password is hashed against each stored salt; if any
 * matches, we reject the reset before it touches the auth library's own
 * password store.
 *
 * Why a separate store from `@convex-dev/auth`'s password hash:
 *   - Their hash is bcrypt/scrypt-style and one-way for the *current* password
 *     only — there's no API to read past password hashes from there.
 *   - We need a "have we seen this exact plaintext before?" check, which means
 *     we must store our own hash per password change, regardless.
 *
 * Security shape: SHA-256(password + per-entry salt). Salt prevents rainbow
 * tables across users; per-entry salt also means re-using the *same* password
 * yields different hashes across rows so we have to compare per-salt at check
 * time. If the DB leaks, an attacker still has to brute-force per-user.
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const HISTORY_DEPTH = 5;
const SALT_BYTES = 16;

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function hashWithSalt(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

function generateSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

// ─── Internal helpers ─────────────────────────────────────────────────────

export const getUserIdByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<Id<"users"> | null> => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    return user?._id ?? null;
  },
});

export const getHistoryForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("passwordHistory")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(HISTORY_DEPTH);
    return rows.map((r) => ({ hash: r.hash, salt: r.salt }));
  },
});

export const appendAndPrune = internalMutation({
  args: {
    userId: v.id("users"),
    hash: v.string(),
    salt: v.string(),
  },
  handler: async (ctx, { userId, hash, salt }) => {
    await ctx.db.insert("passwordHistory", {
      userId,
      hash,
      salt,
      createdAt: Date.now(),
    });
    // Prune anything beyond the most recent N.
    const all = await ctx.db
      .query("passwordHistory")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    for (let i = HISTORY_DEPTH; i < all.length; i++) {
      await ctx.db.delete(all[i]._id);
    }
  },
});

// ─── Public actions used by the Auth page ─────────────────────────────────

/**
 * Check if `newPassword` matches any of the user's last 5 passwords.
 * Returns `{ reused: false }` even when the email is unknown — never leak
 * account existence; the reset flow itself rejects the bad code separately.
 */
export const checkPasswordReuse = action({
  args: { email: v.string(), newPassword: v.string() },
  handler: async (ctx, { email, newPassword }): Promise<{ reused: boolean }> => {
    const normalized = email.trim().toLowerCase();
    if (newPassword.length < 8) return { reused: false };
    const userId: Id<"users"> | null = await ctx.runQuery(
      internal.passwordHistory.getUserIdByEmail,
      { email: normalized },
    );
    if (!userId) return { reused: false };
    const history: { hash: string; salt: string }[] = await ctx.runQuery(
      internal.passwordHistory.getHistoryForUser,
      { userId },
    );
    for (const entry of history) {
      const candidate = await hashWithSalt(newPassword, entry.salt);
      if (candidate === entry.hash) return { reused: true };
    }
    return { reused: false };
  },
});

/**
 * Append the just-set password to the user's history. Called by the auth
 * frontend right after a successful sign-up or password reset, while the
 * caller is authenticated.
 */
export const recordPasswordChange = action({
  args: { newPassword: v.string() },
  handler: async (ctx, { newPassword }): Promise<{ recorded: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { recorded: false };
    if (newPassword.length < 8) return { recorded: false };
    const salt = generateSalt();
    const hash = await hashWithSalt(newPassword, salt);
    await ctx.runMutation(internal.passwordHistory.appendAndPrune, {
      userId,
      hash,
      salt,
    });
    return { recorded: true };
  },
});
