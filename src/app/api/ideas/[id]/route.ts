import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRoute, jsonError } from "@/lib/api-helpers";

const FEEDBACK_STATUS_MAP: Record<string, "EXPLORING" | "PARKED" | "ARCHIVED" | undefined> = {
  EXPLORE: "EXPLORING",
  PARK: "PARKED",
  ARCHIVE: "ARCHIVED",
};

const updateIdeaSchema = z.object({
  status: z.enum(["NEW", "SURFACED", "EXPLORING", "EXPLORED", "PARKED", "ARCHIVED"]).optional(),
  feedback: z.enum(["INTERESTING", "NOT_INTERESTING", "EXPLORE", "PARK", "ARCHIVE"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await params;
    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        sourceItems: { include: { sourceItem: { include: { source: true } } } },
        contextDocuments: { include: { contextDocument: true } },
        sessions: { orderBy: { startedAt: "desc" } },
        feedback: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!idea) return jsonError("Idea not found", 404);
    return NextResponse.json(idea);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = updateIdeaSchema.parse(await req.json());

    const existing = await prisma.idea.findUnique({ where: { id } });
    if (!existing) return jsonError("Idea not found", 404);

    const status = body.status ?? (body.feedback ? FEEDBACK_STATUS_MAP[body.feedback] : undefined);

    const idea = await prisma.idea.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(body.feedback ? { feedback: { create: { signal: body.feedback } } } : {}),
      },
    });
    return NextResponse.json(idea);
  });
}
