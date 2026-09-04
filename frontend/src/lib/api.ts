export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function refreshSession(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

/**
 * fetch() against the backend, browser-side, with cookies attached. On a 401
 * (access token expired mid-session — middleware only guards page loads, not
 * every click), transparently refreshes once and retries before giving up.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const first = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  if (first.status !== 401) return first;

  if (!(await refreshSession())) return first;

  return fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
}
