import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { extractDriveFileId } from "@/lib/google/drive";

const createContextSourceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["GOOGLE_DRIVE_DOCUMENT", "GOOGLE_DRIVE_FOLDER", "GOOGLE_SHEET"]),
  url: z.string().min(1),
  tags: z.array(z.string()).default([]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  instructions: z.string().optional(),
  enabled: z.boolean().default(true),
});

export async function GET() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const sources = await prisma.contextSource.findMany({
      where: { userId },
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: "desc" },
    });
    return sources;
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const body = createContextSourceSchema.parse(await req.json());
    const externalId = extractDriveFileId(body.url);

    const source = await prisma.contextSource.create({
      data: { ...body, externalId, userId },
    });
    return NextResponse.json(source, { status: 201 });
  });
}
