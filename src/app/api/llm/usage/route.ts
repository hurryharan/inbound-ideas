import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/current-user";
import { handleRoute } from "@/lib/api-helpers";

/**
 * Aggregated usage/cost data for the Usage dashboard: totals, a breakdown by
 * workflow (which use case costs more), a breakdown by provider, and a
 * recent-calls list for drill-down.
 */
export async function GET() {
  return handleRoute(async () => {
    const userId = await getCurrentUserId();

    const [totals, byWorkflow, byProvider, recentEvents, unpricedCount] = await Promise.all([
      prisma.lLMUsageEvent.aggregate({
        where: { userId },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
      prisma.lLMUsageEvent.groupBy({
        by: ["workflow"],
        where: { userId },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
      prisma.lLMUsageEvent.groupBy({
        by: ["llmProviderId", "providerName", "providerKind"],
        where: { userId },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
      prisma.lLMUsageEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.lLMUsageEvent.count({ where: { userId, costUsd: null } }),
    ]);

    return NextResponse.json({
      totals: {
        calls: totals._count,
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        costUsd: totals._sum.costUsd,
        unpricedCalls: unpricedCount,
      },
      byWorkflow: byWorkflow
        .map((w) => ({
          workflow: w.workflow,
          calls: w._count,
          inputTokens: w._sum.inputTokens ?? 0,
          outputTokens: w._sum.outputTokens ?? 0,
          costUsd: w._sum.costUsd,
        }))
        .sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)),
      byProvider: byProvider
        .map((p) => ({
          llmProviderId: p.llmProviderId,
          providerName: p.providerName,
          providerKind: p.providerKind,
          calls: p._count,
          inputTokens: p._sum.inputTokens ?? 0,
          outputTokens: p._sum.outputTokens ?? 0,
          costUsd: p._sum.costUsd,
        }))
        .sort((a, b) => (b.costUsd ?? 0) - (a.costUsd ?? 0)),
      recentEvents,
    });
  });
}
