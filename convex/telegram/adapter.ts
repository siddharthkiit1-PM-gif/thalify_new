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
