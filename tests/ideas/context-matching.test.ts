import { describe, expect, it } from "vitest";
import { selectRelevantContext, type ContextDocCandidate } from "@/lib/ideas/context-matching";

describe("selectRelevantContext", () => {
  const candidates: ContextDocCandidate[] = [
    { id: "niti", tags: ["niti", "governance", "data"], priority: "HIGH" },
    { id: "hetu", tags: ["hetu", "product", "ai"], priority: "HIGH" },
    { id: "travel", tags: ["personal", "travel"], priority: "LOW" },
    { id: "unrelated-co", tags: ["acme", "unrelated"], priority: "MEDIUM" },
  ];

  it("matches documents whose tags overlap the idea's topics", () => {
    const result = selectRelevantContext(["governance", "data"], candidates);
    expect(result.map((r) => r.id)).toContain("niti");
    expect(result.map((r) => r.id)).not.toContain("travel");
    expect(result.map((r) => r.id)).not.toContain("unrelated-co");
  });

  it("excludes documents with zero tag overlap (PRD section 20 example)", () => {
    const result = selectRelevantContext(["ai", "product"], candidates);
    const ids = result.map((r) => r.id);
    expect(ids).toContain("hetu");
    expect(ids).not.toContain("travel");
  });

  it("returns nothing when the idea has no topics", () => {
    expect(selectRelevantContext([], candidates)).toEqual([]);
  });

  it("ranks higher-priority documents above lower-priority ones at equal overlap", () => {
    const equalOverlap: ContextDocCandidate[] = [
      { id: "low", tags: ["ai"], priority: "LOW" },
      { id: "high", tags: ["ai"], priority: "HIGH" },
    ];
    const result = selectRelevantContext(["ai"], equalOverlap);
    expect(result[0].id).toBe("high");
  });

  it("caps results at maxResults", () => {
    const many: ContextDocCandidate[] = Array.from({ length: 10 }, (_, i) => ({ id: `doc-${i}`, tags: ["ai"] }));
    expect(selectRelevantContext(["ai"], many, 3)).toHaveLength(3);
  });
});
