"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Field } from "@/components";
import { apiFetch } from "@/lib/api";
import styles from "./dashboard.module.css";

export interface CampaignEditorProps {
  id: string;
  name: string;
  subject: string | null;
}

type Source = "upload" | "paste";

export function CampaignEditor({ id, name: initialName, subject: initialSubject }: CampaignEditorProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameDirty =
    (name.trim() !== initialName.trim() && name.trim().length > 0) ||
    subject.trim() !== (initialSubject ?? "").trim();

  const [replacing, setReplacing] = useState(false);
  const [source, setSource] = useState<Source>("upload");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [savingHtml, setSavingHtml] = useState(false);
  const [htmlStatus, setHtmlStatus] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setNameStatus(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name can't be empty.");
      return;
    }

    setSavingName(true);
    try {
      const response = await apiFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, subject: subject.trim() }),
      });
      if (!response.ok) {
        throw new Error(`Could not save (${response.status}).`);
      }
      setNameStatus("Saved.");
      router.refresh();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingName(false);
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
      <form onSubmit={saveName} noValidate className={styles.controls}>
        <div className={styles.nameField}>
          <Field
            id="campaign-name"
            label="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={styles.nameField}>
          <Field
            id="campaign-subject"
            label="Subject line"
            placeholder="Defaults to the campaign name"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoComplete="off"
            hint="Used when sending via the platform. Leave blank to fall back to the campaign name."
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={savingName}
          shimmer={nameDirty && !savingName}
          className={styles.controlsButton}
        >
          {savingName ? "Saving…" : "Save"}
        </Button>
      </form>
      {(nameError || nameStatus) && (
        <p
          className={[styles.status, nameError ? styles.statusError : null]
            .filter(Boolean)
            .join(" ")}
          role={nameError ? "alert" : "status"}
        >
          {nameError ?? nameStatus}
        </p>
      )}

      <div className={styles.divider} />

      {!replacing ? (
        <Button variant="secondary" onClick={() => setReplacing(true)}>
          Replace tracked HTML
        </Button>
      ) : (
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

export default CampaignEditor;
