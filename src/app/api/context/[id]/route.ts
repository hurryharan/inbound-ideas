import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";

const updateContextSourceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  instructions: z.string().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await prisma.contextSource.findFirst({ where: { id, userId } });
    if (!existing) return jsonError("Context source not found", 404);

    const body = updateContextSourceSchema.parse(await req.json());
    const source = await prisma.contextSource.update({ where: { id }, data: body });
    return NextResponse.json(source);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await prisma.contextSource.findFirst({ where: { id, userId } });
    if (!existing) return jsonError("Context source not found", 404);

    await prisma.contextSource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
