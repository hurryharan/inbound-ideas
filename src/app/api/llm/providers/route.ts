import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { encryptSecret, maskSecret } from "@/lib/crypto";

const createProviderSchema = z.object({
  kind: z.enum(["OPENAI", "ANTHROPIC", "GOOGLE", "OPENAI_COMPATIBLE"]),
  name: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  isDefault: z.boolean().default(false),
});

function serialize(provider: { apiKeyEncrypted: string | null; [k: string]: unknown }) {
  const { apiKeyEncrypted: _omit, ...rest } = provider;
  void _omit;
  return { ...rest, hasApiKey: Boolean(provider.apiKeyEncrypted) };
}

export async function GET() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const providers = await prisma.lLMProvider.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(providers.map(serialize));
  });
}

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const body = createProviderSchema.parse(await req.json());

    if (body.isDefault) {
      await prisma.lLMProvider.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const provider = await prisma.lLMProvider.create({
      data: {
        userId,
        kind: body.kind,
        name: body.name,
        apiKeyEncrypted: body.apiKey ? encryptSecret(body.apiKey) : null,
        baseUrl: body.baseUrl,
        defaultModel: body.defaultModel,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        systemPrompt: body.systemPrompt,
        isDefault: body.isDefault,
      },
    });

    return NextResponse.json(
      { ...serialize(provider), apiKeyMasked: body.apiKey ? maskSecret(body.apiKey) : null },
      { status: 201 }
    );
  });
}
