import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import {
  getGeneralPreferences,
  getIdeationPrompt,
  getRankingWeights,
  setGeneralPreferences,
  setIdeationPrompt,
  setRankingWeights,
} from "@/lib/preferences";

const rankingWeightsSchema = z.object({
  interestingness: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  connectionPotential: z.number().min(0).max(1),
  sourceQuality: z.number().min(0).max(1),
});

const updateSchema = z.object({
  rankingWeights: rankingWeightsSchema.optional(),
  ideationPrompt: z.string().min(1).optional(),
  general: z.object({ inboxDailySuggestionCount: z.number().int().min(1).max(20) }).optional(),
});

export async function GET() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const [rankingWeights, ideationPrompt, general] = await Promise.all([
      getRankingWeights(userId),
      getIdeationPrompt(userId),
      getGeneralPreferences(userId),
    ]);
    return NextResponse.json({ rankingWeights, ideationPrompt, general });
  });
}

export async function PATCH(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const body = updateSchema.parse(await req.json());

    if (body.rankingWeights) await setRankingWeights(userId, body.rankingWeights);
    if (body.ideationPrompt) await setIdeationPrompt(userId, body.ideationPrompt);
    if (body.general) await setGeneralPreferences(userId, body.general);

    const [rankingWeights, ideationPrompt, general] = await Promise.all([
      getRankingWeights(userId),
      getIdeationPrompt(userId),
      getGeneralPreferences(userId),
    ]);
    return NextResponse.json({ rankingWeights, ideationPrompt, general });
  });
}
