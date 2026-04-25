/**
 * Telegram webhook — receives updates from the Bot API.
 *
 * Registered with Telegram via setWebhook with a secret_token. Telegram
 * echoes the secret in X-Telegram-Bot-Api-Secret-Token on every call.
 *
 * Routes:
 *   /start <token>    → completeConnect (link Telegram chat to user)
 *   /start (no arg)   → onboarding hint
 *   STOP              → opt out
 *   /help             → bot capabilities
 *   text message      → schedule handleText (Health Buddy AI reply)
 *   photo message     → schedule handlePhoto (scan + auto-log)
 *   voice / video     → polite "I do text + photos for now"
 *   anything else     → silent ack
 *
 * Long-running work is scheduled via runAfter(0, ...) so the webhook
 * returns 200 to Telegram immediately (their 60s timeout is real).
 */
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { sendText } from "./adapter";

const HELP_TEXT =
  "Hi! I'm your Thalify coach on Telegram.\n\n" +
  "📷 Send me a meal photo — I'll scan it, log it, and tell you the calories.\n" +
  "💬 Ask me anything about your meals or what to eat next.\n" +
  "🛑 Reply STOP anytime to unsubscribe.";

type TelegramPhoto = { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number };

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    photo?: TelegramPhoto[];
    caption?: string;
    voice?: { file_id: string };
    video?: { file_id: string };
    video_note?: { file_id: string };
    document?: { file_id: string; mime_type?: string };
    sticker?: { file_id: string };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

export const inbound = httpAction(async (ctx, req) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expectedSecret) {
      return new Response("forbidden", { status: 401 });
    }
  }

  const body = (await req.json()) as TelegramUpdate;

  // Inline button tap → schedule the callback handler, return fast
  if (body.callback_query) {
    const cq = body.callback_query;
    if (cq.message?.chat.id && cq.data) {
      await ctx.scheduler.runAfter(0, internal.telegram.handlers.handleCallback, {
        chatId: String(cq.message.chat.id),
        callbackQueryId: cq.id,
        data: cq.data,
        messageId: cq.message.message_id,
      });
    }
    return new Response("ok", { status: 200 });
  }

  const message = body.message;
  if (!message) return new Response("ok", { status: 200 });

  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();
  const upper = text.toUpperCase();

  // ── 1. Commands & keywords (handled inline, fast) ────────────────────
  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendText(
        chatId,
        "Hi! Open Thalify and tap 'Connect with Telegram' to link your account. Once connected I can scan your meals and answer nutrition questions.",
      );
      return new Response("ok", { status: 200 });
    }
    const result = await ctx.runMutation(internal.telegram.connect.completeConnect, {
      token,
      chatId,
    });
    await sendText(
      chatId,
      result.ok
        ? "Connected to Thalify ✓\n\n" + HELP_TEXT
        : "That link is expired. Open Thalify and tap 'Connect with Telegram' to get a fresh one.",
    );
    return new Response("ok", { status: 200 });
  }

  if (upper === "STOP") {
    await ctx.runMutation(internal.telegram.connect.handleStop, { chatId });
    await sendText(
      chatId,
      "Unsubscribed. Reconnect anytime by tapping 'Connect with Telegram' in the app.",
    );
    return new Response("ok", { status: 200 });
  }

  if (text === "/help" || upper === "HELP") {
    await sendText(chatId, HELP_TEXT);
    return new Response("ok", { status: 200 });
  }

  // ── 2. Photo → schedule scan + auto-log ──────────────────────────────
  if (message.photo && message.photo.length > 0) {
    // Telegram returns multiple sizes; pick the largest for best AI accuracy
    const largest = [...message.photo].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    await ctx.scheduler.runAfter(0, internal.telegram.handlers.handlePhoto, {
      chatId,
      fileId: largest.file_id,
      caption: message.caption,
    });
    return new Response("ok", { status: 200 });
  }

  // ── 3. Text message → schedule Health Buddy chat ─────────────────────
  if (text.length > 0) {
    await ctx.scheduler.runAfter(0, internal.telegram.handlers.handleText, {
      chatId,
      text,
    });
    return new Response("ok", { status: 200 });
  }

  // ── 4. Unsupported types — set expectations ──────────────────────────
  if (message.voice || message.video_note) {
    await sendText(
      chatId,
      "I can read text and photos, but voice notes are coming soon. Type your question or snap your meal.",
    );
  } else if (message.document?.mime_type?.startsWith("image/")) {
    // User sent a photo as a "file" — encourage them to use photo upload
    await sendText(
      chatId,
      "Send the meal as a regular photo (not as a file) and I'll scan it.",
    );
  } else if (message.sticker) {
    // Silent ack — stickers aren't a question
  }

  return new Response("ok", { status: 200 });
});
