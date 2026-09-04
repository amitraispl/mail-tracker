export interface CampaignStats {
  sent: number;
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
  /** uniqueOpens / sent, as a percentage rounded to 2 dp. */
  openRate: number;
  /** uniqueClicks / sent, as a percentage rounded to 2 dp. */
  clickRate: number;
  /** uniqueClicks / uniqueOpens, as a percentage rounded to 2 dp. */
  clickToOpenRate: number;
}

export interface ComputeStatsInput {
  sent: number;
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
}

/** Percentage to 2 dp; a non-positive denominator yields 0 rather than NaN/Infinity. */
export function rate(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100 * 100) / 100;
}

export function computeStats(input: ComputeStatsInput): CampaignStats {
  const sent = Math.max(0, input.sent ?? 0);
  const totalOpens = input.totalOpens ?? 0;
  const uniqueOpens = input.uniqueOpens ?? 0;
  const totalClicks = input.totalClicks ?? 0;
  const uniqueClicks = input.uniqueClicks ?? 0;

  return {
    sent,
    totalOpens,
    uniqueOpens,
    totalClicks,
    uniqueClicks,
    openRate: rate(uniqueOpens, sent),
    clickRate: rate(uniqueClicks, sent),
    clickToOpenRate: rate(uniqueClicks, uniqueOpens),
  };
}
