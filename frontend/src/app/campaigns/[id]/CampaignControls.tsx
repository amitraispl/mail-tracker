"use client";

import { useState } from "react";
import { Button } from "@/components";
import styles from "./dashboard.module.css";

export interface CampaignControlsProps {
  id: string;
  name: string;
  /** The stored tracked HTML; null when the campaign predates storage. */
  processedHtml: string | null;
}

function toFileName(name: string): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return `${safe || "campaign"}-tracked.html`;
}

export function CampaignControls({ name, processedHtml }: CampaignControlsProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function copy() {
    if (!processedHtml) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(processedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — your browser blocked clipboard access.");
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
      </div>
      {error && (
        <p className={[styles.status, styles.statusError].join(" ")} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default CampaignControls;
