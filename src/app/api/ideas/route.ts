import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";
import type { Prisma, IdeaStatus } from "@prisma/client";
import { dedupeBatch } from "@/lib/sources/dedup";
import { getCurrentUserId } from "@/lib/current-user";
import { dedupeIdeasForUser } from "@/lib/ideas/dedup";
import { z } from "zod";

const clearFunnelSchema = z.object({ scope: z.literal("FUNNEL") });

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

export async function DELETE(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    clearFunnelSchema.parse(await req.json());
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const activeIdeas = await tx.idea.findMany({
        where: {
          status: { in: ["NEW", "SURFACED"] },
        },
        select: {
          id: true,
          sourceItems: {
            where: { sourceItem: { source: { userId } } },
            select: { sourceItemId: true },
          },
        },
      });
      const ideaIds = activeIdeas.map((idea) => idea.id);
      const sourceItemIds = [...new Set(activeIdeas.flatMap((idea) => idea.sourceItems.map((link) => link.sourceItemId)))];

      const deleted = ideaIds.length ? await tx.idea.deleteMany({ where: { id: { in: ideaIds } } }) : { count: 0 };
      const deletedSourceItems = sourceItemIds.length
        ? await tx.sourceItem.deleteMany({ where: { id: { in: sourceItemIds }, ideaLinks: { none: {} } } })
        : { count: 0 };

      return { deletedCount: deleted.count, deletedSourceItemCount: deletedSourceItems.count };
    });
  });
}

export async function POST() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    return { deduplicatedCount: await dedupeIdeasForUser(userId) };
  });
}
