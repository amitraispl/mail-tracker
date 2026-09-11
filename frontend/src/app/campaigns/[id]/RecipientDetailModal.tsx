"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./sending.module.css";

interface OpenEventItem {
  createdAt: string;
}

interface ClickEventItem {
  createdAt: string;
  linkLabel: string | null;
  linkUrl: string;
}

interface RecipientDetail {
  id: string;
  email: string;
  status: "pending" | "sending" | "sent" | "failed";
  error: string | null;
  sentAt: string | null;
  opens: OpenEventItem[];
  clicks: ClickEventItem[];
}

export interface RecipientDetailModalProps {
  campaignId: string;
  recipientId: string;
  onClose: () => void;
}

const statusLabel: Record<RecipientDetail["status"], string> = {
  pending: "Pending",
  sending: "Sending…",
  sent: "Sent",
  failed: "Failed",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function RecipientDetailModal({
  campaignId,
  recipientId,
  onClose,
}: RecipientDetailModalProps) {
  const [detail, setDetail] = useState<RecipientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await apiFetch(`/api/campaigns/${campaignId}/recipients/${recipientId}`);
      if (cancelled) return;
      if (!res.ok) {
        setError(`Could not load recipient details (${res.status}).`);
        return;
      }
      setDetail(await res.json());
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, recipientId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Recipient details"
        onClick={(e) => e.stopPropagation()}
      >
        {error && <p className={styles.statusError}>{error}</p>}
        {!error && !detail && <p>Loading…</p>}
        {detail && (
          <>
            <div className={styles.modalHead}>
              <div>
                <p className={styles.modalEmail}>{detail.email}</p>
                <span className={styles.statusBadge} data-status={detail.status}>
                  {statusLabel[detail.status]}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {detail.sentAt && (
              <p className={styles.modalSectionTitle}>Sent at {formatTime(detail.sentAt)}</p>
            )}
            {detail.error && (
              <p className={[styles.statusError, styles.modalSection].join(" ")} role="alert">
                {detail.error}
              </p>
            )}

            <div className={styles.modalSection}>
              <p className={styles.modalSectionTitle}>
                Opened {detail.opens.length}×
              </p>
              {detail.opens.length > 0 && (
                <ul className={styles.eventList}>
                  {detail.opens.map((o, i) => (
                    <li key={i} className={styles.eventRow}>
                      <span className={styles.eventLabel}>Open</span>
                      <span className={styles.eventTime}>{formatTime(o.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.modalSection}>
              <p className={styles.modalSectionTitle}>
                Clicked {detail.clicks.length}×
              </p>
              {detail.clicks.length > 0 && (
                <ul className={styles.eventList}>
                  {detail.clicks.map((c, i) => (
                    <li key={i} className={styles.eventRow}>
                      <span className={styles.eventLabel} title={c.linkUrl}>
                        {c.linkLabel ?? "Untitled link"}
                      </span>
                      <span className={styles.eventTime}>{formatTime(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RecipientDetailModal;
