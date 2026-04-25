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

export async function sendText(
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { success: false, error: "TELEGRAM_BOT_TOKEN missing" };

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
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
