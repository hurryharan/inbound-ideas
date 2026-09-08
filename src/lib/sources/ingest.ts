import { prisma } from "@/lib/prisma";
import type { NormalizedItem, SourceConfig } from "./types";
import { contentHash, dedupeBatch, type ExistingKeys } from "./dedup";
import { fetchGoogleSheetItems } from "./google-sheet";
import { generateIdeasForItems } from "@/lib/ideas/pipeline";
import type { Prisma, Source } from "@prisma/client";

/**
 * Persists normalized+deduped items for a source and triggers idea
 * generation for anything new (PRD section 29: fetch → normalize →
 * dedupe → store → generate ideas → available in Inbox).
 */
export async function ingestNormalizedItems(
  userId: string,
  source: Source,
  rawItems: NormalizedItem[]
): Promise<{ createdCount: number; ideaCount: number }> {
  const existingItems = await prisma.sourceItem.findMany({
    where: { sourceId: source.id },
    select: { externalId: true, url: true, contentHash: true },
  });

  const existing: ExistingKeys = {
    externalIds: new Set(existingItems.map((i) => i.externalId)),
    urls: new Set(existingItems.map((i) => i.url).filter((u): u is string => Boolean(u))),
    contentHashes: new Set(existingItems.map((i) => i.contentHash)),
  };

  const candidates = rawItems.map((item) => ({ ...item, hash: contentHash(item.content) }));
  const deduped = dedupeBatch(
    candidates.map((c) => ({ externalId: c.externalId, url: c.url, contentHash: c.hash })),
    existing
  );
  const toCreate = candidates.filter((c) => deduped.some((d) => d.externalId === c.externalId));

  if (toCreate.length === 0) {
    await prisma.source.update({ where: { id: source.id }, data: { lastRefreshedAt: new Date() } });
    return { createdCount: 0, ideaCount: 0 };
  }

  const created = await prisma.$transaction(
    toCreate.map((item) =>
      prisma.sourceItem.create({
        data: {
          sourceId: source.id,
          externalId: item.externalId,
          title: item.title,
          content: item.content,
          url: item.url,
          author: item.author,
          contentHash: item.hash,
          metadata: item.metadata as object,
          createdAt: item.createdAt,
        },
      })
    )
  );

  await prisma.source.update({ where: { id: source.id }, data: { lastRefreshedAt: new Date() } });

  const ideaCount = await generateIdeasForItems(
    userId,
    created.map((item) => ({ ...item, source }))
  );

  return { createdCount: created.length, ideaCount };
}

/**
 * Fetches a source's sheet, persists any newly-detected column mapping back
 * onto the source (so it's visible/editable in Settings), and ingests the
 * result.
 */
export async function refreshSource(
  userId: string,
  source: Source
): Promise<{ createdCount: number; ideaCount: number }> {
  const config = source.config as unknown as SourceConfig;
  const { items, resolvedMapping } = await fetchGoogleSheetItems(userId, config);

  if (JSON.stringify(resolvedMapping) !== JSON.stringify(config.columnMapping ?? {})) {
    const updatedConfig: SourceConfig = { ...config, columnMapping: resolvedMapping };
    await prisma.source.update({
      where: { id: source.id },
      data: { config: updatedConfig as unknown as Prisma.InputJsonValue },
    });
  }

  return ingestNormalizedItems(userId, source, items);
}
