import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readTrackingContext } from "../../tracking-request";

// A tracking hit must never be served from a cache.
export const dynamic = "force-dynamic";

/** 1x1 transparent GIF. */
const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL = Buffer.from(PIXEL_BASE64, "base64");

const NO_STORE = "no-store, no-cache, must-revalidate, private";

function pixelResponse(): NextResponse {
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": NO_STORE,
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Next 15: params is a Promise.
  const { token } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { openToken: token },
      select: { id: true },
    });

    if (campaign) {
      const { ip, userAgent, recipientRef } = await readTrackingContext(
        request.nextUrl.searchParams,
      );

      await prisma.openEvent.create({
        data: { campaignId: campaign.id, recipientRef, ip, userAgent },
      });
    }
  } catch (error) {
    // An unknown token or a DB blip must never break the recipient's email:
    // log it and still hand back the pixel.
    console.error("[track/open] failed to log open", error);
  }

  return pixelResponse();
}
