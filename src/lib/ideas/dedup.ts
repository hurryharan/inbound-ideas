import type { IdeaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalizeUrl } from "@/lib/sources/dedup";

type IdeaWithSources = {
  id: string;
  status: IdeaStatus;
  createdAt: Date;
  lastExploredAt: Date | null;
  sourceItems: { sourceItemId: string; sourceItem: { url: string | null; contentHash: string } }[];
  contextDocuments: { contextDocumentId: string; relevance: number }[];
};

export interface IdeaDuplicateGroup<T extends { id: string; status: IdeaStatus; createdAt: Date; lastExploredAt: Date | null; sourceItems: { sourceItem: { url: string | null; contentHash: string } }[] }> {
  keep: T;
  duplicates: T[];
}

const STATUS_PRIORITY: Record<IdeaStatus, number> = {
  EXPLORING: 6,
  EXPLORED: 5,
  SURFACED: 4,
  NEW: 3,
  PARKED: 2,
  ARCHIVED: 1,
};

function identityKeys(idea: { sourceItems: { sourceItem: { url: string | null; contentHash: string } }[] }): string[] {
  return idea.sourceItems.flatMap(({ sourceItem }) => {
    const url = canonicalizeUrl(sourceItem.url);
    return [url ? `url:${url}` : null, `content:${sourceItem.contentHash}`].filter((key): key is string => Boolean(key));
  });
}

function preferredFirst<T extends { status: IdeaStatus; createdAt: Date; lastExploredAt: Date | null }>(a: T, b: T): number {
  const aPriority = STATUS_PRIORITY[a.status] + (a.lastExploredAt ? 10 : 0);
  const bPriority = STATUS_PRIORITY[b.status] + (b.lastExploredAt ? 10 : 0);
  return bPriority - aPriority || a.createdAt.getTime() - b.createdAt.getTime();
}

/** Groups ideas sharing a source URL or normalized source content. */
export function findIdeaDuplicateGroups<T extends { id: string; status: IdeaStatus; createdAt: Date; lastExploredAt: Date | null; sourceItems: { sourceItem: { url: string | null; contentHash: string } }[] }>(ideas: T[]): IdeaDuplicateGroup<T>[] {
  const groups: T[][] = [];
  const keysToGroup = new Map<string, T[]>();

  for (const idea of ideas) {
    const keys = identityKeys(idea);
    const matchingGroups = [...new Set(keys.map((key) => keysToGroup.get(key)).filter((group): group is T[] => Boolean(group)))];
    const group = matchingGroups[0] ?? [];

    if (matchingGroups.length > 1) {
      for (const extraGroup of matchingGroups.slice(1)) {
        group.push(...extraGroup);
        for (const [key, mappedGroup] of keysToGroup) if (mappedGroup === extraGroup) keysToGroup.set(key, group);
        groups.splice(groups.indexOf(extraGroup), 1);
      }
    }
    if (!matchingGroups.length) groups.push(group);
    group.push(idea);
    for (const key of keys) keysToGroup.set(key, group);
  }

  return groups
    .filter((group) => group.length > 1)
    .map((group) => {
      const ordered = [...group].sort(preferredFirst);
      return { keep: ordered[0], duplicates: ordered.slice(1) };
    });
}

/**
 * Consolidates historical duplicate ideas after a refresh while preserving
 * source provenance, matched context, feedback, and existing sessions.
 */
export async function dedupeIdeasForUser(userId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const ideas = await tx.idea.findMany({
      where: { sourceItems: { some: { sourceItem: { source: { userId } } } } },
      include: {
        sourceItems: { select: { sourceItemId: true, sourceItem: { select: { url: true, contentHash: true } } } },
        contextDocuments: { select: { contextDocumentId: true, relevance: true } },
      },
    });
    const duplicateGroups = findIdeaDuplicateGroups(ideas as IdeaWithSources[]);

    for (const { keep, duplicates } of duplicateGroups) {
      for (const duplicate of duplicates) {
        await tx.ideaSourceItem.createMany({
          data: duplicate.sourceItems.map((link) => ({ ideaId: keep.id, sourceItemId: link.sourceItemId })),
          skipDuplicates: true,
        });
        await tx.ideaContextDocument.createMany({
          data: duplicate.contextDocuments.map((link) => ({ ideaId: keep.id, contextDocumentId: link.contextDocumentId, relevance: link.relevance })),
          skipDuplicates: true,
        });
        await tx.feedback.updateMany({ where: { ideaId: duplicate.id }, data: { ideaId: keep.id } });
        await tx.session.updateMany({ where: { ideaId: duplicate.id }, data: { ideaId: keep.id } });
        await tx.idea.delete({ where: { id: duplicate.id } });
      }
    }

    return duplicateGroups.reduce((count, group) => count + group.duplicates.length, 0);
  });
}
