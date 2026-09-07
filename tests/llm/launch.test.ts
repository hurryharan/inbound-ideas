import { describe, expect, it } from "vitest";
import { resolveLaunchTarget, getProviderWebsiteUrl } from "@/lib/llm/launch";

describe("resolveLaunchTarget (PRD section 18 — launch into chat)", () => {
  it("deep-links to OpenAI with the prompt prefilled when short enough", () => {
    const target = resolveLaunchTarget("OPENAI", "Explore this idea with me");
    expect(target.strategy).toBe("deep_link");
    expect(target.url).toContain("chatgpt.com/?q=");
    expect(target.url).toContain(encodeURIComponent("Explore this idea with me"));
  });

  it("falls back to clipboard when the prompt is too long to deep-link", () => {
    const longPrompt = "x".repeat(5000);
    const target = resolveLaunchTarget("OPENAI", longPrompt);
    expect(target.strategy).toBe("clipboard");
  });

  it("always falls back to clipboard + provider site for Anthropic (no public prefill URL)", () => {
    const target = resolveLaunchTarget("ANTHROPIC", "short prompt");
    expect(target.strategy).toBe("clipboard");
    expect(target.url).toBe("https://claude.ai/new");
  });

  it("always falls back to clipboard + provider site for Google", () => {
    const target = resolveLaunchTarget("GOOGLE", "short prompt");
    expect(target.strategy).toBe("clipboard");
  });

  it("uses the configured baseUrl for OpenAI-compatible providers, and never crashes without one", () => {
    const withBaseUrl = resolveLaunchTarget("OPENAI_COMPATIBLE", "short prompt", "https://my-llm.example.com");
    expect(withBaseUrl.url).toBe("https://my-llm.example.com");

    const withoutBaseUrl = resolveLaunchTarget("OPENAI_COMPATIBLE", "short prompt", null);
    expect(withoutBaseUrl.strategy).toBe("clipboard");
    expect(typeof withoutBaseUrl.url).toBe("string");
  });

  it("the fallback always resolves to a usable URL for every provider kind", () => {
    for (const kind of ["OPENAI", "ANTHROPIC", "GOOGLE", "OPENAI_COMPATIBLE"] as const) {
      expect(typeof getProviderWebsiteUrl(kind)).toBe("string");
    }
  });
});
