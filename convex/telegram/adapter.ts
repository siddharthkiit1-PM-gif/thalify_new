/**
 * Telegram Bot API adapter — sendText to a chat id.
 * Free, no approvals, no per-message fees.
 */

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/** Show "typing..." in the user's chat — feels alive while AI is thinking. */
export async function sendChatAction(
  chatId: string,
  action: "typing" | "upload_photo" = "typing",
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // best-effort, never throw
  }
}

/**
 * Resolve a Telegram file_id → temporary download URL, then fetch the bytes
 * and return them as base64 (what Gemini wants).
 */
export async function downloadFileAsBase64(fileId: string): Promise<{
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
} | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const fileResp = await fetch(
    `${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const fileData = (await fileResp.json()) as {
    ok: boolean;
    result?: { file_path: string };
  };
  if (!fileData.ok || !fileData.result?.file_path) return null;

  const filePath = fileData.result.file_path;
  const dlResp = await fetch(`${TELEGRAM_API}/file/bot${token}/${filePath}`);
  if (!dlResp.ok) return null;

  const buf = new Uint8Array(await dlResp.arrayBuffer());
  // Convert to base64 in chunks (large images would blow stack with apply)
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binary);

  // Telegram serves user-uploaded photos as JPEG (file_path ends in .jpg)
  const lower = filePath.toLowerCase();
  const mediaType = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  return { base64, mediaType };
}

export type InlineKeyboardButton = { text: string; callback_data: string };
export type SendOptions = {
  inlineKeyboard?: InlineKeyboardButton[][];
  parseMode?: "Markdown" | "HTML";
};

export async function sendText(
  chatId: string,
  text: string,
  options: SendOptions = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, error: "TELEGRAM_BOT_TOKEN missing" };

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (options.parseMode) body.parse_mode = options.parseMode;
  if (options.inlineKeyboard) {
    body.reply_markup = { inline_keyboard: options.inlineKeyboard };
  }

  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };
    if (!resp.ok || !data.ok) {
      return { success: false, error: data.description ?? `HTTP ${resp.status}` };
    }
    return { success: true, messageId: String(data.result?.message_id ?? "") };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Edit an existing message — used after a button tap to replace the
 * scan summary with a confirmation, removing the inline keyboard.
 */
export async function editMessageText(
  chatId: string,
  messageId: number | string,
  text: string,
  options: SendOptions = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, error: "TELEGRAM_BOT_TOKEN missing" };

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: typeof messageId === "string" ? parseInt(messageId, 10) : messageId,
    text,
    disable_web_page_preview: true,
  };
  if (options.parseMode) body.parse_mode = options.parseMode;
  if (options.inlineKeyboard !== undefined) {
    body.reply_markup = { inline_keyboard: options.inlineKeyboard };
  }

  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as { ok: boolean; description?: string };
    if (!resp.ok || !data.ok) {
      return { success: false, error: data.description ?? `HTTP ${resp.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Telegram requires a callback_query be acknowledged within ~30 seconds
 * or the user sees a perpetual loading spinner on the button. Calling
 * this with no text just clears the spinner.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch {
    // best-effort
  }
}
