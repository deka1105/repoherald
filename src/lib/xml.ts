/**
 * XML text helpers for the RSS feed.
 *
 * A separate module rather than locals in `src/app/feed.xml/route.ts` for the
 * same reason the schema builders are pure: escaping is the part that can
 * silently produce a malformed document from untrusted input, so it is the
 * part that has to be unit-testable without a database or a request.
 */

/**
 * Escape a string for an XML text node or attribute value.
 *
 * `&` is replaced first; doing it later would double-escape the entities the
 * other replacements introduce.
 *
 * The leading strip is not belt-and-braces. XML 1.0 cannot represent most C0
 * control characters at all — not even as a numeric character reference — so a
 * single one reaching the output makes the whole document invalid and every
 * reader rejects it. Tab, newline and carriage return are the three that are
 * legal and are deliberately kept. Repo names and descriptions come from
 * GitHub, so this input is not ours to trust.
 */
export function xmlText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** RSS requires RFC 822 dates, which is what `toUTCString` produces. */
export function rfc822(date: Date): string {
  return date.toUTCString();
}
