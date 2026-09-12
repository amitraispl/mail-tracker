import { Router } from "express";
import { prisma } from "../db.js";
import { sendMail } from "../lib/mailer.js";
import { renderForRecipient } from "../lib/personalize.js";

export const sendingRouter = Router();

interface OwnedCampaign {
  id: string;
  name: string;
  subject: string | null;
  openToken: string;
  processedHtml: string | null;
}

// TEMP DIAGNOSTIC LOGGING — see lib/mailer.ts's sendMail(). Remove together.
async function requireCampaign(id: string, userId: string): Promise<OwnedCampaign | null> {
  console.log("Fetching campaign");
  const campaign = await prisma.campaign.findFirst({
    where: { id, userId },
    select: { id: true, name: true, subject: true, openToken: true, processedHtml: true },
  });
  console.log("Campaign fetched");
  return campaign;
}

/** Falls back to the campaign name when no subject override is set. */
function subjectFor(campaign: Pick<OwnedCampaign, "name" | "subject">): string {
  return campaign.subject?.trim() || campaign.name;
}

/* ---- recipient list ---- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailLines(raw: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of raw.split(/\r?\n|,/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const email = line.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      invalid.push(line);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid };
}

sendingRouter.post("/:id/recipients", async (req, res) => {
  const { id } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  const body = (req.body ?? {}) as { emails?: unknown };
  const raw = typeof body.emails === "string" ? body.emails : "";
  const { emails, invalid } = parseEmailLines(raw);

  if (emails.length === 0) {
    res.status(400).json({ error: "No valid email addresses found.", invalid });
    return;
  }

  const { count } = await prisma.recipient.createMany({
    data: emails.map((email) => ({ campaignId: id, email })),
    skipDuplicates: true,
  });

  res.json({ ok: true, created: count, skipped: emails.length - count, invalid });
});

sendingRouter.get("/:id/recipients", async (req, res) => {
  const { id } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  const recipients = await prisma.recipient.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { opens: true, clicks: true } },
      opens: { orderBy: { createdAt: "asc" }, select: { createdAt: true }, take: 1 },
      clicks: {
        select: { createdAt: true, link: { select: { id: true, label: true } } },
      },
    },
  });

  const rows = recipients.map((r) => {
    const clicksByLink = new Map<string, { label: string | null; count: number }>();
    for (const click of r.clicks) {
      const key = click.link.id;
      const entry = clicksByLink.get(key) ?? { label: click.link.label, count: 0 };
      entry.count += 1;
      clicksByLink.set(key, entry);
    }
    return {
      id: r.id,
      email: r.email,
      status: r.status,
      error: r.error,
      isTest: r.isTest,
      sentAt: r.sentAt,
      openCount: r._count.opens,
      firstOpenAt: r.opens[0]?.createdAt ?? null,
      clickCount: r._count.clicks,
      clickedLinks: Array.from(clicksByLink.values()),
    };
  });

  const real = rows.filter((r) => !r.isTest);
  const summary = {
    pending: real.filter((r) => r.status === "pending").length,
    sending: real.filter((r) => r.status === "sending").length,
    sent: real.filter((r) => r.status === "sent").length,
    failed: real.filter((r) => r.status === "failed").length,
  };

  res.json({ recipients: rows, summary });
});

/** Full per-recipient detail for the recipient-detail modal: delivery
 *  status/error plus the actual open/click event timeline, not just
 *  aggregated counts. */
sendingRouter.get("/:id/recipients/:recipientId", async (req, res) => {
  const { id, recipientId } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  const recipient = await prisma.recipient.findFirst({
    where: { id: recipientId, campaignId: id },
    include: {
      opens: { orderBy: { createdAt: "asc" }, select: { createdAt: true } },
      clicks: {
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, link: { select: { label: true, originalUrl: true } } },
      },
    },
  });
  if (!recipient) {
    res.status(404).json({ error: "Recipient not found." });
    return;
  }

  res.json({
    id: recipient.id,
    email: recipient.email,
    status: recipient.status,
    error: recipient.error,
    isTest: recipient.isTest,
    sentAt: recipient.sentAt,
    opens: recipient.opens.map((o) => ({ createdAt: o.createdAt })),
    clicks: recipient.clicks.map((c) => ({
      createdAt: c.createdAt,
      linkLabel: c.link.label,
      linkUrl: c.link.originalUrl,
    })),
  });
});

sendingRouter.delete("/:id/recipients/:recipientId", async (req, res) => {
  const { id, recipientId } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  const { count } = await prisma.recipient.deleteMany({
    where: { id: recipientId, campaignId: id },
  });
  if (count === 0) {
    res.status(404).json({ error: "Recipient not found." });
    return;
  }
  res.json({ ok: true });
});

/* ---- sending ---- */

sendingRouter.post("/:id/send-test", async (req, res) => {
  console.log("Request received"); // TEMP DIAGNOSTIC LOGGING — see lib/mailer.ts
  const { id } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  if (!campaign.processedHtml) {
    res.status(400).json({ error: "No tracked HTML stored for this campaign." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { email: true },
  });
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  // Always a distinct row from any real recipient at the same address (see
  // schema.prisma's comment on the [campaignId, email, isTest] unique key) —
  // a test send must never merge into, or flip isTest off on, a real row.
  const recipient = await prisma.recipient.upsert({
    where: {
      campaignId_email_isTest: { campaignId: id, email: user.email.toLowerCase(), isTest: true },
    },
    update: {},
    create: { campaignId: id, email: user.email.toLowerCase(), isTest: true },
  });

  try {
    const html = renderForRecipient(campaign.processedHtml, recipient.id);
    await sendMail(user.email, `[Test] ${subjectFor(campaign)}`, html);
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { status: "sent", sentAt: new Date(), error: null },
    });
    res.json({ ok: true, recipientId: recipient.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed.";
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { status: "failed", error: message },
    });
    res.status(502).json({ error: message });
  }
});

/** Sends to one recipient and settles their row + the campaign's live
 *  `sentCount` accordingly. Shared by the bulk loop and the single-recipient
 *  send route below — same outcome either way, just a batch of one. */
async function sendToOne(
  campaignId: string,
  html: string,
  subject: string,
  recipient: { id: string; email: string },
): Promise<boolean> {
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { status: "sending" },
  });
  try {
    const personalized = renderForRecipient(html, recipient.id);
    await sendMail(recipient.email, subject, personalized);
    await prisma.$transaction([
      prisma.recipient.update({
        where: { id: recipient.id },
        data: { status: "sent", sentAt: new Date(), error: null },
      }),
      // The only writer of this field from here on — a live count of
      // actual sends, not a value anyone enters manually.
      prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      }),
    ]);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed.";
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { status: "failed", error: message },
    });
    return false;
  }
}

async function markFirstSentIfUnset(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { firstSentAt: true },
  });
  if (!campaign?.firstSentAt) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { firstSentAt: new Date() },
    });
  }
}

/** Sequential, not parallel: shared mailbox, shared rate limit — every
 *  campaign's send loop goes through the same connection pool one at a time. */
async function runSendLoop(campaignId: string, html: string, subject: string) {
  const pending = await prisma.recipient.findMany({
    where: { campaignId, status: "pending", isTest: false },
    select: { id: true, email: true },
  });

  for (const recipient of pending) {
    await sendToOne(campaignId, html, subject, recipient);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

/** Send to exactly one pending recipient — the single-address counterpart to
 *  bulk `/send` below, for "just resend/send this one" without touching the
 *  rest of the list. */
sendingRouter.post("/:id/recipients/:recipientId/send", async (req, res) => {
  console.log("Request received"); // TEMP DIAGNOSTIC LOGGING — see lib/mailer.ts
  const { id, recipientId } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  if (!campaign.processedHtml) {
    res.status(400).json({ error: "No tracked HTML stored for this campaign." });
    return;
  }

  const recipient = await prisma.recipient.findFirst({
    where: { id: recipientId, campaignId: id, isTest: false },
    select: { id: true, email: true },
  });
  if (!recipient) {
    res.status(404).json({ error: "Recipient not found." });
    return;
  }

  await markFirstSentIfUnset(id);
  const ok = await sendToOne(id, campaign.processedHtml, subjectFor(campaign), recipient);
  if (!ok) {
    res.status(502).json({ error: "Send failed." });
    return;
  }
  res.json({ ok: true });
});

sendingRouter.post("/:id/send", async (req, res) => {
  console.log("Request received"); // TEMP DIAGNOSTIC LOGGING — see lib/mailer.ts
  const { id } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }
  if (!campaign.processedHtml) {
    res.status(400).json({ error: "No tracked HTML stored for this campaign." });
    return;
  }

  const pendingCount = await prisma.recipient.count({
    where: { campaignId: id, status: "pending", isTest: false },
  });
  if (pendingCount === 0) {
    res.status(400).json({ error: "No pending recipients to send to." });
    return;
  }

  await markFirstSentIfUnset(id);

  // Fire-and-forget: the loop runs after this response, progress is polled
  // via GET /:id/recipients' summary counts.
  void runSendLoop(id, campaign.processedHtml, subjectFor(campaign)).catch((err) => {
    console.error(`[send] campaign ${id} send loop crashed`, err);
  });

  res.status(202).json({ ok: true, queued: pendingCount });
});

/* ---- activity feed ---- */

sendingRouter.get("/:id/activity", async (req, res) => {
  const { id } = req.params;
  const campaign = await requireCampaign(id, req.userId!);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found." });
    return;
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  const [opens, clicks] = await Promise.all([
    prisma.openEvent.findMany({
      where: { campaignId: id, recipient: { isTest: false } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { createdAt: true, recipient: { select: { email: true } } },
    }),
    prisma.clickEvent.findMany({
      where: { campaignId: id, recipient: { isTest: false } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        createdAt: true,
        recipient: { select: { email: true } },
        link: { select: { label: true } },
      },
    }),
  ]);

  const feed = [
    ...opens
      .filter((o) => o.recipient)
      .map((o) => ({
        type: "open" as const,
        email: o.recipient!.email,
        linkLabel: null as string | null,
        createdAt: o.createdAt,
      })),
    ...clicks
      .filter((c) => c.recipient)
      .map((c) => ({
        type: "click" as const,
        email: c.recipient!.email,
        linkLabel: c.link.label,
        createdAt: c.createdAt,
      })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  res.json({ feed });
});
