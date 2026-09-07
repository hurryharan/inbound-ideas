import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRoute, jsonError } from "@/lib/api-helpers";

const updateSessionSchema = z.object({
  status: z.enum(["STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]).optional(),
  notes: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await params;
    const session = await prisma.session.findUnique({
      where: { id },
      include: { idea: true, llmProvider: { select: { name: true, kind: true } } },
    });
    if (!session) return jsonError("Session not found", 404);
    return NextResponse.json(session);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await params;
    const existing = await prisma.session.findUnique({ where: { id } });
    if (!existing) return jsonError("Session not found", 404);

    const body = updateSessionSchema.parse(await req.json());
    const session = await prisma.session.update({ where: { id }, data: body });

    if (body.status === "COMPLETED") {
      await prisma.idea.update({ where: { id: session.ideaId }, data: { status: "EXPLORED" } });
    }

    return NextResponse.json(session);
  });
}
