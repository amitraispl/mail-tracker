import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  getAppPassword,
  verifySessionToken,
} from "@/lib/auth";

/**
 * Everything is gated except the tracking endpoints — recipients' mail clients
 * must reach the pixel and the click redirect without a session.
 */
const PUBLIC_PREFIXES = ["/api/track/", "/login", "/api/auth/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const password = getAppPassword();

  // Fail closed: an unconfigured password must not mean "open to everyone".
  if (!password) {
    return new NextResponse(
      "APP_PASSWORD is not set. Add it to .env and restart the server.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, password)) {
    return NextResponse.next();
  }

  // APIs get a JSON 401; pages get bounced to the login form.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
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
