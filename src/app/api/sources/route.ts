import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { extractSpreadsheetId } from "@/lib/sources/google-sheet";
import type { SourceConfig } from "@/lib/sources/types";

// Every Source is a Google Sheet (PRD discussion: LinkedIn/Twitter/etc.
// exports get pasted into a sheet periodically, this just reads it —
// there's no separate connector type to pick). Column mapping is
// auto-detected on first refresh, so it's not required here.
const createSourceSchema = z.object({
  name: z.string().min(1),
  config: z.object({
    spreadsheetUrl: z.string().min(1),
    sheetName: z.string().optional().default(""),
  }),
  tags: z.array(z.string()).default([]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  refreshFrequencyMinutes: z.number().int().positive().default(1440),
  enabled: z.boolean().default(true),
});

export async function GET() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const sources = await prisma.source.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    return sources;
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const body = createSourceSchema.parse(await req.json());

    const config: SourceConfig = {
      spreadsheetId: extractSpreadsheetId(body.config.spreadsheetUrl),
      spreadsheetUrl: body.config.spreadsheetUrl,
      sheetName: body.config.sheetName,
    };

    const source = await prisma.source.create({
      data: {
        name: body.name,
        tags: body.tags,
        priority: body.priority,
        refreshFrequencyMinutes: body.refreshFrequencyMinutes,
        enabled: body.enabled,
        config: config as object,
        userId,
      },
    });
    return NextResponse.json(source, { status: 201 });
  });
}
