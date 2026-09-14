"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, DataTable, type Column } from "@/components";
import { apiFetch } from "@/lib/api";
import { EmailTagInput, type EmailEntry } from "./EmailTagInput";
import { RecipientDetailModal } from "./RecipientDetailModal";
import { RecipientExcelUpload } from "./RecipientExcelUpload";
import { CAMPAIGN_REFRESH_EVENT } from "./refreshEvent";
import dashboardStyles from "./dashboard.module.css";
import styles from "./sending.module.css";

interface ClickedLink {
  label: string | null;
  count: number;
}

interface RecipientRow {
  id: string;
  email: string;
  name: string | null;
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
  campaignName: string;
}

const statusLabel: Record<RecipientRow["status"], string> = {
  pending: "Pending",
  sending: "Sending…",
  sent: "Sent",
  failed: "Failed",
};

function ResendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_FILTERS = ["all", "pending", "sending", "sent", "failed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusFilterLabel: Record<StatusFilter, string> = {
  all: "All",
  pending: "Pending",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};

function RemoveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7h10ZM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecipientsPanel({ campaignId, campaignName }: RecipientsPanelProps) {
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [emailTags, setEmailTags] = useState<EmailEntry[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelInputKey, setExcelInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [openRecipientId, setOpenRecipientId] = useState<string | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [exporting, setExporting] = useState<"recipients" | "activity" | null>(null);
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

  useEffect(() => {
    window.addEventListener(CAMPAIGN_REFRESH_EVENT, load);
    return () => window.removeEventListener(CAMPAIGN_REFRESH_EVENT, load);
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

  // One button covers both input methods: a chosen spreadsheet takes
  // priority over pasted/typed tags (picking a file and leaving stale tags
  // in the box is the more likely accident than the reverse).
  async function addToList() {
    setError(null);
    setStatus(null);
    setWarnings([]);
    if (!excelFile && emailTags.length === 0) {
      setError("Add at least one email address, or choose a spreadsheet.");
      return;
    }
    setUploading(true);
    try {
      const res = excelFile
        ? await apiFetch(`/api/campaigns/${campaignId}/recipients/upload`, {
            method: "POST",
            body: (() => {
              const formData = new FormData();
              formData.append("file", excelFile);
              return formData;
            })(),
          })
        : await apiFetch(`/api/campaigns/${campaignId}/recipients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: emailTags }),
          });

      const body = (await res.json().catch(() => null)) as {
        created?: number;
        skipped?: number;
        invalid?: string[];
        error?: string;
      } | null;
      if (!res.ok) {
        if (body?.invalid?.length) setWarnings(body.invalid);
        throw new Error(body?.error ?? `Could not add recipients (${res.status}).`);
      }
      const parts = [`${body?.created ?? 0} added`];
      if (body?.skipped) parts.push(`${body.skipped} already on the list`);
      if (!excelFile && body?.invalid?.length) parts.push(`${body.invalid.length} skipped (invalid)`);
      setStatus(parts.join(", ") + ".");
      if (body?.invalid?.length) setWarnings(body.invalid);
      if (excelFile) {
        setExcelFile(null);
        setExcelInputKey((k) => k + 1);
      } else {
        setEmailTags([]);
      }
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

  // Downloads must go through this app's own proxied /api path (not a plain
  // <a href> to the backend) so the request carries the session cookie —
  // same reason apiFetch exists — hence fetch + blob + a throwaway <a>.
  async function downloadExport(kind: "recipients" | "activity") {
    setError(null);
    setExporting(kind);
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}/export/${kind}`);
      if (!res.ok) throw new Error(`Could not export ${kind} (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = campaignName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "campaign";
      a.href = url;
      a.download = `${safeName}-${kind}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not export ${kind}.`);
    } finally {
      setExporting(null);
    }
  }

  const realRows = recipients.filter((r) => !r.isTest);
  const testRow = recipients.find((r) => r.isTest) ?? null;

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return realRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.email.toLowerCase().includes(q) || (r.name?.toLowerCase().includes(q) ?? false);
    });
  }, [realRows, searchQuery, statusFilter]);

  const isFiltering = searchQuery.trim() !== "" || statusFilter !== "all";

  const columns: Column<RecipientRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) =>
        r.name ? (
          <span>{r.name}</span>
        ) : (
          <span className={styles.countEmpty}>—</span>
        ),
    },
    {
      key: "email",
      header: "Email",
      cell: (r) => <span className={styles.emailText}>{r.email}</span>,
      mono: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span>
          <span className={styles.statusBadge} data-status={r.status}>
            {statusLabel[r.status]}
          </span>
          {r.error && <span className={styles.errorNote}> — {r.error}</span>}
        </span>
      ),
    },
    {
      key: "opens",
      header: "Opened",
      cell: (r) =>
        r.openCount > 0 ? (
          <span className={styles.countBadge}>{r.openCount}×</span>
        ) : (
          <span className={styles.countEmpty}>—</span>
        ),
      align: "right",
      width: "100px",
    },
    {
      key: "clicks",
      header: "Clicked",
      cell: (r) =>
        r.clickedLinks.length === 0 ? (
          <span className={styles.countEmpty}>—</span>
        ) : (
          <span className={styles.clickedLinksCell}>
            {r.clickedLinks.map((l, i) => (
              <span key={i} className={styles.clickedLinkTag}>
                {l.label ?? "Untitled link"} <span className={styles.clickedLinkCount}>×{l.count}</span>
              </span>
            ))}
          </span>
        ),
      width: "260px",
    },
    {
      key: "resend",
      header: "Resend",
      cell: (r) =>
        r.status === "sending" ? null : (
          <button
            type="button"
            className={styles.iconButton}
            onClick={(e) => {
              e.stopPropagation();
              sendOne(r.id);
            }}
            disabled={sendingIds.has(r.id)}
            aria-label={r.status === "pending" ? `Send to ${r.email}` : `Resend to ${r.email}`}
            title={sendingIds.has(r.id) ? "Sending…" : r.status === "pending" ? "Send" : "Resend"}
          >
            <ResendIcon />
          </button>
        ),
      align: "right",
      width: "80px",
    },
    {
      key: "remove",
      header: "Remove",
      cell: (r) =>
        r.status === "sending" ? null : (
          <button
            type="button"
            className={[styles.iconButton, styles.iconButtonDanger].join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              removeRecipient(r.id);
            }}
            disabled={sendingIds.has(r.id)}
            aria-label={`Remove ${r.email}`}
            title="Remove"
          >
            <RemoveIcon />
          </button>
        ),
      align: "right",
      width: "80px",
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
          hint="Paste a list from Excel/Sheets, a name+email pair per line (Jane Doe <jane@x.com>, or two tab/comma-separated columns), or type and press Enter/comma after each one."
          tags={emailTags}
          onChange={setEmailTags}
        />
        <RecipientExcelUpload
          fileInputKey={excelInputKey}
          disabled={uploading}
          onFileChange={setExcelFile}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={addToList}
            disabled={uploading || (!excelFile && emailTags.length === 0)}
          >
            {uploading
              ? "Adding…"
              : excelFile
                ? `Add "${excelFile.name}" to list`
                : `Add ${emailTags.length || ""} to list`.trim()}
          </Button>
        </div>
        {warnings.length > 0 && (
          <ul className={styles.warningList}>
            {warnings.slice(0, 10).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 10 && <li>…and {warnings.length - 10} more.</li>}
          </ul>
        )}
      </div>

      {realRows.length > 0 && (
        <div className={styles.filterBar}>
          <div className={styles.filterSearchWrap}>
            <span className={styles.filterSearchIcon} aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search recipients by name or email"
              className={styles.filterSearchInput}
            />
          </div>
          <div className={dashboardStyles.switch} role="tablist" aria-label="Filter by status">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={statusFilter === s}
                className={[
                  dashboardStyles.switchButton,
                  statusFilter === s ? dashboardStyles.switchButtonActive : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setStatusFilter(s)}
              >
                {statusFilterLabel[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpenRecipientId(r.id)}
        empty={
          !loaded
            ? "Loading…"
            : isFiltering
              ? "No recipients match this search/filter."
              : "No recipients yet — add some above."
        }
      />

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() => downloadExport("recipients")}
          disabled={exporting !== null || realRows.length === 0}
        >
          {exporting === "recipients" ? "Exporting…" : "Export recipients (CSV)"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => downloadExport("activity")}
          disabled={exporting !== null}
        >
          {exporting === "activity" ? "Exporting…" : "Export activity (CSV)"}
        </Button>
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
          onChanged={load}
        />
      )}
    </div>
  );
}

export default RecipientsPanel;
