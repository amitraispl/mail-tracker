import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCampaign, type PerLinkStats } from "@/lib/backend";
import {
  Card,
  DataTable,
  Eyebrow,
  PageHeader,
  Stat,
  buttonClassName,
  type Column,
} from "@/components";
import { ActivityFeed } from "./ActivityFeed";
import { CampaignControls } from "./CampaignControls";
import { CampaignEditor } from "./CampaignEditor";
import { DeleteCampaign } from "./DeleteCampaign";
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

function linkColumns(maxClicks: number): Column<PerLinkStats>[] {
  return [
    {
      key: "label",
      header: "Link",
      cell: (link, index) => (
        <span className={styles.linkLabel}>
          {link.label ?? "Untitled link"}
          {index === 0 && link.totalClicks > 0 && (
            <span className={styles.mostClickedBadge}>Most clicked</span>
          )}
        </span>
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
      key: "totalClicks",
      header: "Clicks",
      cell: (link) => (
        <span className={styles.clickCell}>
          <span
            className={styles.clickBar}
            style={{ width: maxClicks > 0 ? `${(link.totalClicks / maxClicks) * 100}%` : "0%" }}
            aria-hidden="true"
          />
          <span className={styles.clickValue}>{link.totalClicks}</span>
        </span>
      ),
      align: "right",
      mono: true,
      width: "140px",
    },
  ];
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
  const maxClicks = campaign.perLink.reduce((max, l) => Math.max(max, l.totalClicks), 0);

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow muted>Campaign</Eyebrow>}
        title={campaign.name}
        subtitle={
          <span className={styles.meta}>
            <span>Created {dateFormatter.format(new Date(campaign.createdAt))}</span>
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
                label="Total opens"
                value={stats.rawOpens}
                accent
                hint="No dedup"
              />
              <Stat
                label="Total clicks"
                value={stats.totalClicks}
                hint="Every link hit, no dedup"
              />
              <Stat
                label="Emails sent"
                value={stats.sent}
                hint="Live count from the platform send"
              />
            </div>
          </Card>

          <Card
            title="Send via platform"
            description="Sends real email over SMTP, personalized per recipient — every open and click is attributed to who did it."
          >
            <RecipientsPanel campaignId={campaign.id} />
          </Card>

          <Card
            title="Latest updates"
            description="Real recipient activity, most recent first. Test sends never appear here."
          >
            <ActivityFeed campaignId={campaign.id} />
          </Card>

          <Card
            title="Links"
            description="Every rewritten link counts on its own token, ranked by clicks."
          >
            <DataTable
              columns={linkColumns(maxClicks)}
              rows={campaign.perLink}
              rowKey={(link) => link.id}
              empty="No trackable links were found in this email."
            />
          </Card>

          <Card
            title="Campaign settings"
            description="Copy or download the tracked HTML for the manual-paste-into-Carbonio fallback."
          >
            <CampaignControls
              id={campaign.id}
              name={campaign.name}
              processedHtml={campaign.processedHtml}
            />
          </Card>

          <Card
            title="Edit campaign"
            description="Rename the campaign, or replace its HTML and regenerate every link token."
          >
            <CampaignEditor id={campaign.id} name={campaign.name} subject={campaign.subject} />
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
            the reliable signal. Numbers here are raw totals: no unique/dedup
            counting.
          </p>
        </div>
      </main>
    </>
  );
}
