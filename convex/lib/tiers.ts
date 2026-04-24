/**
 * User tier / allowlist logic.
 * Unlimited users bypass the free-tier 5/day cap.
 * Update the Set to grant unlimited access to more users.
 */
const UNLIMITED_EMAILS: ReadonlySet<string> = new Set([
  "agrawalsiddharth66@gmail.com",
  "siddharth.kiit1@gmail.com",
  "agrawalsiddharth18@gmail.com",
]);

export function isUnlimitedUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return UNLIMITED_EMAILS.has(email.toLowerCase().trim());
}
