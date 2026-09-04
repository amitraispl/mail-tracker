import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getAppPassword,
  timingSafeEqual,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Blunt throttle: slows password guessing without needing shared state. */
const FAILURE_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  const expected = getAppPassword();
  if (!expected) {
    return NextResponse.json(
      { error: "APP_PASSWORD is not set on the server." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let submitted = "";
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      password?: unknown;
    } | null;
    submitted = typeof body?.password === "string" ? body.password : "";
  } else {
    const form = await request.formData().catch(() => null);
    const value = form?.get("password");
    submitted = typeof value === "string" ? value : "";
  }

  if (!timingSafeEqual(submitted, expected)) {
    await sleep(FAILURE_DELAY_MS);
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set({
    name: SESSION_COOKIE,
    value: await createSessionToken(expected),
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
