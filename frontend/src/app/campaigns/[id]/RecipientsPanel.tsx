"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, DataTable, type Column } from "@/components";
import { apiFetch } from "@/lib/api";
import { EmailTagInput } from "./EmailTagInput";
import { RecipientDetailModal } from "./RecipientDetailModal";
import styles from "./sending.module.css";

interface ClickedLink {
  label: string | null;
  count: number;
}

interface RecipientRow {
  id: string;
  email: string;
  status: "pending" | "sending" | "sent" | "failed";
  error: string | null;
  isTest: boolean;
  sentAt: string | null;
  openCount: number;
  firstOpenAt: string | null;
  clickCount: number;
  clickedLinks: ClickedLink[];
}

interface Summary {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
}

export interface RecipientsPanelProps {
  campaignId: string;
}

const statusLabel: Record<RecipientRow["status"], string> = {
  pending: "Pending",
  sending: "Sending…",
  sent: "Sent",
  failed: "Failed",
};

export function RecipientsPanel({ campaignId }: RecipientsPanelProps) {
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [emailTags, setEmailTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [openRecipientId, setOpenRecipientId] = useState<string | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/campaigns/${campaignId}/recipients`);
    if (!res.ok) return;
    const body = (await res.json()) as { recipients: RecipientRow[]; summary: Summary };
    setRecipients(body.recipients);
    setSummary(body.summary);
    setLoaded(true);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is actively sending, so the status table and
  // delivery-health strip catch up without a manual refresh.
  useEffect(() => {
    const active = summary.pending > 0 || summary.sending > 0;
    if (!active) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(load, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [summary.pending, summary.sending, load]);

  async function upload() {
    setError(null);
    setStatus(null);
    if (emailTags.length === 0) {
      setError("Add at least one email address.");
      return;
    }
    setUploading(true);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailTags.join("\n") }),
      });
      const body = (await res.json().catch(() => null)) as {
        created?: number;
        skipped?: number;
        invalid?: string[];
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `Could not add recipients (${res.status}).`);
      }
      const parts = [`${body?.created ?? 0} added`];
      if (body?.skipped) parts.push(`${body.skipped} already on the list`);
      if (body?.invalid?.length) parts.push(`${body.invalid.length} skipped (invalid)`);
      setStatus(parts.join(", ") + ".");
      setEmailTags([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add recipients.");
    } finally {
      setUploading(false);
    }
  }

  async function removeRecipient(id: string) {
    setError(null);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/recipients/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Could not remove that recipient (${res.status}).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove recipient.");
    }
  }

  async function sendTest() {
    setError(null);
    setStatus(null);
    setTestSending(true);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/send-test`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `Test send failed (${res.status}).`);
      setStatus("Test email sent to your own account — check the Test send panel below.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed.");
    } finally {
      setTestSending(false);
    }
  }

  async function sendOne(recipientId: string) {
    setError(null);
    setStatus(null);
    setSendingIds((prev) => new Set(prev).add(recipientId));
    try {
      const res = await apiFetch(
        `/api/campaigns/${campaignId}/recipients/${recipientId}/send`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `Send failed (${res.status}).`);
      setStatus("Sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
    }
  }

  async function sendNow() {
    setError(null);
    setStatus(null);
    setSending(true);
    setConfirmingSend(false);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        queued?: number;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error ?? `Could not start sending (${res.status}).`);
      setStatus(`Sending to ${body?.queued ?? 0} recipients — this page will update live.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start sending.");
    } finally {
      setSending(false);
    }
  }

  const realRows = recipients.filter((r) => !r.isTest);
  const testRow = recipients.find((r) => r.isTest) ?? null;

  const columns: Column<RecipientRow>[] = [
    {
      key: "email",
      header: "Email",
      cell: (r) => (
        <button
          type="button"
          className={styles.emailLink}
          onClick={() => setOpenRecipientId(r.id)}
        >
          {r.email}
        </button>
      ),
      mono: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span className={r.status === "failed" ? styles.statusFailed : undefined}>
          {statusLabel[r.status]}
          {r.error && <span className={styles.errorNote}> — {r.error}</span>}
        </span>
      ),
    },
    {
      key: "opens",
      header: "Opened",
      cell: (r) => (r.openCount > 0 ? `${r.openCount}×` : "—"),
      align: "right",
      mono: true,
    },
    {
      key: "clicks",
      header: "Clicked",
      cell: (r) =>
        r.clickedLinks.length === 0
          ? "—"
          : r.clickedLinks
              .map((l) => `${l.label ?? "Untitled link"} (${l.count})`)
              .join(", "),
    },
    {
      key: "actions",
      header: "",
      cell: (r) =>
        r.status === "pending" ? (
          <span className={styles.rowActions}>
            <button
              type="button"
              className={styles.removeLink}
              onClick={() => sendOne(r.id)}
              disabled={sendingIds.has(r.id)}
            >
              {sendingIds.has(r.id) ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              className={styles.removeLink}
              onClick={() => removeRecipient(r.id)}
              disabled={sendingIds.has(r.id)}
            >
              Remove
            </button>
          </span>
        ) : null,
      width: "130px",
    },
  ];

  return (
    <div className={styles.stack}>
      <div className={styles.health}>
        <div className={styles.healthItem}>
          <span className={styles.healthValue}>{summary.pending}</span>
          <span className={styles.healthLabel}>Pending</span>
        </div>
        <div className={styles.healthItem}>
          <span className={styles.healthValue}>{summary.sending}</span>
          <span className={styles.healthLabel}>Sending</span>
        </div>
        <div className={styles.healthItem}>
          <span className={styles.healthValue}>{summary.sent}</span>
          <span className={styles.healthLabel}>Sent</span>
        </div>
        <div className={styles.healthItem}>
          <span className={[styles.healthValue, summary.failed > 0 ? styles.statusFailed : null].filter(Boolean).join(" ")}>
            {summary.failed}
          </span>
          <span className={styles.healthLabel}>Failed</span>
        </div>
      </div>

      <div className={styles.uploadRow}>
        <EmailTagInput
          id="recipient-emails"
          label="Add recipients"
          hint="Paste a list from Excel/Sheets, or type and press Enter/comma after each one. Each address becomes its own tag — remove one with × before adding."
          tags={emailTags}
          onChange={setEmailTags}
        />
        <div className={styles.actions}>
          <Button variant="secondary" onClick={upload} disabled={uploading || emailTags.length === 0}>
            {uploading ? "Adding…" : `Add ${emailTags.length || ""} to list`.trim()}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={realRows}
        rowKey={(r) => r.id}
        empty={loaded ? "No recipients yet — add some above." : "Loading…"}
      />

      <div className={styles.actions}>
        <Button variant="secondary" onClick={sendTest} disabled={testSending}>
          {testSending ? "Sending test…" : "Send test to myself"}
        </Button>
        {!confirmingSend ? (
          <Button
            onClick={() => setConfirmingSend(true)}
            disabled={sending || summary.pending === 0}
          >
            Send to {summary.pending} recipient{summary.pending === 1 ? "" : "s"}
          </Button>
        ) : (
          <>
            <Button onClick={sendNow} disabled={sending} shimmer>
              {sending ? "Starting…" : `Confirm — send ${summary.pending} email${summary.pending === 1 ? "" : "s"}`}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingSend(false)} disabled={sending}>
              Cancel
            </Button>
          </>
        )}
      </div>

      {(error || status) && (
        <p className={error ? styles.statusError : styles.statusOk} role={error ? "alert" : "status"}>
          {error ?? status}
        </p>
      )}

      {testRow && (
        <div className={styles.testPanel}>
          <p className={styles.testTitle}>Test send — verification only, excluded from campaign totals</p>
          <p className={styles.testBody}>
            Sent to <strong>{testRow.email}</strong>
            {testRow.sentAt && ` at ${new Date(testRow.sentAt).toLocaleString()}`}. Opened{" "}
            {testRow.openCount}×. Clicked:{" "}
            {testRow.clickedLinks.length === 0
              ? "nothing yet"
              : testRow.clickedLinks.map((l) => `${l.label ?? "Untitled link"} (${l.count})`).join(", ")}
            .
          </p>
        </div>
      )}

      {openRecipientId && (
        <RecipientDetailModal
          campaignId={campaignId}
          recipientId={openRecipientId}
          onClose={() => setOpenRecipientId(null)}
        />
      )}
    </div>
  );
}

export default RecipientsPanel;
