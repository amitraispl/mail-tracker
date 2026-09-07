import type { Response } from "express";

export const ACCESS_COOKIE = "mt_access";
export const REFRESH_COOKIE = "mt_refresh";

/** Empty/unset = host-only cookie (correct default: the frontend proxies
 *  /api/* through its own domain — see frontend/next.config.ts `rewrites()` —
 *  so this cookie is always first-party from the browser's perspective, even
 *  when frontend and backend are unrelated domains like Vercel + Render).
 *  Only set this to a shared parent domain if frontend and backend are on
 *  subdomains of the same site AND you're calling the backend directly from
 *  the browser instead of proxying, e.g. COOKIE_DOMAIN=".illumiasolutions.com". */
function cookieDomain(): string | undefined {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain ? domain : undefined;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setAccessCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
): void {
  res.cookie(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    domain: cookieDomain(),
    path: "/",
    maxAge: maxAgeSeconds * 1000,
  });
}

/** Scoped to /api/auth so it's never sent on ordinary API calls — the refresh
 *  token only ever needs to reach the refresh/logout endpoints. */
export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    domain: cookieDomain(),
    path: "/api/auth",
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const domain = cookieDomain();
  res.clearCookie(ACCESS_COOKIE, { path: "/", domain });
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth", domain });
}
