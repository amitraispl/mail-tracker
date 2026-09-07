import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const ACCESS_COOKIE = "mt_access";
const REFRESH_COOKIE = "mt_refresh";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const PUBLIC_PREFIXES = ["/login"];

/** Proxied straight through to the backend (see next.config.ts `rewrites()`) —
 *  never gate these behind a redirect-to-login. The backend independently
 *  authenticates every request regardless; redirecting an XHR/fetch call to
 *  the HTML login page would just corrupt the caller's expected JSON response. */
function isApi(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set. Add it to .env and restart.");
  }
  return new TextEncoder().encode(secret);
}

async function isValidAccessToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

function extractCookieValue(setCookieHeader: string, name: string): string | null {
  const match = setCookieHeader.match(new RegExp(`^${name}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Verifies the access-token JWT for the UX-only decision of "render the page
 * or bounce to /login" — the backend re-checks on every single API call
 * regardless, so this is a fast-path/redirect layer, not the enforcement
 * point (same secret, real signature verification, not just a shape check).
 *
 * If the access token is missing/expired but a refresh cookie is present,
 * this attempts one silent refresh against the backend and forwards the new
 * cookies both to the browser (via the response) and into this same
 * request's cookie jar (via `request.cookies.set`), so the Server Component
 * this request renders sees the fresh token immediately — no extra round trip
 * or flash of the login page for an otherwise-valid session.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname) || isApi(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (await isValidAccessToken(accessToken)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
      });

      if (refreshRes.ok) {
        const setCookies = refreshRes.headers.getSetCookie?.() ?? [];
        const accessCookieStr = setCookies.find((c) => c.startsWith(`${ACCESS_COOKIE}=`));
        const newAccess = accessCookieStr
          ? extractCookieValue(accessCookieStr, ACCESS_COOKIE)
          : null;

        if (newAccess) {
          request.cookies.set(ACCESS_COOKIE, newAccess);
        }

        const response = NextResponse.next({ request });
        for (const cookieStr of setCookies) {
          response.headers.append("set-cookie", cookieStr);
        }
        return response;
      }
    } catch (error) {
      console.error("[middleware] silent refresh failed", error);
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  // Skip Next internals and static assets; everything else goes through.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|brand/).*)"],
};
