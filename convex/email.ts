/**
 * Transactional email sending via Brevo.
 * Free tier: 300 emails/day. Docs: https://developers.brevo.com/reference/sendtransacemail
 */

export class EmailError extends Error {
  readonly userMessage: string;
  readonly statusCode: number;
  constructor(statusCode: number, userMessage: string, raw: string) {
    super(raw);
    this.userMessage = userMessage;
    this.statusCode = statusCode;
  }
}

export async function sendEmail(opts: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text?: string;
}): Promise<{ messageId: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Thalify";

  if (!apiKey) throw new EmailError(500, "Email service not configured.", "BREVO_API_KEY missing");
  if (!senderEmail) throw new EmailError(500, "Sender email not configured.", "BREVO_SENDER_EMAIL missing");

  const body = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: opts.to.email, name: opts.to.name ?? opts.to.email }],
    subject: opts.subject,
    htmlContent: opts.html,
    textContent: opts.text ?? opts.html.replace(/<[^>]+>/g, "").trim(),
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();

  if (!response.ok) {
    let userMsg = "Could not send email. Please try again.";
    if (response.status === 401) userMsg = "Email service key invalid — contact support.";
    else if (response.status === 400 && raw.includes("sender")) userMsg = "Sender email not verified in Brevo — verify it in the dashboard.";
    else if (response.status === 429) userMsg = "Email daily quota reached — please try again tomorrow.";
    throw new EmailError(response.status, userMsg, raw);
  }

  try {
    const parsed = JSON.parse(raw) as { messageId?: string };
    return { messageId: parsed.messageId ?? "" };
  } catch {
    return { messageId: "" };
  }
}

export function waitlistWelcomeHtml(opts: { email: string; position: number; launchDate: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Welcome to Thalify</title></head>
<body style="margin:0;padding:0;background:#FEFCF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCF8;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:40px 36px;border:1px solid #E8E2D5;">
        <tr><td>
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:32px;">
            <div style="width:36px;height:36px;background:#2D5F3A;color:#FEFCF8;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">Th</div>
            <span style="font-size:18px;font-weight:600;color:#1A1A1A;">Thalify</span>
          </div>
          <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.3;margin:0 0 16px 0;color:#1A1A1A;font-weight:500;">
            You're in, namaste! 🙏
          </h1>
          <p style="font-size:15px;line-height:1.6;color:#4A4A4A;margin:0 0 24px 0;">
            You've claimed seat <b style="color:#2D5F3A;">#${opts.position}</b> on the Thalify waitlist — India's first AI health coach that actually gets Indian food.
          </p>
          <div style="background:#F3F0E8;border-radius:12px;padding:20px;margin:0 0 24px 0;">
            <div style="font-size:11px;font-weight:700;color:#2D5F3A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">What's next</div>
            <div style="font-size:14px;line-height:1.7;color:#1A1A1A;">
              We go live on <b>${opts.launchDate}</b>.<br/>
              Your activation link will land in this inbox first.
            </div>
          </div>
          <p style="font-size:14px;line-height:1.6;color:#4A4A4A;margin:0 0 8px 0;">
            <b>On launch day you'll unlock:</b>
          </p>
          <ul style="font-size:14px;line-height:1.8;color:#4A4A4A;margin:0 0 24px 0;padding-left:20px;">
            <li>Photo scan — point your phone at any thali, get calories in 3 seconds</li>
            <li>AI chat coach — ask anything about your meals, in Hindi or English</li>
            <li>Family plate optimizer — fix tonight's meal for the whole family</li>
            <li>Lab report analysis — upload blood work, get Indian food advice</li>
          </ul>
          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:0 0 4px 0;">
            Reply to this email if you have questions.
          </p>
          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:0;">
            — The Thalify team
          </p>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#8A8A8A;margin-top:20px;">
        Sent to ${opts.email} · You signed up at thalify.com
      </div>
    </td></tr>
  </table>
</body></html>`;
}
