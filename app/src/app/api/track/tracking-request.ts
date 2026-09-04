import { headers } from "next/headers";

export interface TrackingContext {
  /** First hop of x-forwarded-for — the client as seen by the edge proxy. */
  ip: string | null;
  userAgent: string | null;
  /** Optional `?r=` recipient identifier the sender embedded in the URL. */
  recipientRef: string | null;
}

/** Next 15: headers() is async. */
export async function readTrackingContext(
  searchParams: URLSearchParams,
): Promise<TrackingContext> {
  const h = await headers();

  const forwardedFor = h.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || h.get("x-real-ip") || null;

  const recipientRef = searchParams.get("r")?.trim() || null;

  return {
    ip: ip || null,
    userAgent: h.get("user-agent"),
    recipientRef,
  };
}
