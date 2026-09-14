"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components";
import { apiFetch } from "@/lib/api";
import styles from "./dashboard.module.css";

export interface ArchiveCampaignProps {
  id: string;
  name: string;
  archived: boolean;
}

export function ArchiveCampaign({ id, name, archived }: ArchiveCampaignProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setPending(true);
    try {
      const response = await apiFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (!response.ok) {
        throw new Error(`Could not ${archived ? "unarchive" : "archive"} this campaign (${response.status}).`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.archiveZone}>
      <div>
        <p className={styles.archiveTitle}>
          {archived ? `Unarchive "${name}"` : `Archive "${name}"`}
        </p>
        <p className={styles.archiveNote}>
          {archived
            ? "Brings it back into the main campaign list. Nothing about its data changes."
            : "Hides it from the main list without deleting anything — find it later under Archived."}
        </p>
      </div>
      <Button variant="secondary" onClick={toggle} disabled={pending}>
        {pending ? "Working…" : archived ? "Unarchive" : "Archive campaign"}
      </Button>
      {error && (
        <p className={styles.statusError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default ArchiveCampaign;
