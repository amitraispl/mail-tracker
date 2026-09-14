"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import styles from "./CampaignsToolbar.module.css";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Debounced, URL-driven search + Active/Archived tabs — the list page
 *  itself re-fetches from the backend on `q`/`view` change, so the search
 *  actually filters by name/subject server-side rather than client-side. */
export function CampaignsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") === "archived" ? "archived" : "active";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function pushParams(next: { q?: string; view?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const q = next.q ?? query;
    const v = next.view ?? view;

    if (q) params.set("q", q);
    else params.delete("q");

    if (v === "archived") params.set("view", "archived");
    else params.delete("view");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onSearchChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value }), 300);
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={onSearchChange}
          placeholder="Search by campaign name or subject…"
          aria-label="Search campaigns by name or subject"
          className={styles.searchInput}
        />
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Campaign view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "active"}
          className={styles.tab}
          data-active={view === "active"}
          onClick={() => pushParams({ view: "active" })}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "archived"}
          className={styles.tab}
          data-active={view === "archived"}
          onClick={() => pushParams({ view: "archived" })}
        >
          Archived
        </button>
      </div>
    </div>
  );
}

export default CampaignsToolbar;
