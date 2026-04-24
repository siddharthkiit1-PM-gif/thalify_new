import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { sendEmail, waitlistWelcomeHtml, EmailError } from "./email";
import { checkRateLimit } from "./lib/rateLimit";

const APP_URL = process.env.APP_URL ?? "https://n-beta-flame.vercel.app";

export const alreadyJoined = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("waitlist")
      .filter(q => q.eq(q.field("email"), normalized))
      .first();
    return existing !== null;
  },
});

export const getWaitlistCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("waitlist").collect();
    return all.length;
  },
});

export const insertWaitlistEntry = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await checkRateLimit(ctx, `email:${email}`, "waitlist");

    const existing = await ctx.db
      .query("waitlist")
      .filter(q => q.eq(q.field("email"), email))
      .first();
    if (existing) {
      const all = await ctx.db.query("waitlist").collect();
      const position = all.findIndex(w => w._id === existing._id) + 1;
      return { alreadyJoined: true, position };
    }
    await ctx.db.insert("waitlist", { email, createdAt: Date.now() });
    const all = await ctx.db.query("waitlist").collect();
    return { alreadyJoined: false, position: all.length };
  },
});

export const joinWaitlist = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ position: number; emailSent: boolean; emailError: string | null }> => {
    const normalized = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Please enter a valid email address.");
    }
    if (normalized.length > 200) {
      throw new Error("Email is too long.");
    }

    const { alreadyJoined, position } = await ctx.runMutation(internal.waitlist.insertWaitlistEntry, { email: normalized });

    if (alreadyJoined) {
      return { position, emailSent: false, emailError: "already_joined" };
    }

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendEmail({
        to: { email: normalized },
        subject: `Your Thalify early access is ready — seat #${position}`,
        html: waitlistWelcomeHtml({ email: normalized, position, appUrl: APP_URL }),
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof EmailError ? err.userMessage : (err instanceof Error ? err.message : "Email failed");
      console.error("Waitlist email failed:", err);
    }

    return { position, emailSent, emailError };
  },
});

// Deprecated: kept for backward compatibility. Frontend should use joinWaitlist action.
export const joinWaitlistLegacy = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("waitlist")
      .filter(q => q.eq(q.field("email"), normalized))
      .first();
    if (existing) return;
    await ctx.db.insert("waitlist", { email: normalized, createdAt: Date.now() });
  },
});
