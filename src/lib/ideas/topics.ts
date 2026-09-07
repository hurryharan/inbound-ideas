// Lightweight keyword-based topic extraction (PRD section 20/28). This is
// intentionally simple for the MVP — tag documents/items manually where
// possible, match on keyword overlap here. A future version can swap this
// for embeddings/semantic search without changing callers.

const TOPIC_VOCABULARY: Record<string, string[]> = {
  ai: ["ai", "artificial intelligence", "llm", "machine learning", "gpt", "model", "agent", "agents"],
  governance: ["governance", "regulation", "policy", "compliance", "institution", "institutional"],
  payments: ["payments", "upi", "fintech", "transaction", "banking"],
  infrastructure: ["infrastructure", "platform", "rails", "protocol", "plumbing"],
  markets: ["market", "markets", "economics", "economy", "pricing", "competition"],
  product: ["product", "roadmap", "feature", "user experience", "ux"],
  data: ["data", "dataset", "privacy", "data governance"],
  startups: ["startup", "founder", "venture", "vc"],
  safety: ["safety", "safe", "risk", "security", "trust"],
};

export function extractTopics(text: string, explicitTags: string[] = []): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const tag of explicitTags) {
    if (tag) found.add(tag.trim().toLowerCase());
  }

  for (const [topic, keywords] of Object.entries(TOPIC_VOCABULARY)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      found.add(topic);
    }
  }

  return Array.from(found);
}
