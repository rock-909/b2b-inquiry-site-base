/**
 * 安全验证工具
 * Security validation utilities
 */

/**
 * Normalize plain text input: collapse whitespace and trim.
 *
 * Deliberately does NOT strip angle brackets or protocol-like substrings —
 * buyer text like "width < 900mm" must survive intact. Injection defense
 * lives at the sinks: escapeHtml in runtime-email-content.ts and
 * formula-prefix escaping in airtable/service-internal/field-sanitization.ts.
 *
 * Use this for single-line fields: names, company names, subject, etc.
 */
export function sanitizePlainText(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input.replace(/\s+/g, " ").trim();
}

/**
 * Normalize multiline text input: preserve line breaks while collapsing
 * horizontal whitespace within each line.
 *
 * Use this for buyer free-text that is rendered as multiple lines downstream
 * (contact `message`, product `requirements`). It keeps `\n` so multi-line
 * email/Airtable rendering stays meaningful, unlike the single-line
 * {@link sanitizePlainText} which flattens everything to one line.
 *
 * Rules:
 * - normalize `\r\n` / `\r` to `\n`;
 * - strip control characters except newline (tabs collapse to a space below);
 * - collapse runs of spaces/tabs within a line to a single space;
 * - trim horizontal whitespace around each line break;
 * - cap runs of blank lines at one blank line;
 * - trim the whole value.
 */
export function sanitizeMultilineText(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return (
    input
      .replace(/\r\n?/g, "\n")
      // eslint-disable-next-line no-control-regex -- intentionally strip control chars except newline
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
