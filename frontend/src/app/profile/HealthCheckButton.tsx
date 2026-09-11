"use client";

import { useState } from "react";
import { Button } from "@/components";
import styles from "./profile.module.css";

type Result =
  | { ok: true; ms: number }
  | { ok: false; message: string };

export function HealthCheckButton() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function check() {
    setChecking(true);
    setResult(null);
    const started = performance.now();
    try {
      const res = await fetch("/healthz", { cache: "no-store" });
      const ms = Math.round(performance.now() - started);
      if (!res.ok) {
        setResult({ ok: false, message: `Backend responded with ${res.status}.` });
        return;
      }
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!body?.ok) {
        setResult({ ok: false, message: "Backend responded, but not with the expected shape." });
        return;
      }
      setResult({ ok: true, ms });
    } catch {
      setResult({ ok: false, message: "Could not reach the backend at all." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={check} disabled={checking}>
          {checking ? "Checking…" : "Check backend health"}
        </Button>
        {result && (
          <span
            className={[styles.healthResult, result.ok ? styles.healthOk : styles.healthFail].join(" ")}
          >
            {result.ok ? `Reachable — ${result.ms}ms` : result.message}
          </span>
        )}
      </div>
    </div>
  );
}

export default HealthCheckButton;
