import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { extractSpreadsheetId } from "@/lib/sources/google-sheet";

const createSourceSchema = z.object({
  type: z.enum(["LINKEDIN_SAVED_POSTS", "GOOGLE_SHEET", "GOOGLE_DRIVE_DOCUMENT", "GOOGLE_DRIVE_FOLDER"]),
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
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

    let config = body.config;
    if (body.type === "GOOGLE_SHEET" && typeof config.spreadsheetUrl === "string") {
      config = { ...config, spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl) };
    }

    const source = await prisma.source.create({
      data: { ...body, config: config as object, userId },
    });
    return NextResponse.json(source, { status: 201 });
  });
}
