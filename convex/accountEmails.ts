import { action } from "./_generated/server";
import { v } from "convex/values";
import { sendEmail, signupCongratsHtml, addContactToBrevoList, EmailError } from "./email";

const APP_URL = process.env.APP_URL ?? "https://n-beta-flame.vercel.app";

/**
 * Fire-and-forget: send signup congrats email + add user to Brevo marketing contacts.
 * Called from frontend after successful signUp. Does not throw — returns status object.
 */
export const sendSignupWelcome = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (_ctx, { email, name }): Promise<{ emailSent: boolean; contactAdded: boolean; error: string | null }> => {
    const normalized = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { emailSent: false, contactAdded: false, error: "invalid_email" };
    }

    let emailSent = false;
    let error: string | null = null;
    try {
      await sendEmail({
        to: { email: normalized, name },
        subject: name ? `Welcome to Thalify, ${name.split(/\s+/)[0]} 🎉` : "Welcome to Thalify 🎉",
        html: signupCongratsHtml({ email: normalized, name, appUrl: APP_URL }),
      });
      emailSent = true;
    } catch (err) {
      error = err instanceof EmailError ? err.userMessage : (err instanceof Error ? err.message : "Email failed");
      console.error("Signup welcome email failed:", err);
    }

    let contactAdded = false;
    try {
      await addContactToBrevoList({ email: normalized, name });
      contactAdded = true;
    } catch (err) {
      console.error("Brevo contact add failed:", err);
    }

    return { emailSent, contactAdded, error };
  },
});
