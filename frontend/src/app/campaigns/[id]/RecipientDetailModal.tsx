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
  /** Called after a send/resend/remove so the parent list + delivery-health
   *  strip catch up without waiting for the next poll tick. */
  onChanged: () => void;
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

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RecipientDetailModal({
  campaignId,
  recipientId,
  onClose,
  onChanged,
}: RecipientDetailModalProps) {
  const [detail, setDetail] = useState<RecipientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadDetail() {
    const res = await apiFetch(`/api/campaigns/${campaignId}/recipients/${recipientId}`);
    if (!res.ok) {
      setError(`Could not load recipient details (${res.status}).`);
      return;
    }
    setDetail(await res.json());
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, recipientId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copyEmail() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setActionError("Could not copy — your browser blocked clipboard access.");
    }
  }

  async function sendOrResend() {
    setActionError(null);
    setSending(true);
    try {
      const res = await apiFetch(
        `/api/campaigns/${campaignId}/recipients/${recipientId}/send`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `Send failed (${res.status}).`);
      await loadDetail();
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    setActionError(null);
    setRemoving(true);
    try {
      const res = await apiFetch(
        `/api/campaigns/${campaignId}/recipients/${recipientId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Could not remove that recipient (${res.status}).`);
      onChanged();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not remove recipient.");
      setRemoving(false);
    }
  }

  const busy = sending || removing;

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
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
                <p className={styles.modalEmail}>
                  {detail.email}
                  <button
                    type="button"
                    className={styles.modalCopyButton}
                    onClick={copyEmail}
                    aria-label="Copy email address"
                    title={copied ? "Copied!" : "Copy email"}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </p>
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
                      <a
                        className={styles.eventLabel}
                        href={c.linkUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={c.linkUrl}
                      >
                        {c.linkLabel ?? "Untitled link"}
                      </a>
                      <span className={styles.eventTime}>{formatTime(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {actionError && (
              <p className={[styles.statusError, styles.modalSection].join(" ")} role="alert">
                {actionError}
              </p>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalActionPrimary}
                onClick={sendOrResend}
                disabled={busy || detail.status === "sending"}
              >
                {sending
                  ? "Sending…"
                  : detail.status === "pending"
                    ? "Send now"
                    : "Resend"}
              </button>
              <button
                type="button"
                className={styles.modalActionDanger}
                onClick={remove}
                disabled={busy}
              >
                {removing ? "Removing…" : "Remove recipient"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RecipientDetailModal;
