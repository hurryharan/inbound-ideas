import { prisma } from "@/lib/prisma";
import { computeCostUsd } from "./pricing";
import type { LLMProvider, LLMWorkflow } from "@prisma/client";

export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Records one LLM API call for usage/cost accounting (per PRD-adjacent
 * request: track spend per provider and per workflow/use case). Called once
 * per completed call, regardless of whether the model's output ended up
 * usable — a call that returned malformed JSON and fell back to the
 * heuristic still cost real tokens.
 */
export async function recordLLMUsage(params: {
  userId: string;
  provider: LLMProvider;
  workflow: LLMWorkflow;
  usage: UsageTokens;
}): Promise<void> {
  const { userId, provider, workflow, usage } = params;
  const costUsd = computeCostUsd(provider, usage.inputTokens, usage.outputTokens);

  await prisma.lLMUsageEvent.create({
    data: {
      userId,
      llmProviderId: provider.id,
      providerKind: provider.kind,
      providerName: provider.name,
      model: provider.defaultModel,
      workflow,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd,
    },
  });
}
