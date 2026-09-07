import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { refreshSource } from "@/lib/sources/ingest";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const source = await prisma.source.findFirst({ where: { id, userId } });
    if (!source) return jsonError("Source not found", 404);

    const result = await refreshSource(userId, source);
    return NextResponse.json(result);
  });
}
