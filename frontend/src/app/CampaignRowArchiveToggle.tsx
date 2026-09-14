"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./page.module.css";

export interface CampaignRowArchiveToggleProps {
  id: string;
  archived: boolean;
}

export function CampaignRowArchiveToggle({ id, archived }: CampaignRowArchiveToggleProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const response = await apiFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.archiveToggle}
      onClick={toggle}
      disabled={pending}
      aria-label={archived ? "Restore campaign" : "Archive campaign"}
      title={archived ? "Restore" : "Archive"}
    >
      {pending ? "…" : archived ? "Restore" : "Archive"}
    </button>
  );
}

export default CampaignRowArchiveToggle;
