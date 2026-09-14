"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CAMPAIGN_REFRESH_EVENT } from "./refreshEvent";
import styles from "./dashboard.module.css";

interface DayBucket {
  date: string;
  opens: number;
  clicks: number;
}

interface TimelineResponse {
  days: DayBucket[];
  firstSentAt: string | null;
}

export interface EngagementTimelineProps {
  campaignId: string;
}

const CHART_HEIGHT = 140;
const BAR_GROUP_WIDTH = 18;
const BAR_WIDTH = 6;
const BAR_GAP = 2;

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function EngagementTimeline({ campaignId }: EngagementTimelineProps) {
  const [data, setData] = useState<TimelineResponse | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/campaigns/${campaignId}/timeline`);
    if (!res.ok) return;
    setData(await res.json());
  }, [campaignId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    window.addEventListener(CAMPAIGN_REFRESH_EVENT, load);
    return () => window.removeEventListener(CAMPAIGN_REFRESH_EVENT, load);
  }, [load]);

  if (!data) return null;

  const { days } = data;
  const maxValue = days.reduce((max, d) => Math.max(max, d.opens, d.clicks), 0);
  const hasActivity = maxValue > 0;
  const sentDate = data.firstSentAt ? data.firstSentAt.slice(0, 10) : null;
  const sentIndex = sentDate ? days.findIndex((d) => d.date === sentDate) : -1;

  const width = days.length * BAR_GROUP_WIDTH;
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));

  if (!hasActivity) {
    return (
      <div className={styles.timelineEmpty}>
        No activity yet in the last 30 days.
      </div>
    );
  }

  return (
    <div className={styles.timelineWrap}>
      <svg
        className={styles.timelineSvg}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Opens and clicks per day, last 30 days"
      >
        {sentIndex >= 0 && (
          <line
            x1={sentIndex * BAR_GROUP_WIDTH + BAR_GROUP_WIDTH / 2}
            x2={sentIndex * BAR_GROUP_WIDTH + BAR_GROUP_WIDTH / 2}
            y1={0}
            y2={CHART_HEIGHT - 16}
            className={styles.timelineSentLine}
          />
        )}
        {days.map((d, i) => {
          const x = i * BAR_GROUP_WIDTH;
          const openHeight = maxValue > 0 ? (d.opens / maxValue) * (CHART_HEIGHT - 20) : 0;
          const clickHeight = maxValue > 0 ? (d.clicks / maxValue) * (CHART_HEIGHT - 20) : 0;
          return (
            <g key={d.date}>
              <rect
                x={x + BAR_GROUP_WIDTH / 2 - BAR_WIDTH - BAR_GAP / 2}
                y={CHART_HEIGHT - 16 - openHeight}
                width={BAR_WIDTH}
                height={Math.max(openHeight, d.opens > 0 ? 1 : 0)}
                rx={1.5}
                className={styles.timelineBarOpen}
              >
                <title>{`${shortDate(d.date)} — ${d.opens} open${d.opens === 1 ? "" : "s"}`}</title>
              </rect>
              <rect
                x={x + BAR_GROUP_WIDTH / 2 + BAR_GAP / 2}
                y={CHART_HEIGHT - 16 - clickHeight}
                width={BAR_WIDTH}
                height={Math.max(clickHeight, d.clicks > 0 ? 1 : 0)}
                rx={1.5}
                className={styles.timelineBarClick}
              >
                <title>{`${shortDate(d.date)} — ${d.clicks} click${d.clicks === 1 ? "" : "s"}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text
                  x={x + BAR_GROUP_WIDTH / 2}
                  y={CHART_HEIGHT - 2}
                  textAnchor="middle"
                  className={styles.timelineAxisLabel}
                >
                  {shortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className={styles.timelineLegend}>
        <span className={styles.timelineLegendItem}>
          <span className={[styles.timelineLegendDot, styles.timelineLegendDotOpen].join(" ")} />
          Opens
        </span>
        <span className={styles.timelineLegendItem}>
          <span className={[styles.timelineLegendDot, styles.timelineLegendDotClick].join(" ")} />
          Clicks
        </span>
        {sentIndex >= 0 && (
          <span className={styles.timelineLegendItem}>
            <span className={styles.timelineLegendSentMark} />
            Sent
          </span>
        )}
      </div>
    </div>
  );
}

export default EngagementTimeline;
