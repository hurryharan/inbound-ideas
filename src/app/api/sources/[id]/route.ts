import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { extractSpreadsheetId } from "@/lib/sources/google-sheet";

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  refreshFrequencyMinutes: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const body = updateSourceSchema.parse(await req.json());

    const existing = await prisma.source.findFirst({ where: { id, userId } });
    if (!existing) return jsonError("Source not found", 404);

    let config = body.config;
    if (config && existing.type === "GOOGLE_SHEET" && typeof config.spreadsheetUrl === "string") {
      config = { ...config, spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl) };
    }

    const source = await prisma.source.update({
      where: { id },
      data: { ...body, config: config as object | undefined },
    });
    return NextResponse.json(source);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await prisma.source.findFirst({ where: { id, userId } });
    if (!existing) return jsonError("Source not found", 404);

    await prisma.source.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
