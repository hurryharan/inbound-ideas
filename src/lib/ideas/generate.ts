import type { LLMAdapter } from "@/lib/llm/types";
import { extractTopics } from "./topics";
import { generateHeuristicAngles, type Angle } from "./angles";

export interface GeneratedIdeaFields {
  title: string;
  summary: string;
  observation: string;
  whyRelevant: string;
  potentialThesis: string;
  angles: Angle[];
  topics: string[];
}

export interface SourceItemLike {
  title: string;
  content: string;
  sourceName: string;
}

export interface ContextDocLike {
  title: string;
  tags: string[];
}

function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

/** Heuristic idea extraction, used when no LLM provider is configured (PRD section 42: works without external integrations). */
export function generateIdeaHeuristically(item: SourceItemLike, matchedContext: ContextDocLike[]): GeneratedIdeaFields {
  const topics = extractTopics(`${item.title} ${item.content}`);
  const observation = truncate(item.content, 400);
  const summary = truncate(item.content, 180);
  const angles = generateHeuristicAngles(item.title, topics);

  const whyRelevant =
    matchedContext.length > 0
      ? `This connects to your existing thinking in ${matchedContext.map((d) => d.title).join(", ")}.`
      : `This touches on ${topics.slice(0, 3).join(", ") || "a topic"} you've engaged with before — worth deciding if it's worth a deeper look.`;

  const potentialThesis = `There's a case that "${item.title}" isn't really about its surface topic — the more interesting claim may be about ${
    topics[0] ?? "the underlying structure"
  } and how it changes what people assume.`;

  return {
    title: item.title,
    summary,
    observation,
    whyRelevant,
    potentialThesis,
    angles,
    topics,
  };
}

const LLM_SYSTEM_PROMPT = `You extract structured "ideas worth exploring" from a single piece of inbound material for a personal idea-discovery app. You are NOT writing content — you are surfacing why something might be interesting and worth a human's attention. Respond with ONLY valid JSON matching this TypeScript type, no markdown fences, no commentary:

{
  "title": string,
  "summary": string,
  "observation": string,
  "whyRelevant": string,
  "potentialThesis": string,
  "angles": { "label": string, "description": string }[],
  "topics": string[]
}

"angles" must contain 2-4 distinct, non-obvious interpretations — never fewer than 2. Do not pick one for the user. Be specific and avoid generic thought-leadership language.`;

export interface LLMGenerationUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMGenerationResult {
  fields: GeneratedIdeaFields;
  usage: LLMGenerationUsage;
}

export async function generateIdeaWithLLM(
  llm: LLMAdapter,
  item: SourceItemLike,
  matchedContext: ContextDocLike[]
): Promise<LLMGenerationResult> {
  const contextSummary =
    matchedContext.length > 0
      ? matchedContext.map((d) => `- ${d.title} (tags: ${d.tags.join(", ")})`).join("\n")
      : "(none configured)";

  const userPrompt = `SOURCE: ${item.sourceName}
TITLE: ${item.title}

CONTENT:
${truncate(item.content, 2000)}

USER'S RELEVANT CONTEXT DOCUMENTS:
${contextSummary}`;

  // Let a network/API failure propagate — there's no token usage to report
  // when the call never completed. A malformed-but-successful response
  // (caught below) is different: tokens were spent either way.
  const result = await llm.complete({
    messages: [
      { role: "system", content: LLM_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  const parsed = parseIdeaJson(result.text);
  return {
    fields: parsed ?? generateIdeaHeuristically(item, matchedContext),
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
  };
}

function parseIdeaJson(raw: string): GeneratedIdeaFields | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const json = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    if (!json.title || !Array.isArray(json.angles) || json.angles.length < 2) return null;
    return {
      title: String(json.title),
      summary: String(json.summary ?? ""),
      observation: String(json.observation ?? ""),
      whyRelevant: String(json.whyRelevant ?? ""),
      potentialThesis: String(json.potentialThesis ?? ""),
      angles: json.angles.map((a: { label?: string; description?: string }) => ({
        label: String(a.label ?? "Angle"),
        description: String(a.description ?? ""),
      })),
      topics: Array.isArray(json.topics) ? json.topics.map(String) : [],
    };
  } catch {
    return null;
  }
}

export interface GenerateIdeaResult {
  fields: GeneratedIdeaFields;
  /** Null when no LLM was configured, or the call itself failed (nothing billed to report). */
  usage: LLMGenerationUsage | null;
}

export async function generateIdea(
  item: SourceItemLike,
  matchedContext: ContextDocLike[],
  llm?: LLMAdapter
): Promise<GenerateIdeaResult> {
  if (!llm) return { fields: generateIdeaHeuristically(item, matchedContext), usage: null };
  try {
    return await generateIdeaWithLLM(llm, item, matchedContext);
  } catch {
    return { fields: generateIdeaHeuristically(item, matchedContext), usage: null };
  }
}
