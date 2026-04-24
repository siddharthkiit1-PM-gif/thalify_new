/**
 * Password reset provider: generates an 8-character alphanumeric code, emails it
 * via Brevo, and lets the user enter it along with a new password to reset.
 */

import { Email } from "@convex-dev/auth/providers/Email";
import { sendEmail } from "./email";
import { escapeHtml } from "./lib/security";

const APP_URL = process.env.APP_URL ?? "https://n-beta-flame.vercel.app";

function generateResetCode(): string {
  // 8-char alphanumeric, omits ambiguous chars (0/O, 1/I)
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

function resetEmailHtml(opts: { email: string; code: string }): string {
  const safeEmail = escapeHtml(opts.email);
  const safeCode = escapeHtml(opts.code);
  const resetUrl = `${APP_URL}/auth?email=${encodeURIComponent(opts.email)}&mode=reset&code=${encodeURIComponent(opts.code)}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Reset your Thalify password</title></head>
<body style="margin:0;padding:0;background:#FEFCF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1A1A1A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEFCF8;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:40px 36px;border:1px solid #E8E2D5;">
        <tr><td>
          <div style="margin-bottom:28px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:36px;height:36px;background:#2D5F3A;color:#FEFCF8;border-radius:8px;text-align:center;vertical-align:middle;font-weight:700;font-size:14px;">Th</td>
              <td style="padding-left:10px;font-size:18px;font-weight:600;color:#1A1A1A;">Thalify</td>
            </tr></table>
          </div>

          <h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.3;margin:0 0 14px 0;color:#1A1A1A;font-weight:500;">
            Reset your password
          </h1>
          <p style="font-size:15px;line-height:1.6;color:#4A4A4A;margin:0 0 24px 0;">
            We got a request to reset the password for <b style="color:#1A1A1A;">${safeEmail}</b>. Use the code below (valid for 30 minutes):
          </p>

          <div style="background:#F3F0E8;border-radius:14px;padding:20px;text-align:center;margin:0 0 24px 0;">
            <div style="font-size:11px;font-weight:700;color:#2D5F3A;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Your reset code</div>
            <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:700;color:#2D5F3A;letter-spacing:0.15em;">${safeCode}</div>
          </div>

          <table cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
            <tr><td style="border-radius:10px;background:#2D5F3A;">
              <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#FEFCF8;text-decoration:none;border-radius:10px;">
                Reset password →
              </a>
            </td></tr>
          </table>

          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:0 0 4px 0;">
            Didn't request this? Ignore this email — your password won't change.
          </p>
          <p style="font-size:13px;line-height:1.6;color:#8A8A8A;margin:16px 0 0 0;">
            — The Thalify team
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const ThalifyPasswordReset = Email({
  id: "password-reset",
  maxAge: 30 * 60,
  async generateVerificationToken() {
    return generateResetCode();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    await sendEmail({
      to: { email },
      subject: `Your Thalify password reset code: ${token}`,
      html: resetEmailHtml({ email, code: token }),
    });
  },
});
