/**
 * Telegram webhook — receives updates from the Bot API.
 *
 * We register this URL with Telegram via setWebhook with a secret_token.
 * Telegram echoes the secret in X-Telegram-Bot-Api-Secret-Token on every call.
 *
 * Only message updates are handled today: /start <token> and STOP.
 */
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { sendText } from "./adapter";

export const inbound = httpAction(async (ctx, req) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expectedSecret) {
      return new Response("forbidden", { status: 401 });
    }
  }

  const body = (await req.json()) as {
    message?: {
      chat: { id: number };
      text?: string;
    };
  };
  const message = body.message;
  if (!message) return new Response("ok", { status: 200 });

  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendText(
        chatId,
        "Hi! Open Thalify and click 'Connect Telegram' to link your account.",
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
        ? "Connected to Thalify ✓ You'll get nudges here based on your meals."
        : "That link is expired. Open Thalify and click 'Connect Telegram' again.",
    );
  } else if (text.toUpperCase() === "STOP") {
    await ctx.runMutation(internal.telegram.connect.handleStop, { chatId });
    await sendText(
      chatId,
      "Unsubscribed. Reconnect anytime by clicking 'Connect Telegram' in the app.",
    );
  }

  return new Response("ok", { status: 200 });
});
