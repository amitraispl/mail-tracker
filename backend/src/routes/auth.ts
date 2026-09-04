import { Router, type Request } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAccessCookie,
  setRefreshCookie,
} from "../lib/cookies.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  checkRefreshToken,
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type RequestMeta,
} from "../lib/tokens.js";
import { authenticate } from "../middleware/auth.js";

export const authRouter = Router();

/** Blunt throttle: slows password guessing without needing shared state. */
const FAILURE_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requestMeta(req: Request): RequestMeta {
  return {
    userAgent: req.get("user-agent") ?? null,
    ip: req.ip ?? null,
  };
}

authRouter.post("/login", async (req, res) => {
  const { email, password } = (req.body ?? {}) as {
    email?: unknown;
    password?: unknown;
  };

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    await sleep(FAILURE_DELAY_MS);
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const accessToken = await signAccessToken(user.id);
  const refresh = await issueRefreshToken(user.id, requestMeta(req));

  setAccessCookie(res, accessToken, ACCESS_TOKEN_TTL_SECONDS);
  setRefreshCookie(res, refresh.token, REFRESH_TOKEN_TTL_SECONDS);

  res.json({ ok: true, user: { id: user.id, email: user.email } });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== "string" || !token) {
    res.status(401).json({ error: "No refresh token." });
    return;
  }

  const check = await checkRefreshToken(token);
  if (!check.ok) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Session expired, please log in again." });
    return;
  }

  const next = await rotateRefreshToken(
    check.refreshTokenId,
    check.userId,
    requestMeta(req),
  );
  const accessToken = await signAccessToken(check.userId);

  setAccessCookie(res, accessToken, ACCESS_TOKEN_TTL_SECONDS);
  setRefreshCookie(res, next.token, REFRESH_TOKEN_TTL_SECONDS);

  res.json({ ok: true });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === "string" && token) {
    await revokeRefreshToken(token);
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(user);
});

/**
 * Self-service profile update: change email and/or password. Always requires
 * the current password, even though the request is already authenticated —
 * this is the standard defense against a hijacked/left-open session being
 * used to silently lock the real owner out.
 */
authRouter.patch("/me", authenticate, async (req, res) => {
  const { currentPassword, email, newPassword } = (req.body ?? {}) as {
    currentPassword?: unknown;
    email?: unknown;
    newPassword?: unknown;
  };

  if (typeof currentPassword !== "string" || !currentPassword) {
    res.status(400).json({ error: "Current password is required." });
    return;
  }

  const nextEmail =
    typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
  const nextPassword =
    typeof newPassword === "string" && newPassword ? newPassword : null;

  if (!nextEmail && !nextPassword) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  if (nextPassword && nextPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    await sleep(FAILURE_DELAY_MS);
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  if (nextEmail && nextEmail !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: nextEmail } });
    if (existing && existing.id !== user.id) {
      res.status(409).json({ error: "That email is already in use." });
      return;
    }
  }

  const data: { email?: string; passwordHash?: string } = {};
  if (nextEmail && nextEmail !== user.email) data.email = nextEmail;
  if (nextPassword) data.passwordHash = await hashPassword(nextPassword);

  const updated = await prisma.user.update({ where: { id: user.id }, data });

  if (nextPassword) {
    // Password changed: kill every other session, then issue a fresh pair
    // for this one so the tab that just did this doesn't get logged out too.
    await revokeAllRefreshTokensForUser(user.id);
    const accessToken = await signAccessToken(user.id);
    const refresh = await issueRefreshToken(user.id, requestMeta(req));
    setAccessCookie(res, accessToken, ACCESS_TOKEN_TTL_SECONDS);
    setRefreshCookie(res, refresh.token, REFRESH_TOKEN_TTL_SECONDS);
  }

  res.json({ ok: true, user: { id: updated.id, email: updated.email } });
});
