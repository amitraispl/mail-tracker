export interface CampaignStats {
  sent: number;
  rawOpens: number;
  totalClicks: number;
  /** Distinct recipients with at least one open. Only counts platform-sent,
   *  non-test recipients — manual-paste opens have no recipientId to dedup by. */
  uniqueOpens: number;
  /** Distinct recipients with at least one click, regardless of how many
   *  links or how many times each was clicked (one recipient = 1, always). */
  uniqueClicks: number;
}

export interface ComputeStatsInput {
  sent: number;
  rawOpens: number;
  totalClicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
}

/** Raw counts only — no rate/%% math, no send-load correction. `sent` is a
 *  live count of actual platform sends (routes/sending.ts runSendLoop), not
 *  a manually entered value. `uniqueOpens`/`uniqueClicks` are the one
 *  deliberate exception to "no dedup" — a per-recipient headcount, not a rate. */
export function computeStats(input: ComputeStatsInput): CampaignStats {
  return {
    sent: Math.max(0, input.sent ?? 0),
    rawOpens: Math.max(0, input.rawOpens ?? 0),
    totalClicks: Math.max(0, input.totalClicks ?? 0),
    uniqueOpens: Math.max(0, input.uniqueOpens ?? 0),
    uniqueClicks: Math.max(0, input.uniqueClicks ?? 0),
  };
}
