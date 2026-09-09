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
  openToken: string;
  sentCount: number;
  createdAt: Date;
  processedHtml: string | null;
  stats: CampaignStats;
  perLink: PerLinkStats[];
}

export async function loadCampaign(id: string): Promise<CampaignDetail | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      links: {
        orderBy: { id: "asc" },
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
  // stats.rawOpens is raw OpenEvent count — send-load noise correction
  // happens client-side (frontend/src/lib/stats.ts), not here.

  return {
    id: campaign.id,
    name: campaign.name,
    openToken: campaign.openToken,
    sentCount: campaign.sentCount,
    createdAt: campaign.createdAt,
    processedHtml: campaign.processedHtml,
    stats,
    perLink,
  };
}
