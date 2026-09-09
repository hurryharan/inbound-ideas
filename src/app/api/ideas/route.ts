import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import type { Prisma, IdeaStatus } from "@prisma/client";
import { dedupeBatch } from "@/lib/sources/dedup";

export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const url = req.nextUrl;
    const statusParam = url.searchParams.get("status");
    const sourceId = url.searchParams.get("sourceId");
    const topic = url.searchParams.get("topic");
    const search = url.searchParams.get("search");
    const sort = url.searchParams.get("sort") ?? "score";

    const where: Prisma.IdeaWhereInput = {};
    if (statusParam) {
      const statuses = statusParam.split(",") as IdeaStatus[];
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }
    if (topic) where.topics = { has: topic };
    if (sourceId) where.sourceItems = { some: { sourceItem: { sourceId } } };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { observation: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.IdeaOrderByWithRelationInput =
      sort === "recent" ? { createdAt: "desc" } : { score: "desc" };

    const ideas = await prisma.idea.findMany({
      where,
      orderBy,
      include: {
        sourceItems: { include: { sourceItem: { include: { source: true } } } },
        contextDocuments: { include: { contextDocument: true } },
      },
    });

    const uniqueIdeas = dedupeBatch(
      ideas.map((idea) => ({
        idea,
        externalId: idea.id,
        url: idea.sourceItems[0]?.sourceItem.url,
        contentHash: idea.sourceItems[0]?.sourceItem.contentHash ?? idea.id,
      })),
      { externalIds: new Set(), urls: new Set(), contentHashes: new Set() }
    );

    return NextResponse.json(uniqueIdeas.map(({ idea }) => idea));
  });
}
