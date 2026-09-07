import type { LLMProvider } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import type { LLMAdapter } from "./types";
import { OpenAIAdapter } from "./openai";
import { AnthropicAdapter } from "./anthropic";
import { GoogleAdapter } from "./google";
import { OpenAICompatibleAdapter } from "./openai-compatible";

export * from "./types";

/**
 * Builds an LLMAdapter from a stored provider row. The rest of the
 * application (idea generation, ranking) only ever depends on the
 * LLMAdapter interface — never on a specific provider (PRD section 17).
 */
export function getAdapterForProvider(provider: LLMProvider): LLMAdapter {
  const apiKey = provider.apiKeyEncrypted ? decryptSecret(provider.apiKeyEncrypted) : "";

  switch (provider.kind) {
    case "OPENAI":
      return new OpenAIAdapter(apiKey, provider.defaultModel, provider.baseUrl || undefined);
    case "ANTHROPIC":
      return new AnthropicAdapter(apiKey, provider.defaultModel, provider.baseUrl || undefined);
    case "GOOGLE":
      return new GoogleAdapter(apiKey, provider.defaultModel, provider.baseUrl || undefined);
    case "OPENAI_COMPATIBLE":
      if (!provider.baseUrl) throw new Error("OpenAI-compatible providers require a baseUrl.");
      return new OpenAICompatibleAdapter(apiKey, provider.defaultModel, provider.baseUrl);
    default:
      throw new Error(`Unknown LLM provider kind: ${provider.kind}`);
  }
}
