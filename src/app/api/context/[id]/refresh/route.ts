import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { refreshContextSource } from "@/lib/context/ingest";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const source = await prisma.contextSource.findFirst({ where: { id, userId } });
    if (!source) return jsonError("Context source not found", 404);

    const count = await refreshContextSource(userId, source);
    return NextResponse.json({ documentCount: count });
  });
}
