import Link from "next/link";
import { loadCampaignList } from "@/lib/backend";
import { displayedOpens } from "@/lib/stats";
import {
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
  buttonClassName,
} from "@/components";
import styles from "./page.module.css";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function Tag({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.tag}>
      <span className={styles.tagValue}>{value}</span>
      {label}
    </span>
  );
}

export default async function HomePage() {
  const campaigns = await loadCampaignList();

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.opens += displayedOpens(c._count.opens, c.sentCount);
      acc.clicks += c._count.clicks;
      acc.sent += c.sentCount;
      return acc;
    },
    { opens: 0, clicks: 0, sent: 0 },
  );

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow muted>Campaigns</Eyebrow>}
        title="Mail Tracker"
        subtitle="Open rate and per-link click-through for HTML email sent from Carbonio."
        actions={
          <>
            <Link href="/campaigns/new" className={buttonClassName("primary")}>
              New campaign
            </Link>
            <Link href="/profile" className={buttonClassName("secondary")}>
              Profile
            </Link>
            <SignOutButton />
          </>
        }
      />

      <main className="container section">
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create a campaign to inject the tracking pixel, rewrite its links, and download the tracked HTML for Carbonio."
            action={
              <Link href="/campaigns/new" className={buttonClassName("primary")}>
                New campaign
              </Link>
            }
          />
        ) : (
          <>
            <p className={styles.summary}>
              <span className="mono tabular">{campaigns.length}</span>{" "}
              {campaigns.length === 1 ? "campaign" : "campaigns"}
              <span className={styles.summaryDivider} aria-hidden="true">
                &middot;
              </span>
              <span className="mono tabular">{totals.opens}</span> opens
              <span className={styles.summaryDivider} aria-hidden="true">
                &middot;
              </span>
              <span className="mono tabular">{totals.clicks}</span> clicks
              <span className={styles.summaryDivider} aria-hidden="true">
                &middot;
              </span>
              <span className="mono tabular">{totals.sent}</span> sent
            </p>
            <div className={styles.list}>
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className={styles.rowLink}
                >
                  <Card className={styles.row}>
                    <div className={styles.rowMain}>
                      <h2 className={styles.name}>{campaign.name}</h2>
                      <p className={styles.meta}>
                        {dateFormatter.format(new Date(campaign.createdAt))} &middot;{" "}
                        {campaign._count.links}{" "}
                        {campaign._count.links === 1 ? "link" : "links"}
                      </p>
                    </div>
                    <div className={styles.tags}>
                      <Tag
                        label="opens"
                        value={displayedOpens(campaign._count.opens, campaign.sentCount)}
                      />
                      <Tag label="clicks" value={campaign._count.clicks} />
                      <Tag label="sent" value={campaign.sentCount} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
