import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { extractSpreadsheetId } from "@/lib/sources/google-sheet";
import type { ColumnMapping, SourceConfig } from "@/lib/sources/types";

const columnMappingSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  topic: z.string().optional(),
  status: z.string().optional(),
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  config: z
    .object({
      spreadsheetUrl: z.string().min(1).optional(),
      sheetName: z.string().min(1).optional(),
      // Partial: only the fields being remapped need to be sent (see
      // PRD section 12 — "if the sheet changes structure, the user
      // should be able to remap columns").
      columnMapping: columnMappingSchema.optional(),
    })
    .optional(),
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

    let config: SourceConfig | undefined;
    if (body.config) {
      const existingConfig = existing.config as unknown as SourceConfig;
      config = {
        ...existingConfig,
        ...(body.config.spreadsheetUrl ? { spreadsheetUrl: body.config.spreadsheetUrl, spreadsheetId: extractSpreadsheetId(body.config.spreadsheetUrl) } : {}),
        ...(body.config.sheetName ? { sheetName: body.config.sheetName } : {}),
        ...(body.config.columnMapping
          ? { columnMapping: { ...existingConfig.columnMapping, ...body.config.columnMapping } as ColumnMapping }
          : {}),
      };
    }

    const { config: _bodyConfig, ...rest } = body;
    void _bodyConfig;

    const source = await prisma.source.update({
      where: { id },
      data: { ...rest, ...(config ? { config: config as object } : {}) },
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
