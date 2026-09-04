export interface CampaignStats {
  sent: number;
  totalOpens: number;
  totalClicks: number;
}

export interface ComputeStatsInput {
  sent: number;
  totalOpens: number;
  totalClicks: number;
}

export function computeStats(input: ComputeStatsInput): CampaignStats {
  return {
    sent: Math.max(0, input.sent ?? 0),
    totalOpens: input.totalOpens ?? 0,
    totalClicks: input.totalClicks ?? 0,
  };
}
