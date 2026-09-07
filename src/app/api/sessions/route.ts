import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRoute } from "@/lib/api-helpers";

const createSessionSchema = z.object({
  ideaId: z.string().min(1),
  llmProviderId: z.string().optional(),
  llmModel: z.string().min(1),
  externalChatUrl: z.string().optional(),
  promptText: z.string().min(1),
  contextDocumentIds: z.array(z.string()).default([]),
});

export async function GET() {
  return handleRoute(async () => {
    const sessions = await prisma.session.findMany({
      orderBy: { startedAt: "desc" },
      include: { idea: { select: { id: true, title: true } }, llmProvider: { select: { name: true, kind: true } } },
    });
    return NextResponse.json(sessions);
  });
}

// Records session metadata for an ideation handoff (PRD section 21). The
// actual conversation happens in the external LLM's UI — this is just the
// audit trail: which idea, which provider/model, which context documents
// were included, and the launch URL to return to later.
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = createSessionSchema.parse(await req.json());

    const session = await prisma.session.create({
      data: {
        ideaId: body.ideaId,
        llmProviderId: body.llmProviderId,
        llmModel: body.llmModel,
        externalChatUrl: body.externalChatUrl,
        promptText: body.promptText,
        contextDocumentIds: body.contextDocumentIds,
        status: "STARTED",
      },
    });

    await prisma.idea.update({
      where: { id: body.ideaId },
      data: { status: "EXPLORING", lastExploredAt: new Date() },
    });

    return NextResponse.json(session, { status: 201 });
  });
}
