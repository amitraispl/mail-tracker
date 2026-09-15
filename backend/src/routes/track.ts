import { Router, type Request } from "express";
import { prisma } from "../db.js";

export const trackRouter = Router();

const NO_STORE = "no-store, no-cache, must-revalidate, private";

interface TrackingContext {
  ip: string | null;
  userAgent: string | null;
  recipientId: string | null;
}

/** Optional `?r=` recipient id the sender embedded in the URL (see
 *  lib/mailer.ts's per-recipient personalization). Not trusted blindly —
 *  callers still validate it against the Recipient row before logging it. */
function readTrackingContext(req: Request): TrackingContext {
  const forwardedFor = req.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() || req.get("x-real-ip") || req.ip || null;
  const r = req.query.r;
  const recipientId = typeof r === "string" ? r.trim() || null : null;
  return { ip: ip || null, userAgent: req.get("user-agent") ?? null, recipientId };
}

/* ---- GET /api/track/open/:token — 1x1 pixel ---- */

const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL = Buffer.from(PIXEL_BASE64, "base64");

trackRouter.get("/open/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { openToken: token },
      select: { id: true },
    });

    if (campaign) {
      const { ip, userAgent, recipientId: candidateId } = readTrackingContext(req);
      // Don't trust `r=` blindly — a forged/stale id from another campaign
      // must never attribute an open to the wrong recipient.
      const recipientId = candidateId
        ? (
            await prisma.recipient.findFirst({
              where: { id: candidateId, campaignId: campaign.id },
              select: { id: true },
            })
          )?.id ?? null
        : null;
      await prisma.openEvent.create({
        data: { campaignId: campaign.id, recipientId, ip, userAgent },
      });
    }
  } catch (error) {
    // An unknown token or a DB blip must never break the recipient's email:
    // log it and still hand back the pixel.
    console.error("[track/open] failed to log open", error);
  }

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(PIXEL.byteLength),
    "Cache-Control": NO_STORE,
    Pragma: "no-cache",
    Expires: "0",
  });
  res.status(200).send(PIXEL);
});

/* ---- GET /api/track/click/:token — 302 redirect ---- */

/** Only absolute http(s) destinations are allowed — no javascript:, data:, etc. */
function safeDestination(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

trackRouter.get("/click/:token", async (req, res) => {
  const { token } = req.params;

  let link: { id: string; campaignId: string; originalUrl: string } | null = null;

  try {
    link = await prisma.link.findUnique({
      where: { token },
      select: { id: true, campaignId: true, originalUrl: true },
    });

    if (link) {
      const { ip, userAgent, recipientId: candidateId } = readTrackingContext(req);
      const recipientId = candidateId
        ? (
            await prisma.recipient.findFirst({
              where: { id: candidateId, campaignId: link.campaignId },
              select: { id: true },
            })
          )?.id ?? null
        : null;
      await prisma.clickEvent.create({
        data: {
          linkId: link.id,
          campaignId: link.campaignId,
          recipientId,
          ip,
          userAgent,
        },
      });
    }
  } catch (error) {
    // Logging must never cost the recipient their click.
    console.error("[track/click] failed to log click", error);
  }

  // Prefer the stored URL: `u=` is attacker-controllable, so trusting it first
  // would turn this route into an open redirect.
  const uParam = typeof req.query.u === "string" ? req.query.u : null;
  const destination = safeDestination(link?.originalUrl) ?? safeDestination(uParam);

  if (!destination) {
    res.status(404).set("Cache-Control", NO_STORE).send("Not found");
    return;
  }

  res.set("Cache-Control", NO_STORE);
  res.redirect(302, destination);
});
