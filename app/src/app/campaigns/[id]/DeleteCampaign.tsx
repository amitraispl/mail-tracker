"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components";
import styles from "./dashboard.module.css";

export interface DeleteCampaignProps {
  id: string;
  name: string;
}

export function DeleteCampaign({ id, name }: DeleteCampaignProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setDeleting(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Could not delete this campaign (${response.status}).`);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setDeleting(false);
    }
  }

  return (
    <div className={styles.dangerZone}>
      <div>
        <p className={styles.dangerTitle}>Delete “{name}”</p>
        <p className={styles.dangerNote}>
          Removes the campaign, its links, and every logged open and click.
          This can&apos;t be undone.
        </p>
      </div>

      {!confirming ? (
        <Button
          variant="secondary"
          className={styles.dangerButton}
          onClick={() => setConfirming(true)}
        >
          Delete campaign
        </Button>
      ) : (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.dangerButton}
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Confirm delete"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p className={styles.statusError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default DeleteCampaign;
