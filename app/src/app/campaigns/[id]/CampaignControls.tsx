"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field } from "@/components";
import styles from "./dashboard.module.css";

export interface CampaignControlsProps {
  id: string;
  name: string;
  sentCount: number;
  /** The stored tracked HTML; null when the campaign predates storage. */
  processedHtml: string | null;
}

function toFileName(name: string): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${safe || "campaign"}-tracked.html`;
}

export function CampaignControls({
  id,
  name,
  sentCount,
  processedHtml,
}: CampaignControlsProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(sentCount));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      setError("Enter a send count of 0 or more.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${id}/sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentCount: Math.round(next) }),
      });
      if (!response.ok) {
        throw new Error(`Could not save the send count (${response.status}).`);
      }
      setStatus("Send count updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function download() {
    if (!processedHtml) return;
    const blob = new Blob([processedHtml], { type: "text/html;charset=utf-8" });
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
    <form onSubmit={save} noValidate>
      <div className={styles.controls}>
        <div className={styles.controlField}>
          <Field
            id="sent-count"
            label="Emails sent"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="secondary"
          onClick={download}
          disabled={!processedHtml}
          title={
            processedHtml
              ? undefined
              : "No tracked HTML stored for this campaign."
          }
        >
          Download tracked HTML
        </Button>
      </div>
      {(error || status) && (
        <p
          className={[styles.status, error ? styles.statusError : null]
            .filter(Boolean)
            .join(" ")}
          role={error ? "alert" : "status"}
        >
          {error ?? status}
        </p>
      )}
    </form>
  );
}

export default CampaignControls;
