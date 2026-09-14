"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components";
import { CAMPAIGN_REFRESH_EVENT } from "./refreshEvent";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    // router.refresh() only re-runs the server component (stats, per-link
    // clicks) — it doesn't remount client components, so their own fetched
    // state (recipients' Opened/Clicked, activity feed) would otherwise
    // stay stale until a full page reload. Nudge them too.
    window.dispatchEvent(new Event(CAMPAIGN_REFRESH_EVENT));
    startTransition(() => router.refresh());
  }

  return (
    <Button variant="secondary" disabled={pending} onClick={refresh}>
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}

export default RefreshButton;
