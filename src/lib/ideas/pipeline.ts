import { prisma } from "@/lib/prisma";
import { getAdapterForProvider } from "@/lib/llm";
import type { LLMAdapter } from "@/lib/llm/types";
import { getRankingWeights } from "@/lib/preferences";
import { extractTopics } from "./topics";
import { selectRelevantContext } from "./context-matching";
import { computeScore, estimateFactors } from "./scoring";
import { generateIdea } from "./generate";
import type { Prisma, Source, SourceItem, SourcePriority } from "@prisma/client";

const SOURCE_PRIORITY_WEIGHT: Record<SourcePriority, number> = { LOW: 0.4, MEDIUM: 0.7, HIGH: 1.0 };

async function getDefaultLLMAdapter(userId: string): Promise<LLMAdapter | undefined> {
  const provider = await prisma.lLMProvider.findFirst({ where: { userId, isDefault: true } });
  if (!provider) return undefined;
  try {
    return getAdapterForProvider(provider);
  } catch {
    return undefined;
  }
}

/**
 * Idea generation/update pipeline (PRD section 29 step 5, section 40 Phase 4).
 * Called after ingestion for newly-created SourceItems. One SourceItem
 * produces one candidate Idea for the MVP (see PRD section 30 — exact/near
 * -exact dedup at ingestion is sufficient; semantic clustering across
 * sources is a future feature).
 */
export async function generateIdeasForItems(
  userId: string,
  items: (SourceItem & { source: Source })[]
): Promise<number> {
  if (items.length === 0) return 0;

  const [contextDocs, weights, llm] = await Promise.all([
    prisma.contextDocument.findMany({
      where: { contextSource: { userId, enabled: true } },
      include: { contextSource: { select: { priority: true } } },
    }),
    getRankingWeights(userId),
    getDefaultLLMAdapter(userId),
  ]);

  const contextCandidates = contextDocs.map((doc) => ({
    id: doc.id,
    tags: doc.tags,
    priority: doc.contextSource.priority,
  }));

  let created = 0;

  for (const item of items) {
    const topics = extractTopics(`${item.title} ${item.content}`, item.metadata && typeof item.metadata === "object" ? extractTagsFromMetadata(item.metadata) : []);
    const matched = selectRelevantContext(topics, contextCandidates);
    const matchedDocs = contextDocs.filter((d) => matched.some((m) => m.id === d.id));

    const generated = await generateIdea(
      { title: item.title, content: item.content, sourceType: item.sourceType },
      matchedDocs.map((d) => ({ title: d.title, tags: d.tags })),
      llm
    );

    const factors = estimateFactors({
      contentLength: item.content.length,
      relevantContextCount: matched.length,
      topicCount: generated.topics.length || topics.length,
      sourcePriorityWeight: SOURCE_PRIORITY_WEIGHT[item.source.priority],
    });
    const score = computeScore(factors, weights);

    await prisma.idea.create({
      data: {
        title: generated.title,
        summary: generated.summary,
        observation: generated.observation,
        whyRelevant: generated.whyRelevant,
        potentialThesis: generated.potentialThesis,
        angles: generated.angles as unknown as Prisma.InputJsonValue,
        topics: generated.topics.length > 0 ? generated.topics : topics,
        score,
        status: "SURFACED",
        sourceItems: { create: [{ sourceItemId: item.id }] },
        contextDocuments: {
          create: matched.map((m) => ({ contextDocumentId: m.id, relevance: m.relevance })),
        },
      },
    });
    created++;
  }

  return created;
}

function extractTagsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const m = metadata as Record<string, unknown>;
  const topic = m.topic;
  return typeof topic === "string" ? [topic] : [];
}
