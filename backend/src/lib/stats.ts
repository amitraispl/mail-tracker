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

/**
 * Raw counts only — no send-load correction here. The tracked pixel fires at
 * compose/send-preview time on some mail clients but not others (many block
 * remote images by default), so a flat `rawOpens - sent` subtraction doesn't
 * hold: it undercounts real opens whenever the send-time load didn't actually
 * happen. That correction is done client-side instead (`frontend/src/lib/stats.ts`),
 * computed from `rawOpens` and `sent` at render time, so it reacts to a
 * `sentCount` edit without this response needing to change shape.
 */
export function computeStats(input: ComputeStatsInput): CampaignStats {
  return {
    sent: Math.max(0, input.sent ?? 0),
    rawOpens: Math.max(0, input.rawOpens ?? 0),
    totalClicks: Math.max(0, input.totalClicks ?? 0),
  };
}
