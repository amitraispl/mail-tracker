import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readTrackingContext } from "../../tracking-request";

// A tracking hit must never be served from a cache.
export const dynamic = "force-dynamic";

const NO_STORE = "no-store, no-cache, must-revalidate, private";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Next 15: params is a Promise.
  const { token } = await params;
  const searchParams = request.nextUrl.searchParams;

  let link: {
    id: string;
    campaignId: string;
    originalUrl: string;
  } | null = null;

  try {
    link = await prisma.link.findUnique({
      where: { token },
      select: { id: true, campaignId: true, originalUrl: true },
    });

    if (link) {
      const { ip, userAgent, recipientRef } =
        await readTrackingContext(searchParams);

      await prisma.clickEvent.create({
        data: {
          linkId: link.id,
          campaignId: link.campaignId,
          recipientRef,
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
  const destination =
    safeDestination(link?.originalUrl) ?? safeDestination(searchParams.get("u"));

  if (!destination) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": NO_STORE },
    });
  }

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}
