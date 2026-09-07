// Idea ranking (PRD section 16). Weights are configurable and stored in
// UserPreference; this module is pure so it can be unit tested and reused
// wherever ranking happens.

export interface RankingWeights {
  interestingness: number;
  relevance: number;
  novelty: number;
  connectionPotential: number;
  sourceQuality: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  interestingness: 0.25,
  relevance: 0.25,
  novelty: 0.2,
  connectionPotential: 0.2,
  sourceQuality: 0.1,
};

export interface IdeaFactors {
  interestingness: number; // 0-1
  relevance: number; // 0-1
  novelty: number; // 0-1
  connectionPotential: number; // 0-1
  sourceQuality: number; // 0-1
}

export function computeScore(factors: IdeaFactors, weights: RankingWeights = DEFAULT_RANKING_WEIGHTS): number {
  const score =
    weights.interestingness * factors.interestingness +
    weights.relevance * factors.relevance +
    weights.novelty * factors.novelty +
    weights.connectionPotential * factors.connectionPotential +
    weights.sourceQuality * factors.sourceQuality;

  return Math.max(0, Math.min(1, score));
}

/** Heuristic factor estimation used when no LLM is configured to score the idea. */
export function estimateFactors(input: {
  contentLength: number;
  relevantContextCount: number;
  topicCount: number;
  sourcePriorityWeight: number; // 0-1, from Source.priority
}): IdeaFactors {
  const interestingness = clamp01(0.4 + Math.min(input.contentLength, 600) / 1500);
  const relevance = clamp01(input.relevantContextCount / 3);
  const novelty = clamp01(0.5 + input.topicCount * 0.05);
  const connectionPotential = clamp01(input.relevantContextCount > 0 ? 0.5 + input.relevantContextCount * 0.1 : 0.3);
  const sourceQuality = clamp01(input.sourcePriorityWeight);

  return { interestingness, relevance, novelty, connectionPotential, sourceQuality };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
