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

/** One structured line per hit, success or not — this is the only record of
 *  a tracking request ever reaching this process at all. Without it, a
 *  request that never arrives (blocked/rewritten upstream) and a request
 *  that arrives but hits an unknown token look identical from the outside:
 *  both just show up as "no event in the DB." Plain console.log/warn/error
 *  on purpose — no logging library, Render/any host's log viewer already
 *  captures stdout/stderr, and this app has no other logging infra to match. */
function logTrackingHit(
  kind: "open" | "click",
  fields: Record<string, string | number | boolean | null>,
): void {
  const parts = Object.entries(fields)
    .map(([k, v]) => `${k}=${v === null ? "-" : v}`)
    .join(" ");
  console.log(`[track/${kind}] ${parts}`);
}

/* ---- GET /api/track/open/:token — 1x1 pixel ---- */

const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL = Buffer.from(PIXEL_BASE64, "base64");

trackRouter.get("/open/:token", async (req, res) => {
  const { token } = req.params;
  const { ip, userAgent, recipientId: candidateId } = readTrackingContext(req);

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { openToken: token },
      select: { id: true },
    });

    if (!campaign) {
      logTrackingHit("open", { token, result: "unknown_token", ip });
    } else {
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
      logTrackingHit("open", {
        token,
        result: "logged",
        campaignId: campaign.id,
        recipientId,
        rParamPresent: candidateId !== null,
        ip,
      });
    }
  } catch (error) {
    // An unknown token or a DB blip must never break the recipient's email:
    // log it and still hand back the pixel.
    console.error(`[track/open] token=${token} result=error ip=${ip}`, error);
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
  const { ip, userAgent, recipientId: candidateId } = readTrackingContext(req);

  let link: { id: string; campaignId: string; originalUrl: string } | null = null;
  let loggedEvent = false;

  try {
    link = await prisma.link.findUnique({
      where: { token },
      select: { id: true, campaignId: true, originalUrl: true },
    });

    if (!link) {
      logTrackingHit("click", { token, result: "unknown_token", ip, userAgent: userAgent ?? "-" });
    } else {
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
      loggedEvent = true;
      logTrackingHit("click", {
        token,
        result: "logged",
        linkId: link.id,
        campaignId: link.campaignId,
        recipientId,
        rParamPresent: candidateId !== null,
        ip,
      });
    }
  } catch (error) {
    // Logging must never cost the recipient their click.
    console.error(`[track/click] token=${token} result=error ip=${ip}`, error);
  }

  // Prefer the stored URL: `u=` is attacker-controllable, so trusting it first
  // would turn this route into an open redirect.
  const uParam = typeof req.query.u === "string" ? req.query.u : null;
  const destination = safeDestination(link?.originalUrl) ?? safeDestination(uParam);

  if (!destination) {
    logTrackingHit("click", { token, result: "no_destination", ip });
    res.status(404).set("Cache-Control", NO_STORE).send("Not found");
    return;
  }

  // A click that redirects fine but was never logged above (unknown token,
  // or the DB call threw) is exactly the "recipient saw nothing wrong but
  // it's missing from stats" case — call it out explicitly so it's
  // greppable on its own, separate from the two lines above that already
  // explain *why* it wasn't logged.
  if (!loggedEvent) {
    console.warn(
      `[track/click] token=${token} result=redirected_without_logging destination=${destination} ip=${ip}`,
    );
  }

  res.set("Cache-Control", NO_STORE);
  res.redirect(302, destination);
});
