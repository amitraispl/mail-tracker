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

/**
 * A stuck DB connection (e.g. Aiven MySQL under connection pressure) can hang
 * a query forever with nothing thrown and nothing logged. Race it against a
 * timeout so a hang surfaces as a loud 503 instead of a silently dead request.
 */
const DB_TIMEOUT_MS = 8000;
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timed out after ${DB_TIMEOUT_MS}ms: ${label}`)),
        DB_TIMEOUT_MS,
      ),
    ),
  ]);
}

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

  try {
    const user = await withTimeout(
      prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } }),
      "find user",
    );
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      await sleep(FAILURE_DELAY_MS);
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }

    const accessToken = await signAccessToken(user.id);
    const refresh = await withTimeout(
      issueRefreshToken(user.id, requestMeta(req)),
      "issue refresh token",
    );

    setAccessCookie(res, accessToken, ACCESS_TOKEN_TTL_SECONDS);
    setRefreshCookie(res, refresh.token, REFRESH_TOKEN_TTL_SECONDS);

    res.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("[auth/login] failed", error);
    res.status(503).json({ error: "Login is temporarily unavailable. Try again." });
  }
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== "string" || !token) {
    res.status(401).json({ error: "No refresh token." });
    return;
  }

  try {
    const check = await withTimeout(checkRefreshToken(token), "check refresh token");
    if (!check.ok) {
      clearAuthCookies(res);
      res.status(401).json({ error: "Session expired, please log in again." });
      return;
    }

    const next = await withTimeout(
      rotateRefreshToken(check.refreshTokenId, check.userId, requestMeta(req)),
      "rotate refresh token",
    );
    const accessToken = await signAccessToken(check.userId);

    setAccessCookie(res, accessToken, ACCESS_TOKEN_TTL_SECONDS);
    setRefreshCookie(res, next.token, REFRESH_TOKEN_TTL_SECONDS);

    res.json({ ok: true });
  } catch (error) {
    console.error("[auth/refresh] failed", error);
    res.status(503).json({ error: "Session refresh is temporarily unavailable." });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (typeof token === "string" && token) {
      await withTimeout(revokeRefreshToken(token), "revoke refresh token");
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (error) {
    console.error("[auth/logout] failed", error);
    // Clear cookies regardless — client should be able to drop its session
    // even if the DB revoke failed.
    clearAuthCookies(res);
    res.status(503).json({ error: "Logout is temporarily unavailable." });
  }
});

authRouter.get("/me", authenticate, async (req, res) => {
  try {
    const user = await withTimeout(
      prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, email: true },
      }),
      "find user",
    );
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error("[auth/me] failed", error);
    res.status(503).json({ error: "Temporarily unavailable." });
  }
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

  try {
    const user = await withTimeout(
      prisma.user.findUnique({ where: { id: req.userId! } }),
      "find user",
    );
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
      const existing = await withTimeout(
        prisma.user.findUnique({ where: { email: nextEmail } }),
        "check email in use",
      );
      if (existing && existing.id !== user.id) {
        res.status(409).json({ error: "That email is already in use." });
        return;
      }
    }

    const data: { email?: string; passwordHash?: string } = {};
    if (nextEmail && nextEmail !== user.email) data.email = nextEmail;
    if (nextPassword) data.passwordHash = await hashPassword(nextPassword);

    const updated = await withTimeout(
      prisma.user.update({ where: { id: user.id }, data }),
      "update user",
    );

    if (nextPassword) {
      // Password changed: kill every other session, then issue a fresh pair
      // for this one so the tab that just did this doesn't get logged out too.
      await withTimeout(
        revokeAllRefreshTokensForUser(user.id),
        "revoke all refresh tokens",
      );
      const accessToken = await signAccessToken(user.id);
      const refresh = await withTimeout(
        issueRefreshToken(user.id, requestMeta(req)),
        "issue refresh token",
      );
      setAccessCookie(res, accessToken, ACCESS_TOKEN_TTL_SECONDS);
      setRefreshCookie(res, refresh.token, REFRESH_TOKEN_TTL_SECONDS);
    }

    res.json({ ok: true, user: { id: updated.id, email: updated.email } });
  } catch (error) {
    console.error("[auth/patch-me] failed", error);
    res.status(503).json({ error: "Profile update is temporarily unavailable." });
  }
});
