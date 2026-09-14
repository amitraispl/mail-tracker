/**
 * Turns a campaign's shared, already-token-rewritten HTML (see transform.ts)
 * into one recipient's personalized copy: substitutes `{{variablename}}`
 * placeholders (case-insensitive) with that recipient's data, then appends
 * `&r=<recipientId>` to every tracking URL. Same pixel/link token for
 * everyone — only `r` (and now the substituted text) differs — so an
 * open/click is still "which link" (token) + "who" (r), read back by
 * routes/track.ts.
 *
 * Plain string substitution, not a re-parse: the URLs it targets are the
 * exact ones transformHtml() already produced, so a regex swap is enough
 * and stays cheap at any recipient count.
 */

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Recipient-supplied values (an uploaded name, in particular) go straight
 *  into the HTML body — escape them so a name like `Jane <script>` can't
 *  break the markup or inject anything into a mass-sent email. Unknown
 *  placeholders (no matching key) are left as-is rather than blanked, so a
 *  typo in the template is visible instead of silently disappearing. */
export function applyVariables(html: string, variables: Record<string, string>): string {
  const lookup = new Map(Object.entries(variables).map(([k, v]) => [k.toLowerCase(), v]));
  return html.replace(PLACEHOLDER_RE, (match, key: string) => {
    const value = lookup.get(key.toLowerCase());
    return value === undefined ? match : escapeHtml(value);
  });
}

export function renderForRecipient(
  processedHtml: string,
  recipient: { id: string; email: string; name?: string | null },
): string {
  const withVariables = applyVariables(processedHtml, {
    name: recipient.name?.trim() || "",
    email: recipient.email,
  });

  const r = encodeURIComponent(recipient.id);
  return withVariables.replace(
    /(\/api\/track\/(?:open|click)\/[^"'\s]+)/g,
    (url) => `${url}${url.includes("?") ? "&" : "?"}r=${r}`,
  );
}
