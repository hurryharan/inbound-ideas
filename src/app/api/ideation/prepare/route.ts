import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";
import { prepareIdeation } from "@/lib/ideas/ideation";

const prepareSchema = z.object({
  ideaId: z.string().min(1),
  llmProviderId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();
    const body = prepareSchema.parse(await req.json());
    const prepared = await prepareIdeation(userId, body.ideaId, body.llmProviderId);
    return NextResponse.json(prepared);
  });
}
