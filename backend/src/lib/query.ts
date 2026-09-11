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

  const stats = computeStats({
    sent: campaign.sentCount,
    rawOpens: campaign._count.opens,
    totalClicks: campaign._count.clicks,
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
