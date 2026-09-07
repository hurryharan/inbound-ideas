import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRoute, jsonError } from "@/lib/api-helpers";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await params;
    const existing = await prisma.idea.findUnique({ where: { id } });
    if (!existing) return jsonError("Idea not found", 404);

    const idea = await prisma.idea.update({
      where: { id },
      data: {
        status: "EXPLORING",
        lastExploredAt: new Date(),
        feedback: { create: { signal: "EXPLORE" } },
      },
    });
    return NextResponse.json(idea);
  });
}
