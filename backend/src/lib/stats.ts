export interface CampaignStats {
  sent: number;
  rawOpens: number;
  totalClicks: number;
}

export interface ComputeStatsInput {
  sent: number;
  rawOpens: number;
  totalClicks: number;
}

/** Raw counts only — no rate/%% math, no send-load correction. `sent` is a
 *  live count of actual platform sends (routes/sending.ts runSendLoop), not
 *  a manually entered value. */
export function computeStats(input: ComputeStatsInput): CampaignStats {
  return {
    sent: Math.max(0, input.sent ?? 0),
    rawOpens: Math.max(0, input.rawOpens ?? 0),
    totalClicks: Math.max(0, input.totalClicks ?? 0),
  };
}
