import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db.js";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 min
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "JWT_ACCESS_SECRET must be set to a strong random value (>= 16 chars).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getAccessSecret());
}

/** Returns the userId encoded in a valid, unexpired access token, else null. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function newRefreshTokenValue(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface RequestMeta {
  userAgent: string | null;
  ip: string | null;
}

export interface IssuedRefreshToken {
  id: string;
  /** Raw value — goes in the cookie. Never persisted; only its hash is. */
  token: string;
  expiresAt: Date;
}

export async function issueRefreshToken(
  userId: string,
  meta: RequestMeta,
): Promise<IssuedRefreshToken> {
  const token = newRefreshTokenValue();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
    select: { id: true },
  });
  return { id: row.id, token, expiresAt };
}

export type RefreshCheck =
  | { ok: true; userId: string; refreshTokenId: string }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

/**
 * Validates a presented refresh token against the DB. A token that matches an
 * already-revoked row means someone replayed a cookie that was already
 * rotated out — a strong signal of theft — so every active session for that
 * user is revoked and the caller must force a fresh login.
 */
export async function checkRefreshToken(token: string): Promise<RefreshCheck> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row) return { ok: false, reason: "invalid" };

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: false, reason: "reused" };
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, userId: row.userId, refreshTokenId: row.id };
}

/** Revokes the old refresh token row and issues + persists its replacement. */
export async function rotateRefreshToken(
  oldRefreshTokenId: string,
  userId: string,
  meta: RequestMeta,
): Promise<IssuedRefreshToken> {
  const next = await issueRefreshToken(userId, meta);
  await prisma.refreshToken.update({
    where: { id: oldRefreshTokenId },
    data: { revokedAt: new Date(), replacedByTokenId: next.id },
  });
  return next;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Logs out every session for a user — used after a password change so a
 *  stolen-but-not-yet-detected session can't outlive the new password. */
export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
