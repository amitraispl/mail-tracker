import Link from "next/link";
import { Suspense } from "react";
import { loadCampaignList } from "@/lib/backend";
import {
  Card,
  EmptyState,
  Eyebrow,
  PageHeader,
  buttonClassName,
} from "@/components";
import { CampaignRowArchiveToggle } from "./CampaignRowArchiveToggle";
import { CampaignsToolbar } from "./CampaignsToolbar";
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q, view } = await searchParams;
  const archived = view === "archived";
  const search = q?.trim() || undefined;
  const campaigns = await loadCampaignList({ search, archived });

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.opens += c._count.opens;
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
        <Suspense fallback={null}>
          <CampaignsToolbar />
        </Suspense>

        {campaigns.length === 0 ? (
          <EmptyState
            title={
              search
                ? "No matches"
                : archived
                  ? "No archived campaigns"
                  : "No campaigns yet"
            }
            description={
              search
                ? `Nothing in ${archived ? "the archive" : "your campaigns"} matches "${search}".`
                : archived
                  ? "Campaigns you archive stay here, fully intact, until you restore them."
                  : "Create a campaign to inject the tracking pixel, rewrite its links, and download the tracked HTML for Carbonio."
            }
            action={
              !search && !archived ? (
                <Link href="/campaigns/new" className={buttonClassName("primary")}>
                  New campaign
                </Link>
              ) : undefined
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
                <Card key={campaign.id} className={styles.row}>
                  <Link href={`/campaigns/${campaign.id}`} className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <h2 className={styles.name}>{campaign.name}</h2>
                      <p className={styles.meta}>
                        {dateFormatter.format(new Date(campaign.createdAt))} &middot;{" "}
                        {campaign._count.links}{" "}
                        {campaign._count.links === 1 ? "link" : "links"}
                        {campaign.subject && (
                          <>
                            {" "}
                            &middot; <span className={styles.subject}>{campaign.subject}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className={styles.tags}>
                      <Tag label="opens" value={campaign._count.opens} />
                      <Tag label="clicks" value={campaign._count.clicks} />
                      <Tag label="sent" value={campaign.sentCount} />
                    </div>
                  </Link>
                  <CampaignRowArchiveToggle id={campaign.id} archived={campaign.archived} />
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
