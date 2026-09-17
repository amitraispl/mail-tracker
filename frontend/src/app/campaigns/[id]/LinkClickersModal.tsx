"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./sending.module.css";

interface Clicker {
  recipientId: string;
  email: string;
  name: string | null;
  clickCount: number;
  firstClickAt: string;
  lastClickAt: string;
}

interface LinkClickersResponse {
  link: { id: string; label: string | null; originalUrl: string };
  clickers: Clicker[];
}

export interface LinkClickersModalProps {
  campaignId: string;
  linkId: string;
  onClose: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function LinkClickersModal({ campaignId, linkId, onClose }: LinkClickersModalProps) {
  const [data, setData] = useState<LinkClickersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await apiFetch(`/api/campaigns/${campaignId}/links/${linkId}/clickers`);
      if (cancelled) return;
      if (!res.ok) {
        setError(`Could not load clickers (${res.status}).`);
        return;
      }
      setData(await res.json());
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, linkId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Link clickers"
        onClick={(e) => e.stopPropagation()}
      >
        {error && <p className={styles.statusError}>{error}</p>}
        {!error && !data && <p>Loading…</p>}
        {data && (
          <>
            <div className={styles.modalHead}>
              <div>
                <p className={styles.modalEmail}>{data.link.label ?? "Untitled link"}</p>
                <a
                  className={styles.eventLabel}
                  href={data.link.originalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={data.link.originalUrl}
                >
                  {data.link.originalUrl}
                </a>
              </div>
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            <div className={styles.modalStats}>
              <div className={styles.modalStatItem}>
                <span className={styles.modalStatValue}>{data.clickers.length}</span>
                <span className={styles.modalStatLabel}>People clicked</span>
              </div>
              <div className={styles.modalStatItem}>
                <span className={styles.modalStatValue}>
                  {data.clickers.reduce((sum, c) => sum + c.clickCount, 0)}
                </span>
                <span className={styles.modalStatLabel}>Total clicks</span>
              </div>
            </div>

            <div className={styles.modalSection}>
              <p className={styles.modalSectionTitle}>Recipients</p>
              {data.clickers.length > 0 ? (
                <ul className={styles.eventList}>
                  {data.clickers.map((c) => (
                    <li key={c.recipientId} className={styles.eventRow}>
                      <span className={styles.eventLabel}>
                        {c.name || c.email}
                        {c.clickCount > 1 && ` · ${c.clickCount} clicks`}
                      </span>
                      <span className={styles.eventTime}>{formatTime(c.lastClickAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.modalEmpty}>No one has clicked this link yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LinkClickersModal;
