import type { Response } from "express";

export const ACCESS_COOKIE = "mt_access";
export const REFRESH_COOKIE = "mt_refresh";

/** Empty/unset = host-only cookie. Only set this to a shared parent domain
 *  (e.g. ".illumiasolutions.com") if frontend and backend are on subdomains
 *  of the same site — leave empty when they're on unrelated domains (e.g.
 *  a Vercel frontend + a Render backend), since there's no parent domain to
 *  scope to there and cross-site delivery is handled by `sameSite`/CORS instead. */
function cookieDomain(): string | undefined {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain ? domain : undefined;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/** "none" requires `secure: true` (HTTPS-only) — browsers reject an insecure
 *  SameSite=None cookie outright. Local dev stays "lax" over plain http. */
function sameSitePolicy(): "lax" | "none" {
  return isProd() ? "none" : "lax";
}

export function setAccessCookie(
  res: Response,
  token: string,
  maxAgeSeconds: number,
): void {
  res.cookie(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: sameSitePolicy(),
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
    sameSite: sameSitePolicy(),
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
