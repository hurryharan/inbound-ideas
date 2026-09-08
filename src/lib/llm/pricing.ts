import type { LLMProviderKind } from "@prisma/client";

// Known current pricing (USD per 1M tokens) to pre-fill the Add/Edit Provider
// form. Anthropic's rates below are current first-party API pricing; we do
// NOT hard-code default rates for other providers — their pricing changes on
// a different cadence than this codebase gets updated, and a wrong number in
// a cost dashboard is worse than a blank one. Every provider's rate is
// user-editable in Settings regardless of whether a default is suggested
// here (PRD-style principle: nothing load-bearing hard-coded).
const ANTHROPIC_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-mythos-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Suggests known pricing for a provider+model, or null if we don't have a confident default. */
export function suggestPricing(kind: LLMProviderKind, model: string): { input: number; output: number } | null {
  if (kind === "ANTHROPIC") {
    return ANTHROPIC_PRICING_PER_MILLION[model.trim().toLowerCase()] ?? null;
  }
  return null;
}

export interface UsagePricing {
  inputPricePerMillion: number | null | undefined;
  outputPricePerMillion: number | null | undefined;
}

/** Returns null when pricing isn't configured — cost is simply not computed, never guessed. */
export function computeCostUsd(pricing: UsagePricing, inputTokens: number, outputTokens: number): number | null {
  if (pricing.inputPricePerMillion == null || pricing.outputPricePerMillion == null) return null;
  return (inputTokens / 1_000_000) * pricing.inputPricePerMillion + (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
}
