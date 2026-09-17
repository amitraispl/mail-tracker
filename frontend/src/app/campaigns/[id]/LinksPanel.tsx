"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components";
import type { PerLinkStats } from "@/lib/backend";
import { LinkClickersModal } from "./LinkClickersModal";
import styles from "./dashboard.module.css";

export interface LinksPanelProps {
  campaignId: string;
  links: PerLinkStats[];
}

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
          onClick={(e) => e.stopPropagation()}
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
          <span className={styles.clickValue}>{link.totalClicks}</span>
          <span className={styles.clickTrack} aria-hidden="true">
            <span
              className={styles.clickBar}
              style={{ width: maxClicks > 0 ? `${(link.totalClicks / maxClicks) * 100}%` : "0%" }}
            />
          </span>
          <span className={styles.uniqueClicksNote}>{link.uniqueClicks} people</span>
        </span>
      ),
      align: "right",
      mono: true,
      width: "140px",
    },
  ];
}

export function LinksPanel({ campaignId, links }: LinksPanelProps) {
  const [openLinkId, setOpenLinkId] = useState<string | null>(null);
  const maxClicks = links.reduce((max, l) => Math.max(max, l.totalClicks), 0);

  return (
    <>
      <DataTable
        columns={linkColumns(maxClicks)}
        rows={links}
        rowKey={(link) => link.id}
        empty="No trackable links were found in this email."
        onRowClick={(link) => setOpenLinkId(link.id)}
      />

      {openLinkId && (
        <LinkClickersModal
          campaignId={campaignId}
          linkId={openLinkId}
          onClose={() => setOpenLinkId(null)}
        />
      )}
    </>
  );
}

export default LinksPanel;
