import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCampaign, type PerLinkStats } from "@/lib/query";
import {
  Card,
  DataTable,
  Eyebrow,
  PageHeader,
  Stat,
  buttonClassName,
  type Column,
} from "@/components";
import { CampaignControls } from "./CampaignControls";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const columns: Column<PerLinkStats>[] = [
  {
    key: "label",
    header: "Link",
    cell: (link) => (
      <span className={styles.linkLabel}>{link.label ?? "Untitled link"}</span>
    ),
  },
  {
    key: "url",
    header: "Original URL",
    cell: (link) => (
      <a
        className={styles.url}
        href={link.originalUrl}
        title={link.originalUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        {link.originalUrl}
      </a>
    ),
    mono: true,
  },
  {
    key: "uniqueClicks",
    header: "Unique clicks",
    cell: (link) => link.uniqueClicks,
    align: "right",
    mono: true,
    width: "140px",
  },
  {
    key: "totalClicks",
    header: "Total clicks",
    cell: (link) => link.totalClicks,
    align: "right",
    mono: true,
    width: "130px",
  },
];

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
        eyebrow={<Eyebrow muted>Campaign</Eyebrow>}
        title={campaign.name}
        subtitle={
          <span className={styles.meta}>
            <span>Created {dateFormatter.format(campaign.createdAt)}</span>
            <span>
              Open token <span className={styles.token}>{campaign.openToken}</span>
            </span>
          </span>
        }
        actions={
          <Link href="/" className={buttonClassName("secondary")}>
            All campaigns
          </Link>
        }
      />

      <main className="container section">
        <div className={styles.stack}>
          <Card>
            <div className={styles.metrics}>
              <Stat
                label="Open rate"
                value={stats.openRate.toFixed(2)}
                suffix="%"
                accent
                hint={`${stats.uniqueOpens} unique of ${stats.sent} sent`}
              />
              <Stat
                label="Click-through rate"
                value={stats.clickRate.toFixed(2)}
                suffix="%"
                hint={`${stats.uniqueClicks} unique of ${stats.sent} sent`}
              />
              <Stat
                label="Click-to-open rate"
                value={stats.clickToOpenRate.toFixed(2)}
                suffix="%"
                hint="Unique clicks of unique opens"
              />
              <Stat
                label="Emails sent"
                value={stats.sent}
                hint="Entered manually"
              />
            </div>

            <div className={styles.counts}>
              <div className={styles.count}>
                <span className={styles.countValue}>{stats.uniqueOpens}</span>
                <span className={styles.countLabel}>Unique opens</span>
              </div>
              <div className={styles.count}>
                <span className={styles.countValue}>{stats.totalOpens}</span>
                <span className={styles.countLabel}>Total opens</span>
              </div>
              <div className={styles.count}>
                <span className={styles.countValue}>{stats.uniqueClicks}</span>
                <span className={styles.countLabel}>Unique clicks</span>
              </div>
              <div className={styles.count}>
                <span className={styles.countValue}>{stats.totalClicks}</span>
                <span className={styles.countLabel}>Total clicks</span>
              </div>
            </div>
          </Card>

          <Card
            title="Links"
            description="Every rewritten link counts on its own token."
            flush
          >
            <DataTable
              columns={columns}
              rows={campaign.perLink}
              rowKey={(link) => link.id}
              empty="No trackable links were found in this email."
            />
          </Card>

          <Card
            title="Campaign settings"
            description="The send count drives every rate — update it once you know what Carbonio actually sent."
          >
            <CampaignControls
              id={campaign.id}
              name={campaign.name}
              sentCount={campaign.sentCount}
              processedHtml={campaign.processedHtml}
            />
          </Card>

          <p className={styles.note}>
            Open rate is approximate — image blocking hides opens and Apple Mail
            Privacy pre-loads pixels, inflating them. Per-link clicks are the
            reliable signal.
          </p>
        </div>
      </main>
    </>
  );
}
