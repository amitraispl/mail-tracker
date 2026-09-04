import { prisma } from "@/lib/db";
import { computeStats, type CampaignStats } from "@/lib/stats";

export interface PerLinkStats {
  id: string;
  label: string | null;
  originalUrl: string;
  totalClicks: number;
  uniqueClicks: number;
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

interface Actor {
  recipientRef: string | null;
  ip: string | null;
  userAgent: string | null;
}

/** "Unique" = distinct recipientRef when present, else distinct `ip|userAgent`. */
function actorKey(e: Actor): string {
  if (e.recipientRef) return `r:${e.recipientRef}`;
  return `f:${e.ip ?? ""}|${e.userAgent ?? ""}`;
}

const countUnique = (events: Actor[]): number =>
  new Set(events.map(actorKey)).size;

export async function loadCampaign(id: string): Promise<CampaignDetail | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      links: { orderBy: { id: "asc" } },
      opens: true,
      clicks: true,
    },
  });

  if (!campaign) return null;

  const clicksByLink = new Map<string, Actor[]>();
  for (const click of campaign.clicks) {
    const bucket = clicksByLink.get(click.linkId);
    if (bucket) bucket.push(click);
    else clicksByLink.set(click.linkId, [click]);
  }

  const perLink: PerLinkStats[] = campaign.links.map((link) => {
    const clicks = clicksByLink.get(link.id) ?? [];
    return {
      id: link.id,
      label: link.label,
      originalUrl: link.originalUrl,
      totalClicks: clicks.length,
      uniqueClicks: countUnique(clicks),
    };
  });

  const stats = computeStats({
    sent: campaign.sentCount,
    totalOpens: campaign.opens.length,
    uniqueOpens: countUnique(campaign.opens),
    totalClicks: campaign.clicks.length,
    uniqueClicks: countUnique(campaign.clicks),
  });

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
