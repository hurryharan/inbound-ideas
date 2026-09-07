import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { parseLinkedInImport } from "@/lib/sources/linkedin";
import { ingestNormalizedItems } from "@/lib/sources/ingest";

// LinkedIn saved-post import (PRD section 13): CSV/JSON upload since there
// is no stable public API for saved posts. Body is the raw file contents.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const source = await prisma.source.findFirst({ where: { id, userId } });
    if (!source) return jsonError("Source not found", 404);
    if (source.type !== "LINKEDIN_SAVED_POSTS") return jsonError("Source is not a LinkedIn import source", 422);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Missing file", 422);

    const text = await file.text();
    const items = parseLinkedInImport(file.name, text);
    if (items.length === 0) return jsonError("No importable rows found in file", 422);

    const result = await ingestNormalizedItems(userId, source, items);

    await prisma.source.update({
      where: { id: source.id },
      data: { config: { ...(source.config as object), lastImportFilename: file.name } },
    });

    return NextResponse.json(result);
  });
}
