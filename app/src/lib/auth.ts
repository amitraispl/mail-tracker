/**
 * Shared-password auth for the operator surface.
 *
 * The session cookie is `<expiresAt>.<hmac>`, signed with APP_PASSWORD itself —
 * so changing the password invalidates every outstanding session. Web Crypto is
 * used throughout because middleware runs on the Edge runtime, where node:crypto
 * is unavailable.
 *
 * /api/track/** is deliberately NOT protected: recipients' mail clients hit it
 * unauthenticated.
 */

export const SESSION_COOKIE = "mt_session";

/** 12 hours. */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function getAppPassword(): string | null {
  const value = process.env.APP_PASSWORD;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Compare without leaking length or position through timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  // Fold the length difference in rather than returning early.
  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Mint a session token valid for SESSION_TTL_SECONDS. */
export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

/** True only for an unexpired token signed with the current password. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expiresAt = Number(payload);
  if (!Number.isInteger(expiresAt)) return false;
  if (expiresAt * 1000 <= Date.now()) return false;

  return timingSafeEqual(signature, await sign(payload, secret));
}
