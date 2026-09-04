import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE } from "../lib/cookies.js";
import { verifyAccessToken } from "../lib/tokens.js";

/** Gates every non-public route. On failure the frontend is expected to call
 *  /api/auth/refresh and retry once before bouncing to the login page. */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[ACCESS_COOKIE];
  const userId = typeof token === "string" && token ? await verifyAccessToken(token) : null;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
}
