/** The backend's real origin — only for server-side use (lib/backend.ts),
 *  which talks to the backend directly and forwards cookies manually.
 *  Browser-side code below deliberately uses relative `/api/...` paths
 *  instead, so requests go through this app's own domain (proxied to the
 *  backend via next.config.ts `rewrites()`) rather than straight to the
 *  backend's origin — required for Set-Cookie to land as a first-party
 *  cookie here when frontend and backend are on unrelated domains. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function refreshSession(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

/**
 * fetch() against the backend (via this app's own domain, proxied), browser-
 * side, with cookies attached. On a 401 (access token expired mid-session —
 * middleware only guards page loads, not every click), transparently
 * refreshes once and retries before giving up.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const first = await fetch(path, { ...init, credentials: "include" });
  if (first.status !== 401) return first;

  if (!(await refreshSession())) return first;

  return fetch(path, { ...init, credentials: "include" });
}
