import { prisma } from "../db.js";
import { computeStats, type CampaignStats } from "./stats.js";

export interface PerLinkStats {
  id: string;
  label: string | null;
  originalUrl: string;
  totalClicks: number;
}

export interface CampaignDetail {
  id: string;
  name: string;
  subject: string | null;
  openToken: string;
  sentCount: number;
  createdAt: Date;
  processedHtml: string | null;
  stats: CampaignStats;
  perLink: PerLinkStats[];
}

export async function loadCampaign(id: string, userId: string): Promise<CampaignDetail | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id, userId },
    include: {
      links: {
        // Most-clicked first, so the ranking UI doesn't need to re-sort.
        orderBy: [{ clicks: { _count: "desc" } }, { id: "asc" }],
        include: { _count: { select: { clicks: true } } },
      },
      _count: { select: { opens: true, clicks: true } },
    },
  });

  if (!campaign) return null;

  const perLink: PerLinkStats[] = campaign.links.map((link) => ({
    id: link.id,
    label: link.label,
    originalUrl: link.originalUrl,
    totalClicks: link._count.clicks,
  }));

  // Per-recipient headcount, not a rate: how many distinct email addresses
  // opened/clicked at all, regardless of how many times or how many links.
  // isTest recipients are excluded to match every other analytics query;
  // events with no recipientId (manual-paste campaigns) can't be attributed
  // to an address and are excluded rather than undercounted-as-1.
  const [uniqueOpeners, uniqueClickers] = await Promise.all([
    prisma.openEvent.findMany({
      where: { campaignId: id, recipientId: { not: null }, recipient: { isTest: false } },
      distinct: ["recipientId"],
      select: { recipientId: true },
    }),
    prisma.clickEvent.findMany({
      where: { campaignId: id, recipientId: { not: null }, recipient: { isTest: false } },
      distinct: ["recipientId"],
      select: { recipientId: true },
    }),
  ]);

  const stats = computeStats({
    sent: campaign.sentCount,
    rawOpens: campaign._count.opens,
    totalClicks: campaign._count.clicks,
    uniqueOpens: uniqueOpeners.length,
    uniqueClicks: uniqueClickers.length,
  });

  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    openToken: campaign.openToken,
    sentCount: campaign.sentCount,
    createdAt: campaign.createdAt,
    processedHtml: campaign.processedHtml,
    stats,
    perLink,
  };
}
