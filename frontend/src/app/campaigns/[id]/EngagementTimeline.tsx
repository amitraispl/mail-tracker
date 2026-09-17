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

const RANGES = [
  { key: "30d", label: "30 days", empty: "No activity yet in the last 30 days." },
  { key: "3m", label: "3 months", empty: "No activity yet in the last 3 months." },
  { key: "1y", label: "1 year", empty: "No activity yet in the last year." },
  { key: "max", label: "Max", empty: "No activity yet." },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function EngagementTimeline({ campaignId }: EngagementTimelineProps) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<TimelineResponse | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/campaigns/${campaignId}/timeline?range=${range}`);
    if (!res.ok) return;
    setData(await res.json());
  }, [campaignId, range]);

  useEffect(() => {
    setData(null);
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    window.addEventListener(CAMPAIGN_REFRESH_EVENT, load);
    return () => window.removeEventListener(CAMPAIGN_REFRESH_EVENT, load);
  }, [load]);

  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[0];

  const rangePicker = (
    <div className={styles.timelineRangeRow}>
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          className={styles.timelineRangeBtn}
          data-active={r.key === range}
          onClick={() => setRange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (!data) {
    return <div className={styles.timelineWrap}>{rangePicker}</div>;
  }

  const { days } = data;
  const maxValue = days.reduce((max, d) => Math.max(max, d.opens, d.clicks), 0);
  const hasActivity = maxValue > 0;
  const sentDate = data.firstSentAt ? data.firstSentAt.slice(0, 10) : null;
  const sentIndex = sentDate ? days.findIndex((d) => d.date === sentDate) : -1;

  const width = days.length * BAR_GROUP_WIDTH;
  // Cap the number of axis labels regardless of range — with a year's worth
  // of days the bars themselves get thin, but labels stay readable HTML text
  // (see below) rather than SVG glyphs squashed by preserveAspectRatio="none".
  const maxLabels = 7;
  const labelEvery = Math.max(1, Math.ceil(days.length / maxLabels));
  const labelDays = days
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % labelEvery === 0 || i === days.length - 1);

  if (!hasActivity) {
    return (
      <div className={styles.timelineWrap}>
        {rangePicker}
        <div className={styles.timelineEmpty}>{activeRange.empty}</div>
      </div>
    );
  }

  return (
    <div className={styles.timelineWrap}>
      {rangePicker}
      <div className={styles.timelineChartArea}>
        <svg
          className={styles.timelineSvg}
          viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Opens and clicks per day, last ${activeRange.label}`}
        >
          {sentIndex >= 0 && (
            <line
              x1={sentIndex * BAR_GROUP_WIDTH + BAR_GROUP_WIDTH / 2}
              x2={sentIndex * BAR_GROUP_WIDTH + BAR_GROUP_WIDTH / 2}
              y1={0}
              y2={CHART_HEIGHT}
              vectorEffect="non-scaling-stroke"
              className={styles.timelineSentLine}
            />
          )}
          {days.map((d, i) => {
            const x = i * BAR_GROUP_WIDTH;
            const openHeight = maxValue > 0 ? (d.opens / maxValue) * (CHART_HEIGHT - 4) : 0;
            const clickHeight = maxValue > 0 ? (d.clicks / maxValue) * (CHART_HEIGHT - 4) : 0;
            return (
              <g key={d.date}>
                <rect
                  x={x + BAR_GROUP_WIDTH / 2 - BAR_WIDTH - BAR_GAP / 2}
                  y={CHART_HEIGHT - openHeight}
                  width={BAR_WIDTH}
                  height={Math.max(openHeight, d.opens > 0 ? 1 : 0)}
                  rx={1.5}
                  className={styles.timelineBarOpen}
                >
                  <title>{`${shortDate(d.date)} — ${d.opens} open${d.opens === 1 ? "" : "s"}`}</title>
                </rect>
                <rect
                  x={x + BAR_GROUP_WIDTH / 2 + BAR_GAP / 2}
                  y={CHART_HEIGHT - clickHeight}
                  width={BAR_WIDTH}
                  height={Math.max(clickHeight, d.clicks > 0 ? 1 : 0)}
                  rx={1.5}
                  className={styles.timelineBarClick}
                >
                  <title>{`${shortDate(d.date)} — ${d.clicks} click${d.clicks === 1 ? "" : "s"}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Real HTML text, positioned by percentage — kept out of the SVG
       *  viewBox so long ranges (1y/max) don't squash glyphs into
       *  unreadable slivers the way scaling an SVG <text> would. */}
      <div className={styles.timelineLabels} aria-hidden="true">
        {labelDays.map(({ d, i }) => {
          const isFirst = i === 0;
          const isLast = i === days.length - 1;
          const leftPercent = isFirst ? 0 : isLast ? 100 : ((i + 0.5) / days.length) * 100;
          const transform = isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)";
          return (
            <span
              key={d.date}
              className={styles.timelineLabel}
              style={{ left: `${leftPercent}%`, transform }}
            >
              {shortDate(d.date)}
            </span>
          );
        })}
      </div>

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
