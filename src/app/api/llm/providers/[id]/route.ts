import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute, jsonError } from "@/lib/api-helpers";
import { encryptSecret } from "@/lib/crypto";

const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  isDefault: z.boolean().optional(),
  inputPricePerMillion: z.number().min(0).nullable().optional(),
  outputPricePerMillion: z.number().min(0).nullable().optional(),
});

function serialize(provider: { apiKeyEncrypted: string | null; [k: string]: unknown }) {
  const { apiKeyEncrypted: _omit, ...rest } = provider;
  void _omit;
  return { ...rest, hasApiKey: Boolean(provider.apiKeyEncrypted) };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await prisma.lLMProvider.findFirst({ where: { id, userId } });
    if (!existing) return jsonError("Provider not found", 404);

    const body = updateProviderSchema.parse(await req.json());

    if (body.isDefault) {
      await prisma.lLMProvider.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
    }

    const { apiKey, ...rest } = body;
    const provider = await prisma.lLMProvider.update({
      where: { id },
      data: { ...rest, ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}) },
    });

    return NextResponse.json(serialize(provider));
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const existing = await prisma.lLMProvider.findFirst({ where: { id, userId } });
    if (!existing) return jsonError("Provider not found", 404);

    await prisma.lLMProvider.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
