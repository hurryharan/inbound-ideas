import { describe, expect, it } from "vitest";
import { buildIdeationPrompt, DEFAULT_IDEATION_PROMPT } from "@/lib/ideas/prompt";

describe("buildIdeationPrompt", () => {
  const baseInput = {
    instructionTemplate: DEFAULT_IDEATION_PROMPT,
    idea: {
      title: "UPI wasn't really about payments",
      sourceLabel: "LinkedIn Saved Post",
      observation: "UPI transformed payments in India.",
      whyRelevant: "Connects to your data governance thinking.",
      potentialThesis: "Infrastructure becomes valuable when coordination costs disappear.",
      angles: [
        { label: "Economic angle", description: "Safety creates an economic boundary condition." },
        { label: "Institutional angle", description: "Governance mechanisms can destroy the value they protect." },
      ],
    },
    contextDocuments: [{ title: "Niti Strategy", excerpt: "Notes on collaborative data governance.", sourceName: "Niti" }],
  };

  it("never asks the LLM to immediately write a LinkedIn post (PRD section 19)", () => {
    const prompt = buildIdeationPrompt(baseInput);
    expect(prompt).toContain("intellectual sparring partner");
    expect(prompt).toContain("Do not jump into polished LinkedIn copy");
    expect(prompt.toLowerCase()).not.toMatch(/write (a|the) linkedin post/);
  });

  it("includes the selected idea and labeled angles", () => {
    const prompt = buildIdeationPrompt(baseInput);
    expect(prompt).toContain("SELECTED IDEA");
    expect(prompt).toContain("UPI wasn't really about payments");
    expect(prompt).toContain("A — Economic angle");
    expect(prompt).toContain("B — Institutional angle");
  });

  it("includes relevant context documents when present", () => {
    const prompt = buildIdeationPrompt(baseInput);
    expect(prompt).toContain("Niti Strategy");
  });

  it("notes when no context documents matched, rather than omitting the section", () => {
    const prompt = buildIdeationPrompt({ ...baseInput, contextDocuments: [] });
    expect(prompt).toContain("no configured context documents matched");
  });

  it("respects a custom instruction template (PRD section 27 — never hard-coded)", () => {
    const prompt = buildIdeationPrompt({ ...baseInput, instructionTemplate: "Custom instructions go here." });
    expect(prompt).toContain("Custom instructions go here.");
    expect(prompt).not.toContain("intellectual sparring partner");
  });
});
