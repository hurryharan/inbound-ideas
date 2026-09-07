import type { LLMProviderKind } from "@prisma/client";

// "Launch into chat" (PRD section 18). Tiered behavior:
//   1. Deep-link/new-chat URL with the prompt prefilled, if the provider supports it.
//   2. API-created conversation (not implemented for MVP — no provider offers a
//      public API that both creates a UI-visible conversation AND is safe to
//      call from a personal app without a server-side chat UI of our own).
//   3. Copy the prompt to the clipboard and open the provider's website. This
//      fallback must always work, and is what non-deep-linkable providers use.

export type LaunchStrategy = "deep_link" | "clipboard";

export interface LaunchTarget {
  strategy: LaunchStrategy;
  url: string;
}

const MAX_DEEP_LINK_PROMPT_LENGTH = 1500;

/**
 * ChatGPT documents a `?q=` query param on chatgpt.com that prefills a new
 * chat's composer. No other mainstream provider currently exposes an
 * equivalent public, prefillable new-chat URL, so everything else falls
 * back to clipboard + opening the provider's site.
 */
export function resolveLaunchTarget(kind: LLMProviderKind, prompt: string, baseUrl?: string | null): LaunchTarget {
  if (kind === "OPENAI" && prompt.length <= MAX_DEEP_LINK_PROMPT_LENGTH) {
    return { strategy: "deep_link", url: `https://chatgpt.com/?q=${encodeURIComponent(prompt)}` };
  }

  return { strategy: "clipboard", url: getProviderWebsiteUrl(kind, baseUrl) };
}

export function getProviderWebsiteUrl(kind: LLMProviderKind, baseUrl?: string | null): string {
  switch (kind) {
    case "OPENAI":
      return "https://chatgpt.com/";
    case "ANTHROPIC":
      return "https://claude.ai/new";
    case "GOOGLE":
      return "https://gemini.google.com/app";
    case "OPENAI_COMPATIBLE":
      return baseUrl || "about:blank";
    default:
      return "about:blank";
  }
}
