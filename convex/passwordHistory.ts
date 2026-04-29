/**
 * Password-reuse guard.
 *
 * Stores the last 5 PBKDF2-SHA256 hashes of each user's plaintext passwords.
 * On reset, candidate is hashed against each stored salt; any match → reject.
 *
 * Why a separate store from @convex-dev/auth's password hash: their hash is
 * one-way for the *current* password only — no API for past hashes. We need
 * "have we seen this plaintext before?", which means our own per-change hash.
 *
 * PBKDF2 100k iterations + per-entry random salt: makes brute-force per user
 * ~100,000× more expensive than a plain hash if the DB ever leaks. Per-entry
 * salt prevents same-password-twice → same-hash leakage and limits blast
 * radius if any single salt is exposed.
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const HISTORY_DEPTH = 5;
const SALT_BYTES = 16;
const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

async function hashWithSalt(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITS,
  );
  return bytesToHex(new Uint8Array(bits));
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
