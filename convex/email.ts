/**
 * Transactional email sending via Brevo.
 * Free tier: 300 emails/day. Docs: https://developers.brevo.com/reference/sendtransacemail
 */

import { escapeHtml } from "./lib/security";

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

export async function addContactToBrevoList(opts: { email: string; name?: string; listIds?: number[] }): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;

  const body: Record<string, unknown> = {
    email: opts.email.toLowerCase().trim(),
    updateEnabled: true,
  };
  if (opts.name) {
    const parts = opts.name.trim().split(/\s+/);
    body.attributes = {
      FIRSTNAME: parts[0] ?? "",
      LASTNAME: parts.slice(1).join(" "),
    };
  }
  if (opts.listIds && opts.listIds.length > 0) {
    body.listIds = opts.listIds;
  }

  try {
    await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Brevo contact add failed:", err);
  }
}

export function signupCongratsHtml(opts: { email: string; name?: string; appUrl: string }): string {
  const firstName = escapeHtml(opts.name?.trim().split(/\s+/)[0] || "there");
  const safeEmail = escapeHtml(opts.email);
  const dashboardUrl = `${opts.appUrl}/dashboard`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Welcome to Thalify 🎉</title></head>
<body style="margin:0;padding:0;background:#FEFCF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCF8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:44px 40px;border:1px solid #E8E2D5;">
        <tr><td>
          <div style="margin-bottom:28px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:36px;height:36px;background:#2D5F3A;color:#FEFCF8;border-radius:8px;text-align:center;vertical-align:middle;font-weight:700;font-size:14px;">Th</td>
              <td style="padding-left:10px;font-size:18px;font-weight:600;color:#1A1A1A;">Thalify</td>
            </tr></table>
          </div>

          <div style="font-size:32px;margin-bottom:12px;">🎉</div>

          <h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.25;margin:0 0 14px 0;color:#1A1A1A;font-weight:500;">
            Congrats ${firstName}, you're on board.
          </h1>

          <p style="font-size:16px;line-height:1.65;color:#4A4A4A;margin:0 0 28px 0;">
            Your Thalify account is live. You've got unlimited AI meal scans, coach chat, family plate optimizer, and lab analysis — all tuned for Indian food.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
            <tr><td style="border-radius:12px;background:#2D5F3A;">
              <a href="${dashboardUrl}"
                 style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#FEFCF8;text-decoration:none;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Sign in to Thalify →
              </a>
            </td></tr>
          </table>

          <div style="background:#F3F0E8;border-radius:14px;padding:22px;margin:0 0 28px 0;">
            <div style="font-size:11px;font-weight:700;color:#2D5F3A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Your 3-minute first test</div>
            <div style="font-size:14px;color:#1A1A1A;line-height:1.9;">
              <b>1.</b> &nbsp;Finish onboarding (goal, diet, city) — takes 30 sec<br/>
              <b>2.</b> &nbsp;Open the Scan page → take a photo of anything on your plate<br/>
              <b>3.</b> &nbsp;Ask the AI coach: <i>"What should I eat for dinner tonight?"</i>
            </div>
          </div>

          <p style="font-size:14px;line-height:1.65;color:#4A4A4A;margin:0 0 16px 0;">
            Your feedback shapes what we build next. Reply to this email with anything that breaks, confuses, or delights you. A human reads every reply.
          </p>

          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:16px 0 0 0;">
            — The Thalify team
          </p>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#8A8A8A;margin-top:20px;">
        Sent to ${safeEmail} · Account created on Thalify
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function waitlistWelcomeHtml(opts: { email: string; position: number; appUrl: string }): string {
  const safeEmail = escapeHtml(opts.email);
  const signupUrl = `${opts.appUrl}/auth?email=${encodeURIComponent(opts.email)}&ref=waitlist`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Your Thalify early access is ready</title></head>
<body style="margin:0;padding:0;background:#FEFCF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCF8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:44px 40px;border:1px solid #E8E2D5;">
        <tr><td>
          <div style="margin-bottom:28px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:36px;height:36px;background:#2D5F3A;color:#FEFCF8;border-radius:8px;text-align:center;vertical-align:middle;font-weight:700;font-size:14px;">Th</td>
              <td style="padding-left:10px;font-size:18px;font-weight:600;color:#1A1A1A;">Thalify</td>
            </tr></table>
          </div>

          <div style="display:inline-block;background:#EEF7EC;color:#2D5F3A;padding:6px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:16px;">
            Early access · Seat #${opts.position}
          </div>

          <h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.25;margin:0 0 14px 0;color:#1A1A1A;font-weight:500;">
            You're in. Start using Thalify now.
          </h1>

          <p style="font-size:16px;line-height:1.65;color:#4A4A4A;margin:0 0 28px 0;">
            Your early access is active. Click below to create your account and try India's first AI health coach that actually gets Indian food — scan a thali, chat in Hinglish, upload lab reports.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
            <tr><td style="border-radius:12px;background:#2D5F3A;">
              <a href="${signupUrl}"
                 style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#FEFCF8;text-decoration:none;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Create my account →
              </a>
            </td></tr>
          </table>

          <div style="font-size:12px;color:#8A8A8A;margin:0 0 32px 0;">
            Or copy this link:<br/>
            <a href="${signupUrl}" style="color:#2D5F3A;word-break:break-all;">${signupUrl}</a>
          </div>

          <div style="background:#F3F0E8;border-radius:14px;padding:22px;margin:0 0 28px 0;">
            <div style="font-size:11px;font-weight:700;color:#2D5F3A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">What you'll unlock</div>
            <div style="font-size:14px;color:#1A1A1A;line-height:1.9;">
              📸 &nbsp;<b>Photo scan</b> — point phone at thali, calories in 3 sec<br/>
              💬 &nbsp;<b>AI chat coach</b> — ask anything in Hindi, English, or Hinglish<br/>
              🍽️ &nbsp;<b>Family plate optimizer</b> — fix tonight's meal for everyone<br/>
              🧪 &nbsp;<b>Lab report analysis</b> — upload blood work, get Indian food advice
            </div>
          </div>

          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:0;">
            You're one of the first ${opts.position} people testing this. Reply to this email with any feedback — we read every response.
          </p>
          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:16px 0 0 0;">
            — The Thalify team
          </p>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#8A8A8A;margin-top:20px;">
        Sent to ${safeEmail} · You joined the Thalify waitlist
      </div>
    </td></tr>
  </table>
</body></html>`;
}
