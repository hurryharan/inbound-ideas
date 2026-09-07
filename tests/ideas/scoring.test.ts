import { describe, expect, it } from "vitest";
import { computeScore, DEFAULT_RANKING_WEIGHTS, estimateFactors, type RankingWeights } from "@/lib/ideas/scoring";

describe("computeScore", () => {
  const perfectFactors = { interestingness: 1, relevance: 1, novelty: 1, connectionPotential: 1, sourceQuality: 1 };
  const zeroFactors = { interestingness: 0, relevance: 0, novelty: 0, connectionPotential: 0, sourceQuality: 0 };

  it("returns 1 when all factors are maxed and weights sum to 1", () => {
    expect(computeScore(perfectFactors, DEFAULT_RANKING_WEIGHTS)).toBeCloseTo(1);
  });

  it("returns 0 when all factors are 0", () => {
    expect(computeScore(zeroFactors, DEFAULT_RANKING_WEIGHTS)).toBe(0);
  });

  it("respects configurable weights — an idea can rank higher purely by reweighting", () => {
    const factors = { interestingness: 1, relevance: 0, novelty: 0, connectionPotential: 0, sourceQuality: 0 };
    const weightsFavoringInterestingness: RankingWeights = {
      interestingness: 1,
      relevance: 0,
      novelty: 0,
      connectionPotential: 0,
      sourceQuality: 0,
    };
    expect(computeScore(factors, weightsFavoringInterestingness)).toBeCloseTo(1);
    expect(computeScore(factors, DEFAULT_RANKING_WEIGHTS)).toBeCloseTo(0.25);
  });

  it("clamps to [0, 1]", () => {
    const overWeighted: RankingWeights = { interestingness: 2, relevance: 0, novelty: 0, connectionPotential: 0, sourceQuality: 0 };
    expect(computeScore(perfectFactors, overWeighted)).toBe(1);
  });
});

describe("estimateFactors", () => {
  it("rewards ideas with more matched context and higher source priority", () => {
    const withContext = estimateFactors({ contentLength: 400, relevantContextCount: 3, topicCount: 2, sourcePriorityWeight: 1 });
    const withoutContext = estimateFactors({ contentLength: 400, relevantContextCount: 0, topicCount: 2, sourcePriorityWeight: 0.4 });

    expect(withContext.relevance).toBeGreaterThan(withoutContext.relevance);
    expect(withContext.sourceQuality).toBeGreaterThan(withoutContext.sourceQuality);
  });

  it("always returns factors within [0, 1]", () => {
    const factors = estimateFactors({ contentLength: 100000, relevantContextCount: 999, topicCount: 999, sourcePriorityWeight: 999 });
    for (const value of Object.values(factors)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
