"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Eyebrow, Field, PageHeader } from "@/components";
import styles from "./login.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // Only same-site paths, so ?next= can't be used to bounce someone off-site.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      setPassword("");
      // Swap the form for a spinner right away instead of leaving the
      // (now-blank) form sitting frozen while the destination route's data
      // fetch resolves — router.replace()'s own loading.tsx fallback only
      // kicks in once navigation actually starts, which isn't instant.
      setSucceeded(true);
      router.replace(next);
      router.refresh();
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setError(body?.error ?? "Sign-in failed.");
    setPending(false);
  }

  if (succeeded) {
    return (
      <Card className={styles.card} title="Sign in">
        <div className={styles.redirecting}>
          <div className={styles.spinner} role="status" aria-label="Signing in" />
          <p className={styles.redirectingLabel}>Signing in…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={styles.card}
      title="Sign in"
      description="This tracker is private. Enter your account to continue."
    >
      <form className={styles.form} onSubmit={onSubmit}>
        <Field
          id="email"
          type="email"
          label="Email"
          autoComplete="username"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending || password.length === 0 || email.length === 0}
          shimmer={!pending && password.length > 0 && email.length > 0}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow muted>Mail Tracker</Eyebrow>}
        title="Private tracker"
        subtitle="Tracking pixels and click redirects stay public — the dashboard does not."
        homeHref={null}
      />
      <main className={`container section ${styles.wrap}`}>
        <div className={styles.panel}>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
