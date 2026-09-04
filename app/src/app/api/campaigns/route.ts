import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { opens: true, clicks: true, links: true } },
    },
  });

  return NextResponse.json(campaigns);
}
