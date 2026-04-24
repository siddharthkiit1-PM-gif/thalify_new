/**
 * Security utilities: rate limiting + HTML escaping.
 */

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'/]/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

/**
 * Escape a value to be used safely in a URL query string.
 */
export function escapeUrl(input: string): string {
  return encodeURIComponent(input);
}
