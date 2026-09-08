import { describe, expect, it } from "vitest";
import { computeCostUsd, suggestPricing } from "@/lib/llm/pricing";

describe("computeCostUsd", () => {
  it("computes cost from input/output token counts and per-million rates", () => {
    const cost = computeCostUsd({ inputPricePerMillion: 5, outputPricePerMillion: 25 }, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(5 + 25);
  });

  it("scales correctly for partial-million token counts", () => {
    const cost = computeCostUsd({ inputPricePerMillion: 2, outputPricePerMillion: 10 }, 500_000, 100_000);
    expect(cost).toBeCloseTo(1 + 1);
  });

  it("returns null when either rate is unset — cost is never guessed", () => {
    expect(computeCostUsd({ inputPricePerMillion: null, outputPricePerMillion: 10 }, 1000, 1000)).toBeNull();
    expect(computeCostUsd({ inputPricePerMillion: 5, outputPricePerMillion: undefined }, 1000, 1000)).toBeNull();
    expect(computeCostUsd({ inputPricePerMillion: null, outputPricePerMillion: null }, 1000, 1000)).toBeNull();
  });

  it("handles zero tokens without error", () => {
    expect(computeCostUsd({ inputPricePerMillion: 5, outputPricePerMillion: 25 }, 0, 0)).toBe(0);
  });
});

describe("suggestPricing", () => {
  it("suggests known current pricing for Anthropic models", () => {
    expect(suggestPricing("ANTHROPIC", "claude-opus-5")).toEqual({ input: 5, output: 25 });
    expect(suggestPricing("ANTHROPIC", "claude-sonnet-5")).toEqual({ input: 2, output: 10 });
  });

  it("matches model IDs case-insensitively", () => {
    expect(suggestPricing("ANTHROPIC", "Claude-Opus-5")).toEqual({ input: 5, output: 25 });
  });

  it("returns null for an unrecognized Anthropic model rather than guessing", () => {
    expect(suggestPricing("ANTHROPIC", "claude-some-future-model")).toBeNull();
  });

  it("never suggests pricing for non-Anthropic providers (no authoritative source for those rates)", () => {
    expect(suggestPricing("OPENAI", "gpt-4.1")).toBeNull();
    expect(suggestPricing("GOOGLE", "gemini-2.5-pro")).toBeNull();
    expect(suggestPricing("OPENAI_COMPATIBLE", "llama-3")).toBeNull();
  });
});
