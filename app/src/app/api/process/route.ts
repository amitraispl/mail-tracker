import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { newOpenToken, transformHtml } from "@/lib/transform";

export const dynamic = "force-dynamic";

interface ProcessBody {
  name?: unknown;
  html?: unknown;
  sentCount?: unknown;
}

/** `sent` is typed by hand, so accept "120" as well as 120; anything else is 0. */
function toSentCount(value: unknown): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

export async function POST(req: NextRequest) {
  let body: ProcessBody;
  try {
    body = (await req.json()) as ProcessBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const html = typeof body.html === "string" ? body.html : "";

  if (!name || !html.trim()) {
    return NextResponse.json(
      { error: "Both `name` and `html` are required." },
      { status: 400 },
    );
  }

  // Recipients fetch the pixel and redirect from the public host, which is not
  // necessarily the host this request arrived on.
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin).replace(
    /\/+$/,
    "",
  );

  const openToken = newOpenToken();
  const { html: processedHtml, links } = transformHtml(html, {
    baseUrl,
    openToken,
  });

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

  return NextResponse.json({
    id: campaign.id,
    processedHtml,
    linkCount: links.length,
  });
}
