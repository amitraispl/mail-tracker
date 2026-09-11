/**
 * Turns a campaign's shared, already-token-rewritten HTML (see transform.ts)
 * into one recipient's personalized copy by appending `&r=<recipientId>` to
 * every tracking URL. Same pixel/link token for everyone — only `r` differs
 * — so an open/click is "which link" (token) + "who" (r), read back by
 * routes/track.ts.
 *
 * Plain string substitution, not a re-parse: the URLs it targets are the
 * exact ones transformHtml() already produced, so a regex swap is enough
 * and stays cheap at any recipient count.
 */
export function renderForRecipient(processedHtml: string, recipientId: string): string {
  const r = encodeURIComponent(recipientId);
  return processedHtml.replace(
    /(\/api\/track\/(?:open|click)\/[^"'\s]+)/g,
    (url) => `${url}${url.includes("?") ? "&" : "?"}r=${r}`,
  );
}
