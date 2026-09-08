import { prisma } from "@/lib/prisma";
import { getIdeationPrompt } from "@/lib/preferences";
import { buildIdeationPrompt, type AngleLike } from "./prompt";
import { resolveLaunchTarget } from "@/lib/llm/launch";
import type { LLMProviderKind } from "@prisma/client";

export interface PreparedIdeation {
  prompt: string;
  contextDocumentIds: string[];
  llmProvider: { id: string; kind: LLMProviderKind; defaultModel: string; baseUrl: string | null } | null;
  launch: { strategy: "deep_link" | "clipboard"; url: string };
}

/** Prepares the ideation context for the selected idea (PRD section 18). */
export async function prepareIdeation(userId: string, ideaId: string, llmProviderId?: string): Promise<PreparedIdeation> {
  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    include: {
      sourceItems: { include: { sourceItem: { include: { source: true } } } },
      contextDocuments: { include: { contextDocument: { include: { contextSource: true } } } },
    },
  });

  const provider = llmProviderId
    ? await prisma.lLMProvider.findFirstOrThrow({ where: { id: llmProviderId, userId } })
    : await prisma.lLMProvider.findFirst({ where: { userId, isDefault: true } });

  const template = await getIdeationPrompt(userId);

  const primarySourceItem = idea.sourceItems[0]?.sourceItem;
  const sourceLabel = primarySourceItem?.source.name ?? "Inbound Ideas";

  const prompt = buildIdeationPrompt({
    instructionTemplate: template,
    idea: {
      title: idea.title,
      sourceLabel,
      observation: idea.observation,
      whyRelevant: idea.whyRelevant,
      potentialThesis: idea.potentialThesis,
      angles: idea.angles as unknown as AngleLike[],
    },
    contextDocuments: idea.contextDocuments.map((link) => ({
      title: link.contextDocument.title,
      excerpt: link.contextDocument.content,
      sourceName: link.contextDocument.contextSource.name,
    })),
  });

  const launch = provider
    ? resolveLaunchTarget(provider.kind, prompt, provider.baseUrl)
    : { strategy: "clipboard" as const, url: "about:blank" };

  return {
    prompt,
    contextDocumentIds: idea.contextDocuments.map((l) => l.contextDocumentId),
    llmProvider: provider ? { id: provider.id, kind: provider.kind, defaultModel: provider.defaultModel, baseUrl: provider.baseUrl } : null,
    launch,
  };
}
