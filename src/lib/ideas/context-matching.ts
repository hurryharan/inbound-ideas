// Context retrieval (PRD section 20): match idea topics/tags against
// configured context documents' tags rather than dumping every document
// into every prompt. Ranked by tag overlap and the context source's
// priority; capped so prompts stay focused.

export interface ContextDocCandidate {
  id: string;
  tags: string[];
  priority?: "LOW" | "MEDIUM" | "HIGH";
}

export interface ScoredContextDoc {
  id: string;
  relevance: number;
}

const PRIORITY_WEIGHT: Record<string, number> = { LOW: 0.9, MEDIUM: 1, HIGH: 1.2 };

export function selectRelevantContext(
  topics: string[],
  candidates: ContextDocCandidate[],
  maxResults = 5
): ScoredContextDoc[] {
  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  if (topicSet.size === 0) return [];

  const scored = candidates
    .map((doc) => {
      const docTags = doc.tags.map((t) => t.toLowerCase());
      const overlap = docTags.filter((t) => topicSet.has(t)).length;
      if (overlap === 0) return null;
      const priorityWeight = PRIORITY_WEIGHT[doc.priority ?? "MEDIUM"] ?? 1;
      const relevance = (overlap / topicSet.size) * priorityWeight;
      return { id: doc.id, relevance };
    })
    .filter((x): x is ScoredContextDoc => x !== null)
    .sort((a, b) => b.relevance - a.relevance);

  return scored.slice(0, maxResults);
}
