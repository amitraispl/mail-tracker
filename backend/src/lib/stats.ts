export interface CampaignStats {
  sent: number;
  totalOpens: number;
  totalClicks: number;
}

export interface ComputeStatsInput {
  sent: number;
  /** Raw OpenEvent count, before the send-load correction below. */
  rawOpens: number;
  totalClicks: number;
}

/**
 * The tracked HTML's pixel fires once at compose/send time too (the mail
 * client loading the message body counts as an "open" even though no
 * recipient has actually seen it yet) — one false open per email sent.
 * Subtracting `sent` from the raw open count cancels exactly that, so what's
 * left is real recipient opens beyond the send-time noise. Clamped at 0 so
 * it never goes negative while `sent` is catching up.
 */
export function computeStats(input: ComputeStatsInput): CampaignStats {
  const sent = Math.max(0, input.sent ?? 0);
  return {
    sent,
    totalOpens: Math.max(0, (input.rawOpens ?? 0) - sent),
    totalClicks: Math.max(0, input.totalClicks ?? 0),
  };
}
