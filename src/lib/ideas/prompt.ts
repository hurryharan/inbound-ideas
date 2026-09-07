// Ideation prompt generation (PRD section 18/19/27). The instruction text
// is user-editable and stored in UserPreference — never hard-coded into
// application logic. This module just knows how to assemble the final
// prompt from an instruction template + the selected idea + relevant
// context, which is what actually gets copied/deep-linked to the LLM.

export const DEFAULT_IDEATION_PROMPT = `You are acting as an intellectual sparring partner.

The goal of this session is to develop an interesting,
original idea — not to immediately write a social-media post.

Start by understanding the selected inbound idea.

Then:

1. Identify the underlying observation.
2. Identify what is genuinely interesting or non-obvious.
3. Challenge weak assumptions.
4. Propose alternative interpretations.
5. Connect it to the user's relevant context where useful.
6. Develop 2–4 possible theses or angles.
7. Ask the user which direction feels most interesting.
8. Continue iterating based on the user's responses.

Do not jump into polished LinkedIn copy unless explicitly asked.

Prefer:
- strong observations
- original connections
- contrarian or surprising interpretations
- specific examples
- intellectual tension
- clear theses

Avoid:
- generic thought leadership
- motivational language
- obvious AI-generated LinkedIn tropes
- unnecessary jargon
- premature drafting`;

export interface AngleLike {
  label: string;
  description: string;
}

export interface IdeationPromptInput {
  instructionTemplate: string;
  idea: {
    title: string;
    sourceLabel: string;
    observation: string;
    whyRelevant: string;
    potentialThesis: string;
    angles: AngleLike[];
  };
  contextDocuments: { title: string; excerpt: string; sourceName: string }[];
}

function truncate(text: string, max = 800): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

export function buildIdeationPrompt(input: IdeationPromptInput): string {
  const { instructionTemplate, idea, contextDocuments } = input;

  const anglesBlock = idea.angles
    .map((a, i) => `${String.fromCharCode(65 + i)} — ${a.label}\n${a.description}`)
    .join("\n\n");

  const contextBlock =
    contextDocuments.length > 0
      ? contextDocuments
          .map((doc) => `- ${doc.title} (${doc.sourceName})\n  ${truncate(doc.excerpt, 500)}`)
          .join("\n\n")
      : "(no configured context documents matched this idea's topics)";

  return `${instructionTemplate.trim()}

---

SELECTED IDEA

${idea.title}

Source:
${idea.sourceLabel}

Original observation:
${idea.observation}

Why it may matter:
${idea.whyRelevant}

Potential thesis:
${idea.potentialThesis}

Possible angles:
${anglesBlock}

Relevant context:
${contextBlock}`;
}
