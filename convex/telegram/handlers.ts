/**
 * Inbound-message handlers for the Telegram bot.
 *
 * These are scheduled from the webhook so the HTTP response returns to
 * Telegram quickly (under their 60s timeout) while the AI work happens
 * out-of-band.
 *
 * - handleText  : routes a text message into the Health Buddy chat (Gemini)
 * - handlePhoto : downloads the photo from Telegram, runs the meal scanner,
 *                 auto-logs it as the time-appropriate meal, replies with
 *                 the breakdown
 */
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sendText, sendChatAction, downloadFileAsBase64 } from "./adapter";
import type { Id } from "../_generated/dataModel";

type MealType = "breakfast" | "lunch" | "snack" | "dinner";
type ScanItem = { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number };

function guessMealTypeFromIST(): MealType {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const h = parseInt(hourStr, 10) % 24;
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 19) return "snack";
  return "dinner";
}

const NOT_CONNECTED_REPLY =
  "I don't recognise this account yet. Open Thalify and tap 'Connect with Telegram' to link us — then I can answer questions and log your meals.";

export const handleText = internalAction({
  args: { chatId: v.string(), text: v.string() },
  handler: async (ctx, { chatId, text }) => {
    const lookup: { userId: Id<"users"> } | null = await ctx.runQuery(
      internal.telegram.connect.getUserByChatId,
      { chatId },
    );
    if (!lookup) {
      await sendText(chatId, NOT_CONNECTED_REPLY);
      return;
    }

    await sendChatAction(chatId, "typing");

    try {
      const reply: string = await ctx.runAction(internal.chat.chatAsUser, {
        userId: lookup.userId,
        message: text,
      });
      await sendText(chatId, reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't reach AI right now — please retry in a minute.";
      await sendText(chatId, msg);
    }
  },
});

export const handlePhoto = internalAction({
  args: { chatId: v.string(), fileId: v.string(), caption: v.optional(v.string()) },
  handler: async (ctx, { chatId, fileId, caption }) => {
    const lookup: { userId: Id<"users"> } | null = await ctx.runQuery(
      internal.telegram.connect.getUserByChatId,
      { chatId },
    );
    if (!lookup) {
      await sendText(chatId, NOT_CONNECTED_REPLY);
      return;
    }

    await sendChatAction(chatId, "typing");

    const file = await downloadFileAsBase64(fileId);
    if (!file) {
      await sendText(chatId, "Couldn't read that photo — try sending again, or attach as a regular photo (not a file).");
      return;
    }

    const mealType = guessMealTypeFromIST();

    let result: {
      items: ScanItem[];
      totalCal: number;
      totalProtein: number;
      mealType?: string;
    };
    try {
      result = await ctx.runAction(internal.scan.scanMealAsUser, {
        userId: lookup.userId,
        imageBase64: file.base64,
        mediaType: file.mediaType,
        autoLogAsMealType: mealType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't scan that meal — try better lighting or a closer shot.";
      await sendText(chatId, msg);
      return;
    }

    const lines = result.items.map(
      (i) => `• ${i.name} (${i.portion}) — ${i.cal} cal · ${Math.round(i.protein)}g protein`,
    );
    const summary =
      `Logged as *${mealType}* ✓\n\n${lines.join("\n")}\n\n` +
      `Total: *${result.totalCal} cal* · ${Math.round(result.totalProtein)}g protein\n\n` +
      `${caption ? `(your note: "${caption}")\n\n` : ""}` +
      `Want to fix anything? Open Thalify → today's meals → tap to edit. Or just send another photo.`;

    await sendText(chatId, summary);
  },
});
