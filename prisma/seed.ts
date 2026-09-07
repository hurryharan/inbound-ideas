import { PrismaClient, type Prisma, type SourcePriority } from "@prisma/client";
import { contentHash } from "../src/lib/sources/dedup";
import { extractTopics } from "../src/lib/ideas/topics";
import { selectRelevantContext } from "../src/lib/ideas/context-matching";
import { generateIdeaHeuristically } from "../src/lib/ideas/generate";
import { computeScore, estimateFactors, DEFAULT_RANKING_WEIGHTS } from "../src/lib/ideas/scoring";
import { buildIdeationPrompt } from "../src/lib/ideas/prompt";
import { DEFAULT_IDEATION_PROMPT } from "../src/lib/ideas/prompt";

const prisma = new PrismaClient();

const PRIORITY_WEIGHT: Record<SourcePriority, number> = { LOW: 0.4, MEDIUM: 0.7, HIGH: 1.0 };

async function main() {
  console.log("Seeding development data…");

  const user = await prisma.user.upsert({
    where: { email: process.env.APP_USER_EMAIL || "sysadmin@ispirt.in" },
    update: {},
    create: { email: process.env.APP_USER_EMAIL || "sysadmin@ispirt.in", name: "Inbound Ideas User" },
  });

  // ── Context sources ──────────────────────────────────────────────────
  const nitiContext = await prisma.contextSource.create({
    data: {
      userId: user.id,
      name: "Niti",
      description: "Strategy and positioning notes for Niti.",
      type: "GOOGLE_DRIVE_FOLDER",
      externalId: "seed-niti-folder",
      tags: ["niti", "company", "governance", "data"],
      priority: "HIGH",
      enabled: true,
    },
  });

  const hetuContext = await prisma.contextSource.create({
    data: {
      userId: user.id,
      name: "Hetu",
      description: "Product thinking and customer context for Hetu.",
      type: "GOOGLE_DRIVE_FOLDER",
      externalId: "seed-hetu-folder",
      tags: ["hetu", "product", "ai", "company"],
      priority: "HIGH",
      enabled: true,
    },
  });

  const thinkingContext = await prisma.contextSource.create({
    data: {
      userId: user.id,
      name: "Personal Thinking",
      description: "Essays, notes and previous writing.",
      type: "GOOGLE_DRIVE_FOLDER",
      externalId: "seed-thinking-folder",
      tags: ["writing", "ideas", "infrastructure", "markets"],
      priority: "MEDIUM",
      enabled: true,
    },
  });

  const contextDocs = await Promise.all([
    prisma.contextDocument.create({
      data: {
        contextSourceId: nitiContext.id,
        externalId: "seed-niti-doc-1",
        title: "Niti — Collaborative Data Governance Strategy",
        content:
          "Niti's thesis is that data governance works best as a collaborative infrastructure problem, not a top-down compliance problem. The interesting cases are where coordination costs — not technical limits — are what's actually blocking value creation.",
        tags: ["niti", "governance", "data", "infrastructure"],
      },
    }),
    prisma.contextDocument.create({
      data: {
        contextSourceId: hetuContext.id,
        externalId: "seed-hetu-doc-1",
        title: "Hetu — Product Notes: AI Agents for Enterprise",
        content:
          "Hetu is exploring how enterprises actually adopt AI agents — the blocker is rarely model quality, it's trust, auditability and who is accountable when an agent acts.",
        tags: ["hetu", "product", "ai", "safety"],
      },
    }),
    prisma.contextDocument.create({
      data: {
        contextSourceId: thinkingContext.id,
        externalId: "seed-thinking-doc-1",
        title: "Essay draft — Infrastructure Becomes Invisible",
        content:
          "A recurring pattern: the most transformative infrastructure stops being visible as infrastructure at all. UPI, TCP/IP, electricity — the win condition is disappearing into the background.",
        tags: ["infrastructure", "writing", "markets"],
      },
    }),
  ]);

  // ── Sources ───────────────────────────────────────────────────────────
  const linkedinSource = await prisma.source.create({
    data: {
      userId: user.id,
      type: "LINKEDIN_SAVED_POSTS",
      name: "LinkedIn Saved Posts",
      enabled: true,
      config: { lastImportFilename: "seed-demo-import.csv" },
      tags: ["linkedin"],
      priority: "HIGH",
    },
  });

  const sheetSource = await prisma.source.create({
    data: {
      userId: user.id,
      type: "GOOGLE_SHEET",
      name: "Content Ideas Sheet",
      enabled: true,
      config: {
        spreadsheetId: "seed-demo-sheet",
        sheetName: "Ideas",
        columnMapping: { title: "Title", body: "Idea", topic: "Topic", sourceUrl: "URL" },
      },
      tags: ["sheet", "content-ideas"],
      priority: "MEDIUM",
    },
  });

  // ── Inbound items (PRD section 7/9 style examples) ──────────────────
  const rawItems: { title: string; content: string; author?: string; source: typeof linkedinSource; url: string }[] = [
    {
      title: "UPI wasn't really about payments",
      content:
        "UPI transformed payments in India, but the deeper lesson may not be about digital payments at all — it may be that infrastructure becomes valuable precisely when coordination costs disappear. The interesting question is what else looks like a 'payments problem' but is actually a coordination problem.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-upi",
    },
    {
      title: "The economics of safe AI",
      content:
        "Everyone agrees AI needs to be safe. Almost nobody talks about who pays for that safety and where the cost actually lands. There's a case that safety mechanisms create economic boundary conditions that quietly decide which companies can compete at all.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-safe-ai",
    },
    {
      title: "Governance mechanisms can eat their own mandate",
      content:
        "A pattern worth naming: governance structures built to protect a system's integrity sometimes end up destroying the exact value they were meant to protect, because the mechanism itself becomes the new bottleneck.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-governance",
    },
    {
      title: "Why enterprise AI agent adoption is stalling",
      content:
        "It's not model quality holding back enterprise AI agent adoption. It's accountability — nobody has decided who owns the outcome when an autonomous agent acts on incomplete information. Trust infrastructure, not capability, is the real bottleneck.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-agents",
    },
    {
      title: "Founders keep confusing distribution with product",
      content:
        "A recurring startup failure mode: mistaking a distribution advantage for a durable product advantage. When the channel changes, the 'product' turns out to have been the channel all along.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-distribution",
    },
    {
      title: "Data governance is a collaboration problem wearing a compliance costume",
      content:
        "Most data governance initiatives fail because they're framed as compliance exercises. The ones that work are framed as collaboration infrastructure — reducing the coordination cost between teams that don't trust each other's data.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-data-governance",
    },
    {
      title: "The most dangerous phrase in product is 'users are asking for it'",
      content:
        "Users ask for features that solve their immediate friction, not features that solve the actual underlying problem. The product job is translation, not transcription.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-product",
    },
    {
      title: "Markets don't price in coordination costs — until they collapse",
      content:
        "A quiet thesis worth testing: a lot of 'market inefficiency' is actually mispriced coordination cost, invisible until some infrastructure change makes coordination suddenly cheap and the whole market repriced overnight.",
      author: "Anonymous",
      source: linkedinSource,
      url: "https://linkedin.com/posts/seed-markets",
    },
  ];

  const sheetItems: { title: string; content: string; topic: string; url: string }[] = [
    {
      title: "Enterprise AI adoption",
      content:
        "Content idea: a piece on why enterprise AI adoption is a trust and accountability problem, not a capability problem — tie back to Hetu's product notes on agent adoption.",
      topic: "AI",
      url: "https://sheet.example.com/row1",
    },
    {
      title: "Why infrastructure wins by disappearing",
      content:
        "Content idea: explore the UPI/TCP-IP pattern — the best infrastructure stops looking like infrastructure. Could connect to Niti's governance thesis.",
      topic: "Infrastructure",
      url: "https://sheet.example.com/row2",
    },
    {
      title: "Safety as a market structure question",
      content:
        "Content idea: unpack who actually bears the cost of AI safety requirements, and how that reshapes competitive dynamics between incumbents and startups.",
      topic: "AI",
      url: "https://sheet.example.com/row3",
    },
    {
      title: "Data governance without the compliance theater",
      content:
        "Content idea: make the case that good data governance is collaboration infrastructure, using Niti's framing as the backbone of the argument.",
      topic: "Governance",
      url: "https://sheet.example.com/row4",
    },
  ];

  const weights = DEFAULT_RANKING_WEIGHTS;
  const contextCandidates = contextDocs.map((d, i) => ({
    id: d.id,
    tags: d.tags,
    priority: [nitiContext, hetuContext, thinkingContext][i].priority,
  }));

  let ideaCount = 0;

  for (const item of rawItems) {
    const sourceItem = await prisma.sourceItem.create({
      data: {
        sourceId: item.source.id,
        externalId: item.url,
        sourceType: "LINKEDIN_SAVED_POSTS",
        title: item.title,
        content: item.content,
        url: item.url,
        author: item.author,
        contentHash: contentHash(item.content),
        metadata: {},
        createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 14),
      },
    });

    const topics = extractTopics(`${item.title} ${item.content}`);
    const matched = selectRelevantContext(topics, contextCandidates);
    const matchedDocs = contextDocs.filter((d) => matched.some((m) => m.id === d.id));
    const generated = generateIdeaHeuristically(
      { title: item.title, content: item.content, sourceType: "LINKEDIN_SAVED_POSTS" },
      matchedDocs.map((d) => ({ title: d.title, tags: d.tags }))
    );

    const factors = estimateFactors({
      contentLength: item.content.length,
      relevantContextCount: matched.length,
      topicCount: generated.topics.length,
      sourcePriorityWeight: PRIORITY_WEIGHT[item.source.priority],
    });
    const score = computeScore(factors, weights);

    await prisma.idea.create({
      data: {
        title: generated.title,
        summary: generated.summary,
        observation: generated.observation,
        whyRelevant: generated.whyRelevant,
        potentialThesis: generated.potentialThesis,
        angles: generated.angles as unknown as Prisma.InputJsonValue,
        topics: generated.topics,
        score,
        status: "SURFACED",
        sourceItems: { create: [{ sourceItemId: sourceItem.id }] },
        contextDocuments: { create: matched.map((m) => ({ contextDocumentId: m.id, relevance: m.relevance })) },
      },
    });
    ideaCount++;
  }

  for (const item of sheetItems) {
    const sourceItem = await prisma.sourceItem.create({
      data: {
        sourceId: sheetSource.id,
        externalId: item.url,
        sourceType: "GOOGLE_SHEET",
        title: item.title,
        content: item.content,
        url: item.url,
        contentHash: contentHash(item.content),
        metadata: { topic: item.topic },
        createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 10),
      },
    });

    const topics = extractTopics(`${item.title} ${item.content}`, [item.topic]);
    const matched = selectRelevantContext(topics, contextCandidates);
    const matchedDocs = contextDocs.filter((d) => matched.some((m) => m.id === d.id));
    const generated = generateIdeaHeuristically(
      { title: item.title, content: item.content, sourceType: "GOOGLE_SHEET" },
      matchedDocs.map((d) => ({ title: d.title, tags: d.tags }))
    );

    const factors = estimateFactors({
      contentLength: item.content.length,
      relevantContextCount: matched.length,
      topicCount: generated.topics.length,
      sourcePriorityWeight: PRIORITY_WEIGHT[sheetSource.priority],
    });
    const score = computeScore(factors, weights);

    await prisma.idea.create({
      data: {
        title: generated.title,
        summary: generated.summary,
        observation: generated.observation,
        whyRelevant: generated.whyRelevant,
        potentialThesis: generated.potentialThesis,
        angles: generated.angles as unknown as Prisma.InputJsonValue,
        topics: generated.topics,
        score,
        status: "NEW",
        sourceItems: { create: [{ sourceItemId: sourceItem.id }] },
        contextDocuments: { create: matched.map((m) => ({ contextDocumentId: m.id, relevance: m.relevance })) },
      },
    });
    ideaCount++;
  }

  // ── A couple of already-explored ideas + sessions (PRD section 22) ──
  const exploredIdeas = await prisma.idea.findMany({ take: 2, orderBy: { score: "desc" } });
  const providerLabels = [
    { name: "Claude", model: "claude-sonnet-5", url: "https://claude.ai/new" },
    { name: "ChatGPT", model: "gpt-4.1", url: "https://chatgpt.com/" },
  ];

  for (let i = 0; i < exploredIdeas.length; i++) {
    const idea = exploredIdeas[i];
    const provider = providerLabels[i % providerLabels.length];
    const angles = idea.angles as unknown as { label: string; description: string }[];

    const prompt = buildIdeationPrompt({
      instructionTemplate: DEFAULT_IDEATION_PROMPT,
      idea: {
        title: idea.title,
        sourceLabel: "LinkedIn Saved Post",
        observation: idea.observation,
        whyRelevant: idea.whyRelevant,
        potentialThesis: idea.potentialThesis,
        angles,
      },
      contextDocuments: [],
    });

    await prisma.session.create({
      data: {
        ideaId: idea.id,
        llmModel: provider.model,
        externalChatUrl: provider.url,
        status: "COMPLETED",
        promptText: prompt,
        startedAt: new Date(Date.now() - (i + 1) * 1000 * 60 * 60 * 24),
        notes: "Seed example session.",
      },
    });

    await prisma.idea.update({
      where: { id: idea.id },
      data: { status: "EXPLORED", lastExploredAt: new Date() },
    });
  }

  console.log(`Seed complete: 3 context sources, 3 context documents, 2 sources, ${ideaCount} ideas, ${exploredIdeas.length} sessions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
