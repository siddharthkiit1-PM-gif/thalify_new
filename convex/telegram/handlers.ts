/**
 * Inbound-message handlers for the Telegram bot.
 *
 * Scheduled from the webhook so the HTTP response returns to Telegram
 * inside the 60s budget while AI work happens out-of-band.
 *
 *   handleText      → Health Buddy text reply (Gemini)
 *   handlePhoto     → meal scan + reply with [Log as breakfast/lunch/snack/dinner] [Skip] buttons
 *   handleCallback  → button-tap router: log the scan / skip / etc.
 */
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  sendText,
  sendChatAction,
  downloadFileAsBase64,
  editMessageText,
  answerCallbackQuery,
  type InlineKeyboardButton,
} from "./adapter";
import type { Id, Doc } from "../_generated/dataModel";

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

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
};

const NOT_CONNECTED_REPLY =
  "I don't recognise this account yet. Open Thalify and tap 'Connect with Telegram' to link us — then I can answer questions and log your meals.";

function summariseScan(items: ScanItem[], totalCal: number, totalProtein: number, suggestedMealType: MealType): string {
  const lines = items.map(
    (i) => `• ${i.name} (${i.portion}) — ${i.cal} cal · ${Math.round(i.protein)}g protein`,
  );
  return (
    `I see this meal:\n\n${lines.join("\n")}\n\n` +
    `Total: ${totalCal} cal · ${Math.round(totalProtein)}g protein\n\n` +
    `Looks like ${MEAL_LABEL[suggestedMealType].toLowerCase()} based on the time. Tap to log:`
  );
}

function scanButtons(scanResultId: string, suggestedMealType: MealType): InlineKeyboardButton[][] {
  const others: MealType[] = (["breakfast", "lunch", "snack", "dinner"] as MealType[]).filter(
    (m) => m !== suggestedMealType,
  );
  return [
    [
      { text: `✓ Log as ${MEAL_LABEL[suggestedMealType]}`, callback_data: `log:${scanResultId}:${suggestedMealType}` },
      { text: "✗ Skip", callback_data: `skip:${scanResultId}` },
    ],
    others.map((m) => ({ text: MEAL_LABEL[m], callback_data: `log:${scanResultId}:${m}` })),
  ];
}

// ── Text → meal extractor (with chat fallback) ────────────────────────
// First we ask the AI: is this a meal-log or just chat? If it's a meal,
// we present the same [Log as Lunch] [Skip] [Breakfast] [Snack] [Dinner]
// buttons the photo flow uses. The user taps one and `handleCallback`
// writes to mealLogs — same path as photo logs, no new code needed.
//
// If it's chat (questions, planning, smalltalk), we fall through to
// Health Buddy. Critically, the chat path can NEVER claim to log food
// (system prompt enforces this) — only the structured extraction +
// button-tap below actually persists a log.

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

    // Meal-extract first. If the user typed a meal, route to the log flow.
    let extract:
      | { intent: "log_meal"; scanResultId: string; items: ScanItem[]; totalCal: number; totalProtein: number }
      | { intent: "chat" };
    try {
      extract = await ctx.runAction(internal.scan.extractMealFromTextAsUser, {
        userId: lookup.userId,
        message: text,
      });
    } catch (err) {
      // Extractor failures are non-fatal — fall through to chat. The user
      // still gets a reply rather than a confusing error.
      console.warn("text-intake extract failed, falling through to chat:", err);
      extract = { intent: "chat" };
    }

    if (extract.intent === "log_meal") {
      const suggested = guessMealTypeFromIST();
      const summary = summariseScan(
        extract.items,
        extract.totalCal,
        extract.totalProtein,
        suggested,
      );
      await sendText(chatId, summary, {
        inlineKeyboard: scanButtons(extract.scanResultId, suggested),
      });
      return;
    }

    // Chat fallback — Health Buddy reply, no logging.
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

// ── Photo → scan + present buttons (no auto-log) ──────────────────────

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
      await sendText(chatId, "Couldn't read that photo — try sending again, or attach it as a regular photo (not a file).");
      return;
    }

    let result: {
      scanResultId: string;
      items: ScanItem[];
      totalCal: number;
      totalProtein: number;
    };
    try {
      result = await ctx.runAction(internal.scan.scanMealAsUser, {
        userId: lookup.userId,
        imageBase64: file.base64,
        mediaType: file.mediaType,
        // No autoLogAsMealType — we want the user to confirm via buttons
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't scan that meal — try better lighting or a closer shot.";
      await sendText(chatId, msg);
      return;
    }

    const suggested = guessMealTypeFromIST();
    const text = summariseScan(result.items, result.totalCal, result.totalProtein, suggested) +
      (caption ? `\n\n(your note: "${caption}")` : "");

    await sendText(chatId, text, {
      inlineKeyboard: scanButtons(result.scanResultId, suggested),
    });
  },
});

// ── Inline button tap router ──────────────────────────────────────────

export const handleCallback = internalAction({
  args: {
    chatId: v.string(),
    callbackQueryId: v.string(),
    data: v.string(),
    messageId: v.number(),
  },
  handler: async (ctx, { chatId, callbackQueryId, data, messageId }) => {
    const lookup: { userId: Id<"users"> } | null = await ctx.runQuery(
      internal.telegram.connect.getUserByChatId,
      { chatId },
    );
    if (!lookup) {
      await answerCallbackQuery(callbackQueryId, "Not connected.");
      return;
    }

    const parts = data.split(":");
    const action = parts[0];

    if (action === "skip" && parts.length === 2) {
      await answerCallbackQuery(callbackQueryId, "Skipped");
      await editMessageText(chatId, messageId, "✗ Skipped — not logged.\n\nSend another photo anytime.");
      return;
    }

    if (action === "log" && parts.length === 3) {
      const scanResultId = parts[1] as Id<"scanResults">;
      const mealType = parts[2] as MealType;
      if (!["breakfast", "lunch", "snack", "dinner"].includes(mealType)) {
        await answerCallbackQuery(callbackQueryId, "Invalid meal type");
        return;
      }

      const scan: Doc<"scanResults"> | null = await ctx.runQuery(
        internal.scan.getScanResultForUser,
        { scanResultId, userId: lookup.userId },
      );
      if (!scan) {
        await answerCallbackQuery(callbackQueryId, "Scan not found");
        await editMessageText(chatId, messageId, "Hmm, I lost that scan. Send the photo again.");
        return;
      }

      // Idempotency: if already consumed, just confirm and bail
      if (scan.consumedAt) {
        await answerCallbackQuery(callbackQueryId, "Already logged ✓");
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const mealLogId: Id<"mealLogs"> = await ctx.runMutation(internal.meals.logMealForUser, {
        userId: lookup.userId,
        date: today,
        mealType,
        items: scan.items.map((i) => ({
          name: i.name,
          portion: i.portion,
          cal: i.cal,
          protein: i.protein,
          carbs: i.carbs,
          fat: i.fat,
        })),
        totalCal: scan.totalCal,
      });
      await ctx.runMutation(internal.scan.markScanConsumed, {
        scanResultId,
        userId: lookup.userId,
        mealLogId,
      });

      const lines = scan.items.map((i) => `• ${i.name} (${i.portion}) — ${i.cal} cal`);
      await answerCallbackQuery(callbackQueryId, `Logged as ${MEAL_LABEL[mealType]} ✓`);
      await editMessageText(
        chatId,
        messageId,
        `✓ Logged as ${MEAL_LABEL[mealType]}\n\n${lines.join("\n")}\n\n` +
          `Total: ${scan.totalCal} cal · ${Math.round(scan.totalProtein ?? 0)}g protein\n\n` +
          `Send another photo to log more, or open Thalify to fine-tune portions.`,
      );
      return;
    }

    await answerCallbackQuery(callbackQueryId);
  },
});
