import { prisma } from "@/lib/prisma";
import type { NormalizedItem, SourceConfig } from "./types";
import { canonicalizeUrl, contentHash, dedupeBatch, type ExistingKeys } from "./dedup";
import { fetchGoogleSheetItems } from "./google-sheet";
import { generateIdeasForItems } from "@/lib/ideas/pipeline";
import type { Prisma, Source } from "@prisma/client";

/**
 * Persists normalized+deduped items for a source and triggers idea
 * generation for anything new (PRD section 29: fetch → normalize →
 * dedupe → store → generate ideas → available in the Ideas funnel).
 */
export async function ingestNormalizedItems(
  userId: string,
  source: Source,
  rawItems: NormalizedItem[]
): Promise<{ createdCount: number; ideaCount: number }> {
  const candidates = rawItems.map((item) => ({ ...item, contentHash: contentHash(item.content) }));
  const created = await prisma.$transaction(async (tx) => {
    // Sources are refreshed concurrently from the Ideas funnel. A per-user
    // advisory lock makes the global identity check and writes atomic.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const existingItems = await tx.sourceItem.findMany({
      where: { source: { userId } },
      select: { externalId: true, url: true, contentHash: true },
    });
    const existing: ExistingKeys = {
      externalIds: new Set(existingItems.map((item) => item.externalId)),
      urls: new Set(existingItems.map((item) => canonicalizeUrl(item.url)).filter((url): url is string => Boolean(url))),
      contentHashes: new Set(existingItems.map((item) => item.contentHash)),
    };
    const newItems = dedupeBatch(candidates, existing);

    return Promise.all(
      newItems.map((item) =>
        tx.sourceItem.create({
          data: {
            sourceId: source.id,
            externalId: item.externalId,
            title: item.title,
            content: item.content,
            url: item.url,
            author: item.author,
            contentHash: item.contentHash,
            metadata: item.metadata as object,
            createdAt: item.createdAt,
          },
        })
      )
    );
  });

  await prisma.source.update({ where: { id: source.id }, data: { lastRefreshedAt: new Date() } });

  if (created.length === 0) return { createdCount: 0, ideaCount: 0 };

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
  const { items, resolvedMapping, sheetName: resolvedSheetName, sheetNames: resolvedSheetNames, sheetTabs } = await fetchGoogleSheetItems(userId, config);

  const needsConfigUpdate =
    JSON.stringify(resolvedMapping) !== JSON.stringify(config.columnMapping ?? {}) ||
    resolvedSheetName !== config.sheetName ||
    JSON.stringify(resolvedSheetNames) !== JSON.stringify(config.sheetNames ?? [config.sheetName]) ||
    JSON.stringify(sheetTabs) !== JSON.stringify(config.sheetTabs ?? []);

  if (needsConfigUpdate) {
    const updatedConfig: SourceConfig = { ...config, columnMapping: resolvedMapping, sheetName: resolvedSheetName, sheetNames: resolvedSheetNames, sheetTabs };
    await prisma.source.update({
      where: { id: source.id },
      data: { config: updatedConfig as unknown as Prisma.InputJsonValue },
    });
  }

  return ingestNormalizedItems(userId, source, items);
}
