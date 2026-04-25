const API_VERSION = "v22.0";

export type WhatsappSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function sendText(
  toE164: string,
  text: string,
): Promise<WhatsappSendResult> {
  if (process.env.WHATSAPP_MOCK === "true") {
    console.log(`[whatsapp:mock] to ${toE164}: ${text}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, error: "WhatsApp env vars missing" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "text",
        text: { body: text },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message ?? `HTTP ${resp.status}` };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTemplate(
  toE164: string,
  templateName: string,
  params: string[],
  languageCode = "en",
): Promise<WhatsappSendResult> {
  if (process.env.WHATSAPP_MOCK === "true") {
    console.log(
      `[whatsapp:mock] template ${templateName} to ${toE164}: ${params.join(", ")}`,
    );
    return { success: true, messageId: `mock-tpl-${Date.now()}` };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, error: "WhatsApp env vars missing" };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: params.map((t) => ({ type: "text", text: t })),
            },
          ],
        },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error?.message ?? `HTTP ${resp.status}` };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
