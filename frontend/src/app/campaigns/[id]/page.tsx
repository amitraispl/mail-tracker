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
import { CampaignControls } from "./CampaignControls";
import { CampaignEditor } from "./CampaignEditor";
import { DeleteCampaign } from "./DeleteCampaign";
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
    key: "totalClicks",
    header: "Clicks",
    cell: (link) => link.totalClicks,
    align: "right",
    mono: true,
    width: "110px",
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
            <span>Created {dateFormatter.format(new Date(campaign.createdAt))}</span>
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
                label="Total opens"
                value={stats.totalOpens}
                accent
                hint="Every pixel hit, no dedup"
              />
              <Stat
                label="Total clicks"
                value={stats.totalClicks}
                hint="Every link hit, no dedup"
              />
              <Stat
                label="Emails sent"
                value={stats.sent}
                hint="Entered manually"
              />
            </div>
          </Card>

          <Card
            title="Links"
            description="Every rewritten link counts on its own token."
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
            description="Update the send count once you know what Carbonio actually sent."
          >
            <CampaignControls
              id={campaign.id}
              name={campaign.name}
              sentCount={campaign.sentCount}
              processedHtml={campaign.processedHtml}
            />
          </Card>

          <Card
            title="Edit campaign"
            description="Rename the campaign, or replace its HTML and regenerate every link token."
          >
            <CampaignEditor id={campaign.id} name={campaign.name} />
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
