"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Field } from "@/components";
import { apiFetch } from "@/lib/api";
import styles from "./dashboard.module.css";

export interface CampaignControlsProps {
  id: string;
  name: string;
  /** The stored tracked HTML; null when the campaign predates storage. */
  processedHtml: string | null;
}

type Source = "upload" | "paste";

function toFileName(name: string): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${safe || "campaign"}-tracked.html`;
}

/** Mirrors the backend's lib/personalize.ts renderForRecipient: appends
 *  `&r=<recipientId>` to every tracking URL, so the copied/downloaded HTML's
 *  opens/clicks show up on that recipient's activity timeline instead of
 *  logging as unattributed. */
function personalize(processedHtml: string, recipientId: string): string {
  const r = encodeURIComponent(recipientId);
  return processedHtml.replace(
    /(\/api\/track\/(?:open|click)\/[^"'\s]+)/g,
    (url) => `${url}${url.includes("?") ? "&" : "?"}r=${r}`,
  );
}

export function CampaignControls({ id, name, processedHtml }: CampaignControlsProps) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testRecipientId, setTestRecipientId] = useState<string | null>(null);

  const [replacing, setReplacing] = useState(false);
  const [source, setSource] = useState<Source>("upload");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [savingHtml, setSavingHtml] = useState(false);
  const [htmlStatus, setHtmlStatus] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  const loadTestRecipient = useCallback(async () => {
    const res = await apiFetch(`/api/campaigns/${id}/recipients`);
    if (!res.ok) return;
    const body = (await res.json()) as { recipients: { id: string; isTest: boolean }[] };
    setTestRecipientId(body.recipients.find((r) => r.isTest)?.id ?? null);
  }, [id]);

  useEffect(() => {
    loadTestRecipient();
  }, [loadTestRecipient]);

  function exportHtml(): string | null {
    if (!processedHtml) return null;
    return testRecipientId ? personalize(processedHtml, testRecipientId) : processedHtml;
  }

  function download() {
    const source = exportHtml();
    if (!source) return;
    const blob = new Blob([source], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toFileName(name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    const source = exportHtml();
    if (!source) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — your browser blocked clipboard access.");
    }
  }

  function selectSource(next: Source) {
    setSource(next);
    setHtml("");
    setFileName(null);
    setHtmlError(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      setHtml("");
      return;
    }
    setHtmlError(null);
    setFileName(file.name);
    try {
      setHtml(await file.text());
    } catch {
      setFileName(null);
      setHtml("");
      setHtmlError("Could not read that file. Try pasting the HTML instead.");
    }
  }

  async function saveHtml(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHtmlError(null);
    setHtmlStatus(null);

    if (!html.trim()) {
      setHtmlError(
        source === "upload"
          ? "Choose an HTML file to track."
          : "Paste the HTML of the email to track.",
      );
      return;
    }

    setSavingHtml(true);
    try {
      const response = await apiFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Could not reprocess the HTML (${response.status}).`;
        throw new Error(message);
      }
      setHtmlStatus(
        "HTML replaced — links were regenerated and old click history for this campaign's links was cleared.",
      );
      setHtml("");
      setFileName(null);
      setReplacing(false);
      router.refresh();
    } catch (err) {
      setHtmlError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingHtml(false);
    }
  }

  return (
    <div>
      <div className={styles.controls}>
        <Button
          variant="secondary"
          onClick={copy}
          disabled={!processedHtml}
          title={processedHtml ? undefined : "No tracked HTML stored for this campaign."}
        >
          {copied ? "Copied!" : "Copy HTML"}
        </Button>
        <Button
          variant="secondary"
          onClick={download}
          disabled={!processedHtml}
          title={processedHtml ? undefined : "No tracked HTML stored for this campaign."}
        >
          Download tracked HTML
        </Button>
        {!replacing && (
          <Button variant="secondary" onClick={() => setReplacing(true)}>
            Replace tracked HTML
          </Button>
        )}
      </div>
      {error && (
        <p className={[styles.status, styles.statusError].join(" ")} role="alert">
          {error}
        </p>
      )}
      {!error && processedHtml && (
        <p className={styles.status}>
          {testRecipientId
            ? "Linked to your test send — opens/clicks from this copy show up on that recipient's activity."
            : "No test send yet — send one to yourself first so this copy's opens/clicks are attributed to it."}
        </p>
      )}

      {replacing && (
        <form onSubmit={saveHtml} noValidate className={styles.htmlForm}>
          <p className={styles.warnNote}>
            Replacing the HTML regenerates every link token, so any click
            history already logged against the current links is cleared.
            Total opens are unaffected — the pixel keeps its token.
          </p>

          <div className={styles.switch} role="group" aria-label="HTML source">
            <button
              type="button"
              className={[
                styles.switchButton,
                source === "upload" ? styles.switchButtonActive : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={source === "upload"}
              onClick={() => selectSource("upload")}
            >
              Upload file
            </button>
            <button
              type="button"
              className={[
                styles.switchButton,
                source === "paste" ? styles.switchButtonActive : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={source === "paste"}
              onClick={() => selectSource("paste")}
            >
              Paste HTML
            </button>
          </div>

          {source === "upload" ? (
            <div className={styles.fileRow}>
              <Field
                id="html-file-replace"
                label="HTML file"
                type="file"
                accept=".html,.htm,text/html"
                onChange={handleFile}
              />
              {fileName && <span className={styles.fileName}>{fileName}</span>}
            </div>
          ) : (
            <Field
              as="textarea"
              id="html-source-replace"
              label="HTML source"
              rows={10}
              spellCheck={false}
              placeholder="<html>…</html>"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          )}

          <div className={styles.actions}>
            <Button type="submit" disabled={savingHtml}>
              {savingHtml ? "Reprocessing…" : "Save & reprocess"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReplacing(false);
                setHtml("");
                setFileName(null);
                setHtmlError(null);
              }}
              disabled={savingHtml}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {(htmlError || htmlStatus) && (
        <p
          className={[styles.status, htmlError ? styles.statusError : null]
            .filter(Boolean)
            .join(" ")}
          role={htmlError ? "alert" : "status"}
        >
          {htmlError ?? htmlStatus}
        </p>
      )}
    </div>
  );
}

export default CampaignControls;
