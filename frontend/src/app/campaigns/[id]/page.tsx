import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCampaign } from "@/lib/backend";
import { Card, Eyebrow, PageHeader, Stat, buttonClassName } from "@/components";
import { ActivityFeed } from "./ActivityFeed";
import { ArchiveCampaign } from "./ArchiveCampaign";
import { CampaignControls } from "./CampaignControls";
import { CampaignEditor } from "./CampaignEditor";
import { DeleteCampaign } from "./DeleteCampaign";
import { EngagementLeaderboard } from "./EngagementLeaderboard";
import { EngagementTimeline } from "./EngagementTimeline";
import { LinksPanel } from "./LinksPanel";
import { RecipientsPanel } from "./RecipientsPanel";
import { RefreshButton } from "./RefreshButton";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function OpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ClickIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="m5 3 4.5 16.5 2.2-6.3 6.3-2.2L5 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function CampaignDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await loadCampaign(id);

  if (!campaign) notFound();

  const { stats } = campaign;

  return (
    <>
      <PageHeader
        eyebrow={
          <Eyebrow muted>
            {campaign.archived ? "Campaign · Archived" : "Campaign"}
          </Eyebrow>
        }
        title={campaign.name}
        subtitle={
          <span className={styles.meta}>
            <span>Created {dateFormatter.format(new Date(campaign.createdAt))}</span>
            {campaign.firstSentAt ? (
              <span>First sent {dateFormatter.format(new Date(campaign.firstSentAt))}</span>
            ) : (
              <span className={styles.draftBadge}>Draft — not sent yet</span>
            )}
            <span>
              Open token <span className={styles.token}>{campaign.openToken}</span>
            </span>
          </span>
        }
        actions={
          <>
            <RefreshButton />
            <Link href="/" className={buttonClassName("secondary")}>
              All campaigns
            </Link>
          </>
        }
      />

      <main className="container section">
        <div className={styles.stack}>
          <Card>
            <div className={styles.metrics}>
              <Stat
                label="Unique opens"
                value={stats.uniqueOpens}
                accent
                hint="Recipients who opened at least once"
              />
              <Stat
                label="Unique clicks"
                value={stats.uniqueClicks}
                hint="Recipients who clicked at least once"
              />
              <Stat
                label="Emails sent"
                value={stats.sent}
                hint="Live count from the platform send"
              />
            </div>
            <div className={styles.rawMetrics}>
              <span className={styles.rawMetricsLabel}>Raw totals, no dedup</span>
              <div className={styles.rawMetricsRow}>
                <span className={styles.rawMetric} data-tone="open">
                  <span className={styles.rawMetricIcon} aria-hidden="true">
                    <OpenIcon />
                  </span>
                  <span className={styles.rawMetricText}>
                    <span className={styles.rawMetricValue}>{stats.rawOpens}</span>
                    <span className={styles.rawMetricLabel}>total opens</span>
                  </span>
                </span>
                <span className={styles.rawMetric} data-tone="click">
                  <span className={styles.rawMetricIcon} aria-hidden="true">
                    <ClickIcon />
                  </span>
                  <span className={styles.rawMetricText}>
                    <span className={styles.rawMetricValue}>{stats.totalClicks}</span>
                    <span className={styles.rawMetricLabel}>total clicks</span>
                  </span>
                </span>
              </div>
            </div>
          </Card>

          <Card
            title="Send via platform"
            description="Sends real email over SMTP, personalized per recipient — every open and click is attributed to who did it."
          >
            <RecipientsPanel campaignId={campaign.id} campaignName={campaign.name} />
          </Card>

          <Card
            title="Latest updates"
            description="Real recipient activity, most recent first. Test sends never appear here."
            actions={
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} aria-hidden="true" />
                Live
              </span>
            }
          >
            <ActivityFeed campaignId={campaign.id} />
          </Card>

          <Card
            title="Opens & clicks"
            description="Raw daily counts, not smoothed — a dashed line marks the day this campaign was first sent."
          >
            <EngagementTimeline campaignId={campaign.id} />
          </Card>

          <Card
            title="Links"
            description="Every rewritten link counts on its own token, ranked by clicks. Click a row to see who clicked it."
          >
            <LinksPanel campaignId={campaign.id} links={campaign.perLink} />
          </Card>

          <Card
            title="Most engaged"
            description="Top 5 recipients by opens + clicks combined. Test sends excluded."
          >
            <EngagementLeaderboard campaignId={campaign.id} />
          </Card>

          <Card
            title="Campaign settings"
            description="Rename it, replace the tracked HTML, or copy/download it for the manual-paste-into-Carbonio fallback."
          >
            <CampaignEditor id={campaign.id} name={campaign.name} subject={campaign.subject} />
            <div className={styles.divider} />
            <CampaignControls
              id={campaign.id}
              name={campaign.name}
              processedHtml={campaign.processedHtml}
            />
            <div className={styles.divider} />
            <ArchiveCampaign id={campaign.id} name={campaign.name} archived={campaign.archived} />
          </Card>

          <Card
            title="Danger zone"
            description="Deletes the campaign and every open/click logged against it. This can't be undone."
          >
            <DeleteCampaign id={campaign.id} name={campaign.name} />
          </Card>

          <p className={styles.note}>
            Opens are approximate — image blocking hides them and Apple Mail
            Privacy pre-loads pixels, inflating the count. Per-link clicks are
            the reliable signal. &ldquo;Unique&rdquo; above counts each
            recipient once regardless of how many times or how many links
            they opened/clicked; the raw totals below it don&rsquo;t dedup at all.
          </p>
        </div>
      </main>
    </>
  );
}
