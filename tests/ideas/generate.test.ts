import { describe, expect, it } from "vitest";
import { generateIdeaHeuristically } from "@/lib/ideas/generate";

describe("generateIdeaHeuristically", () => {
  it("never returns fewer than 2 angles, and never picks one for the user (PRD section 8)", () => {
    const idea = generateIdeaHeuristically(
      { title: "UPI wasn't really about payments", content: "UPI transformed payments and infrastructure in India.", sourceName: "LinkedIn Saved Posts" },
      []
    );
    expect(idea.angles.length).toBeGreaterThanOrEqual(2);
    expect(idea.angles.length).toBeLessThanOrEqual(4);
  });

  it("surfaces matched context in whyRelevant when context documents are provided", () => {
    const withContext = generateIdeaHeuristically(
      { title: "Test", content: "Some AI governance content", sourceName: "LinkedIn Saved Posts" },
      [{ title: "Niti Strategy", tags: ["governance"] }]
    );
    expect(withContext.whyRelevant).toContain("Niti Strategy");
  });

  it("extracts topics from the content", () => {
    const idea = generateIdeaHeuristically(
      { title: "Enterprise AI agents", content: "AI agents adoption in enterprise governance", sourceName: "Content Ideas Sheet" },
      []
    );
    expect(idea.topics).toContain("ai");
    expect(idea.topics).toContain("governance");
  });
});
