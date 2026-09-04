"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  Button,
  Card,
  Eyebrow,
  Field,
  PageHeader,
  buttonClassName,
} from "@/components";
import styles from "./new.module.css";

type Source = "upload" | "paste";

interface ProcessResult {
  id: string;
  processedHtml: string;
  linkCount: number;
}

/** Keep the download filename usable on every OS. */
function toFileName(name: string): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${safe || "campaign"}-tracked.html`;
}

export default function NewCampaignPage() {
  const [name, setName] = useState("");
  const [sentCount, setSentCount] = useState("0");
  const [source, setSource] = useState<Source>("upload");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      setHtml("");
      return;
    }
    setError(null);
    setFileName(file.name);
    try {
      setHtml(await file.text());
    } catch {
      setFileName(null);
      setHtml("");
      setError("Could not read that file. Try pasting the HTML instead.");
    }
  }

  function selectSource(next: Source) {
    setSource(next);
    setHtml("");
    setFileName(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Give the campaign a name.");
      return;
    }
    if (!html.trim()) {
      setError(
        source === "upload"
          ? "Choose an HTML file to track."
          : "Paste the HTML of the email to track.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          html,
          sentCount: Number(sentCount) || 0,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Processing failed (${response.status}).`;
        throw new Error(message);
      }

      setResult(payload as ProcessResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.processedHtml], {
      type: "text/html;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = toFileName(name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow muted>New campaign</Eyebrow>}
        title={result ? "Tracked HTML ready" : "Create a campaign"}
        subtitle={
          result
            ? "Download the tracked HTML, then paste it into Carbonio in HTML mode."
            : "Upload or paste the HTML email. We inject the tracking pixel and rewrite every link."
        }
        actions={
          <Link href="/" className={buttonClassName("secondary")}>
            All campaigns
          </Link>
        }
      />

      <main className="container section">
        <div className={styles.layout}>
          {result ? (
            <Card
              title="Processed"
              description="The tracked copy is stored with the campaign — you can re-download it from the dashboard."
            >
              <div className={styles.result}>
                <p className={styles.resultHead}>
                  <span className={styles.count}>{result.linkCount}</span>
                  <span className={styles.countLabel}>
                    {result.linkCount === 1
                      ? "link rewritten"
                      : "links rewritten"}
                  </span>
                </p>

                <div className={styles.actions}>
                  <Button onClick={download}>Download tracked HTML</Button>
                  <Link
                    href={`/campaigns/${result.id}`}
                    className={buttonClassName("secondary")}
                  >
                    Open dashboard
                  </Link>
                </div>

                <div>
                  <label className={styles.sourceLabel} htmlFor="processed-html">
                    Processed HTML (read-only)
                  </label>
                  <textarea
                    id="processed-html"
                    className={styles.preview}
                    value={result.processedHtml}
                    readOnly
                    spellCheck={false}
                    rows={14}
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Campaign">
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.pair}>
                  <Field
                    id="campaign-name"
                    label="Campaign name"
                    placeholder="September newsletter"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    required
                  />
                  <Field
                    id="sent-count"
                    label="Emails to send"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={sentCount}
                    onChange={(e) => setSentCount(e.target.value)}
                    hint="Used for the rate maths — editable later."
                  />
                </div>

                <div>
                  <span className={styles.sourceLabel}>Email HTML</span>
                  <div
                    className={styles.switch}
                    role="group"
                    aria-label="HTML source"
                  >
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
                  <p className={styles.note}>
                    HTML only — there is no plain-text path. Upload a{" "}
                    <code className={styles.code}>.html</code> file or paste the
                    markup itself.
                  </p>
                </div>

                {source === "upload" ? (
                  <div className={styles.fileRow}>
                    <Field
                      id="html-file"
                      label="HTML file"
                      type="file"
                      accept=".html,.htm,text/html"
                      onChange={handleFile}
                      hint="Only .html / .htm files."
                    />
                    {fileName && (
                      <span className={styles.fileName}>{fileName}</span>
                    )}
                  </div>
                ) : (
                  <Field
                    as="textarea"
                    id="html-source"
                    label="HTML source"
                    rows={14}
                    spellCheck={false}
                    placeholder="<html>…</html>"
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    hint="Paste the full HTML body of the email — markup, not plain text."
                  />
                )}

                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}

                <div className={styles.actions}>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Processing…" : "Process HTML"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="Send it from Carbonio">
            <ol className={styles.steps}>
              <li>Download the tracked HTML.</li>
              <li>Open Carbonio webmail and click Compose.</li>
              <li>
                Switch the message body to <strong>HTML</strong> mode.
              </li>
              <li>Paste the tracked HTML as the message source.</li>
              <li>Send.</li>
            </ol>
            <p className={styles.tip}>
              Add <code className={styles.code}>data-no-track</code> to any anchor
              you want left alone — unsubscribe links, for example.{" "}
              <code className={styles.code}>mailto:</code>,{" "}
              <code className={styles.code}>tel:</code>, anchors and relative URLs
              are skipped automatically.
            </p>
            <p className={styles.tip}>
              Open rate is approximate: image blocking hides opens and Apple Mail
              Privacy pre-loads pixels. Per-link clicks are the reliable signal.
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}
