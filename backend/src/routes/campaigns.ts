import { Prisma } from "@prisma/client";
import { Router, type Request } from "express";
import { prisma } from "../db.js";
import { loadCampaign } from "../lib/query.js";
import { newOpenToken, transformHtml } from "../lib/transform.js";

function publicBaseUrl(req: Request): string {
  // Recipients fetch the pixel/redirect from the public host, which is not
  // necessarily the host this request arrived on.
  const configured = process.env.PUBLIC_TRACK_BASE_URL;
  const fallback = `${req.protocol}://${req.get("host")}`;
  return (configured || fallback).replace(/\/+$/, "");
}

/** `sent` is typed by hand, so accept "120" as well as 120; anything else is 0. */
function toSentCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/* ---- POST /api/process ---- */

export const processRouter = Router();

processRouter.post("/process", async (req, res) => {
  const body = (req.body ?? {}) as { name?: unknown; html?: unknown; sentCount?: unknown };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const html = typeof body.html === "string" ? body.html : "";

  if (!name || !html.trim()) {
    res.status(400).json({ error: "Both `name` and `html` are required." });
    return;
  }

  const baseUrl = publicBaseUrl(req);
  const openToken = newOpenToken();
  const { html: processedHtml, links } = transformHtml(html, { baseUrl, openToken });

  const campaign = await prisma.campaign.create({
    data: {
      name,
      openToken,
      sentCount: toSentCount(body.sentCount),
      processedHtml,
      links: {
        create: links.map((link) => ({
          token: link.token,
          originalUrl: link.originalUrl,
          label: link.label,
        })),
      },
    },
    select: { id: true },
  });

  res.json({ id: campaign.id, processedHtml, linkCount: links.length });
});

/* ---- /api/campaigns ---- */

export const campaignsRouter = Router();

campaignsRouter.get("/", async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { opens: true, clicks: true, links: true } } },
  });

  // `_count.opens` is the raw OpenEvent count — the send-load noise
  // correction happens client-side (frontend/src/lib/stats.ts), same as the
  // campaign-detail endpoint.
  res.json(campaigns);
});

campaignsRouter.get("/:id", async (req, res) => {
  const campaign = await loadCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  res.json(campaign);
});

campaignsRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const body = (req.body ?? {}) as { name?: unknown; html?: unknown };

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { openToken: true },
  });
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  const data: Prisma.CampaignUpdateInput = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      res.status(400).json({ error: "Name can't be empty." });
      return;
    }
    data.name = name;
  }

  let linkCount: number | null = null;

  if (typeof body.html === "string" && body.html.trim()) {
    const baseUrl = publicBaseUrl(req);

    // The open pixel keeps its token so existing open history stays valid;
    // only links are rebuilt, so past click history for the old links is
    // deliberately dropped along with them.
    const { html: processedHtml, links } = transformHtml(body.html, {
      baseUrl,
      openToken: campaign.openToken,
    });

    data.processedHtml = processedHtml;
    data.links = {
      create: links.map((link) => ({
        token: link.token,
        originalUrl: link.originalUrl,
        label: link.label,
      })),
    };
    linkCount = links.length;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "Nothing to update." });
    return;
  }

  try {
    if (data.links) {
      await prisma.$transaction([
        prisma.link.deleteMany({ where: { campaignId: id } }),
        prisma.campaign.update({ where: { id }, data }),
      ]);
    } else {
      await prisma.campaign.update({ where: { id }, data });
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Campaign not found." });
      return;
    }
    throw err;
  }

  res.json({ ok: true, linkCount });
});

campaignsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.campaign.delete({ where: { id: req.params.id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Campaign not found." });
      return;
    }
    throw err;
  }
  res.json({ ok: true });
});

campaignsRouter.post("/:id/sent", async (req, res) => {
  const { id } = req.params;
  const body = (req.body ?? {}) as { sentCount?: unknown };

  const raw =
    typeof body.sentCount === "string" ? Number(body.sentCount.trim()) : body.sentCount;

  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    !Number.isInteger(raw) ||
    raw < 0
  ) {
    res.status(400).json({ error: "`sentCount` must be an integer of 0 or more." });
    return;
  }

  try {
    await prisma.campaign.update({ where: { id }, data: { sentCount: raw } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Campaign not found." });
      return;
    }
    throw err;
  }

  res.json({ ok: true });
});
