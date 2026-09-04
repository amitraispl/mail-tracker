import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { loadCampaign } from "@/lib/query";
import { transformHtml } from "@/lib/transform";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const campaign = await loadCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json(campaign);
}

interface PatchBody {
  name?: unknown;
  html?: unknown;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { openToken: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const data: Prisma.CampaignUpdateInput = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Name can't be empty." },
        { status: 400 },
      );
    }
    data.name = name;
  }

  let linkCount: number | null = null;

  if (typeof body.html === "string" && body.html.trim()) {
    // Recipients fetch the pixel/redirect from the public host, not
    // necessarily the host this request arrived on.
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin).replace(
      /\/+$/,
      "",
    );

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
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, linkCount });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.campaign.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
