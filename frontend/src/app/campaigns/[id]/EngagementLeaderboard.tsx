"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { RecipientDetailModal } from "./RecipientDetailModal";
import { CAMPAIGN_REFRESH_EVENT } from "./refreshEvent";
import styles from "./dashboard.module.css";

interface RecipientRow {
  id: string;
  email: string;
  name: string | null;
  isTest: boolean;
  openCount: number;
  clickCount: number;
}

export interface EngagementLeaderboardProps {
  campaignId: string;
}

const TOP_N = 5;

export function EngagementLeaderboard({ campaignId }: EngagementLeaderboardProps) {
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openRecipientId, setOpenRecipientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/campaigns/${campaignId}/recipients`);
    if (!res.ok) return;
    const body = (await res.json()) as { recipients: RecipientRow[] };
    setRecipients(body.recipients);
    setLoaded(true);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener(CAMPAIGN_REFRESH_EVENT, load);
    return () => window.removeEventListener(CAMPAIGN_REFRESH_EVENT, load);
  }, [load]);

  const ranked = useMemo(() => {
    return recipients
      .filter((r) => !r.isTest && r.openCount + r.clickCount > 0)
      .sort((a, b) => b.openCount + b.clickCount - (a.openCount + a.clickCount))
      .slice(0, TOP_N);
  }, [recipients]);

  const maxScore = ranked.reduce((max, r) => Math.max(max, r.openCount + r.clickCount), 0);

  if (loaded && ranked.length === 0) {
    return <p className={styles.leaderboardEmpty}>No engagement yet — this fills in as recipients open and click.</p>;
  }

  return (
    <div className={styles.leaderboardList}>
      {ranked.map((r, i) => {
        const score = r.openCount + r.clickCount;
        return (
          <button
            key={r.id}
            type="button"
            className={styles.leaderboardRow}
            onClick={() => setOpenRecipientId(r.id)}
          >
            <span className={styles.leaderboardRank}>#{i + 1}</span>
            <span className={styles.leaderboardIdentity}>
              <span className={styles.leaderboardPrimary}>{r.name || r.email}</span>
              {r.name && <span className={styles.leaderboardSecondary}>{r.email}</span>}
            </span>
            <span className={styles.clickCell}>
              <span className={styles.leaderboardCounts}>
                {r.openCount} open{r.openCount === 1 ? "" : "s"} · {r.clickCount} click
                {r.clickCount === 1 ? "" : "s"}
              </span>
              <span className={styles.clickTrack} aria-hidden="true">
                <span
                  className={styles.clickBar}
                  style={{ width: maxScore > 0 ? `${(score / maxScore) * 100}%` : "0%" }}
                />
              </span>
            </span>
          </button>
        );
      })}

      {openRecipientId && (
        <RecipientDetailModal
          campaignId={campaignId}
          recipientId={openRecipientId}
          onClose={() => setOpenRecipientId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

export default EngagementLeaderboard;
