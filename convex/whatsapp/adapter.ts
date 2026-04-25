/**
 * WhatsApp adapter — Twilio backend.
 *
 * Twilio's sandbox lets us send WhatsApp messages without going through Meta's
 * direct onboarding. Recipients must opt in by sending the join code from their
 * own WhatsApp first (e.g. "join neighborhood-would" → +14155238886).
 *
 * For the sandbox, sendTemplate degrades to sendText — sandbox has no template
 * approval flow. When we graduate to a registered Twilio number, we wire
 * Content Templates here.
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01";

export type WhatsappSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

function basicAuth(sid: string, token: string): string {
  return `Basic ${btoa(`${sid}:${token}`)}`;
}

function ensureWhatsappPrefix(toE164: string): string {
  return toE164.startsWith("whatsapp:") ? toE164 : `whatsapp:${toE164}`;
}

export async function sendText(
  toE164: string,
  text: string,
): Promise<WhatsappSendResult> {
  if (process.env.WHATSAPP_MOCK === "true") {
    console.log(`[whatsapp:mock] to ${toE164}: ${text}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    return { success: false, error: "Twilio env vars missing (TWILIO_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)" };
  }

  const url = `${TWILIO_API}/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    From: from,
    To: ensureWhatsappPrefix(toE164),
    Body: text,
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        authorization: basicAuth(sid, token),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = (await resp.json()) as {
      sid?: string;
      message?: string;
      code?: number;
    };
    if (!resp.ok) {
      const err = data.message ?? `Twilio HTTP ${resp.status}`;
      return { success: false, error: err };
    }
    return { success: true, messageId: data.sid };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTemplate(
  toE164: string,
  templateName: string,
  params: string[],
  _languageCode = "en",
): Promise<WhatsappSendResult> {
  // Sandbox has no template approval — just send the rendered body.
  // For verification codes, callers pass the code as the first param.
  const text =
    templateName === "whatsapp_verify_v1" && params[0]
      ? `Your Thalify verification code is ${params[0]}. It expires in 30 minutes.`
      : params.join(" ");
  return sendText(toE164, text);
}
