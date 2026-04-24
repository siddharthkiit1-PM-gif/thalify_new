import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { sendEmail, signupCongratsHtml, addContactToBrevoList, EmailError } from "./email";
import { checkRateLimit } from "./lib/rateLimit";

const APP_URL = process.env.APP_URL ?? "https://n-beta-flame.vercel.app";

export const recordSignupEmailRateLimit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await checkRateLimit(ctx, userId, "signupWelcome");
  },
});

export const sendSignupWelcome = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { email, name }): Promise<{ emailSent: boolean; contactAdded: boolean; error: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { emailSent: false, contactAdded: false, error: "not_authenticated" };
    }

    try {
      await ctx.runMutation(internal.accountEmails.recordSignupEmailRateLimit, { userId });
    } catch (err) {
      return { emailSent: false, contactAdded: false, error: err instanceof Error ? err.message : "rate_limited" };
    }

    const normalized = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { emailSent: false, contactAdded: false, error: "invalid_email" };
    }
    if (normalized.length > 200) {
      return { emailSent: false, contactAdded: false, error: "invalid_email" };
    }

    const safeName = name ? name.trim().slice(0, 100) : undefined;

    let emailSent = false;
    let error: string | null = null;
    try {
      await sendEmail({
        to: { email: normalized, name: safeName },
        subject: safeName ? `Welcome to Thalify, ${safeName.split(/\s+/)[0]} 🎉` : "Welcome to Thalify 🎉",
        html: signupCongratsHtml({ email: normalized, name: safeName, appUrl: APP_URL }),
      });
      emailSent = true;
    } catch (err) {
      error = err instanceof EmailError ? err.userMessage : (err instanceof Error ? err.message : "Email failed");
      console.error("Signup welcome email failed:", err);
    }

    let contactAdded = false;
    try {
      await addContactToBrevoList({ email: normalized, name: safeName });
      contactAdded = true;
    } catch (err) {
      console.error("Brevo contact add failed:", err);
    }

    return { emailSent, contactAdded, error };
  },
});
