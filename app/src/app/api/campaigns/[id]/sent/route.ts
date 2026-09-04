import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SentBody {
  sentCount?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: SentBody;
  try {
    body = (await req.json()) as SentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw =
    typeof body.sentCount === "string" ? Number(body.sentCount.trim()) : body.sentCount;

  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    !Number.isInteger(raw) ||
    raw < 0
  ) {
    return NextResponse.json(
      { error: "`sentCount` must be an integer of 0 or more." },
      { status: 400 },
    );
  }

  try {
    await prisma.campaign.update({
      where: { id },
      data: { sentCount: raw },
    });
  } catch (err) {
    // P2025 = record to update not found.
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
