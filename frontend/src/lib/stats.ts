/**
 * The tracked pixel fires at compose/send-preview time on some mail clients
 * but not others (many block remote images by default), so raw OpenEvent
 * count isn't 1:1 with real recipient opens — subtracting `sent` cancels
 * that noise. Done here (not in the API response) so editing the send count
 * updates the displayed number on next render without a shape change to the
 * backend response.
 */
export function displayedOpens(rawOpens: number, sent: number): number {
  return Math.max(0, rawOpens - sent);
}
