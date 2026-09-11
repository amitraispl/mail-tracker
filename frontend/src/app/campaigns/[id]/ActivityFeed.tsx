"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./sending.module.css";

interface ActivityItem {
  type: "open" | "click";
  email: string;
  linkLabel: string | null;
  createdAt: string;
}

export interface ActivityFeedProps {
  campaignId: string;
}

function describe(item: ActivityItem): string {
  return item.type === "open"
    ? `${item.email} opened the mail`
    : `${item.email} clicked ${item.linkLabel ?? "a link"}`;
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityFeed({ campaignId }: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await apiFetch(`/api/campaigns/${campaignId}/activity?limit=20`);
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { feed: ActivityItem[] };
      if (!cancelled) {
        setItems(body.feed);
        setLoaded(true);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  if (loaded && items.length === 0) {
    return <p className={styles.emptyFeed}>No activity yet.</p>;
  }

  return (
    <ul className={styles.feed}>
      {items.map((item, i) => (
        <li key={`${item.type}-${item.email}-${item.createdAt}-${i}`} className={styles.feedItem}>
          <span className={styles.feedDot} data-type={item.type} aria-hidden="true" />
          <span>{describe(item)}</span>
          <span className={styles.feedTime}>{relativeTime(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export default ActivityFeed;
