"use client";

import useSWR from "swr";
import { fetchJson } from "@/lib/api-client";
import { SettingsSubNav } from "@/components/settings-subnav";
import type { LLMUsageSummary, LLMWorkflow, LLMProviderKind } from "@/lib/types";

const WORKFLOW_LABEL: Record<LLMWorkflow, string> = {
  IDEA_GENERATION: "Idea generation",
};

const PROVIDER_KIND_LABEL: Record<LLMProviderKind, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GOOGLE: "Google",
  OPENAI_COMPATIBLE: "OpenAI-compatible",
};

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatTile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-neutral-500">{sublabel}</p>}
    </div>
  );
}

interface BreakdownRow {
  label: string;
  sublabel: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

function BreakdownTable({ title, rows, emptyText }: { title: string; rows: BreakdownRow[]; emptyText: string }) {
  const maxCost = Math.max(1, ...rows.map((r) => r.costUsd ?? 0));

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={`${row.label}-${row.sublabel}`} className="rounded-md border border-neutral-200 bg-white p-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{row.label}</p>
                  <p className="text-xs text-neutral-500">{row.sublabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-neutral-900">{formatUsd(row.costUsd)}</p>
                  <p className="text-xs text-neutral-500">
                    {row.calls} call{row.calls === 1 ? "" : "s"} · {formatTokens(row.inputTokens + row.outputTokens)} tokens
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-100">
                <div
                  className="h-1.5 rounded-full bg-neutral-900"
                  style={{ width: `${row.costUsd ? Math.max(4, (row.costUsd / maxCost) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function UsagePage() {
  const { data } = useSWR<LLMUsageSummary>("/api/llm/usage", fetchJson);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <SettingsSubNav />
      </div>

      <h1 className="text-xl font-semibold text-neutral-900">Usage &amp; Cost</h1>
      <p className="mt-1 text-sm text-neutral-500">
        What idea generation is actually costing, broken down by workflow and by LLM provider.
      </p>

      {!data ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total cost" value={formatUsd(data.totals.costUsd)} />
            <StatTile label="Calls" value={String(data.totals.calls)} />
            <StatTile label="Input tokens" value={formatTokens(data.totals.inputTokens)} />
            <StatTile label="Output tokens" value={formatTokens(data.totals.outputTokens)} />
          </div>

          {data.totals.unpricedCalls > 0 && (
            <p className="mt-3 text-xs text-amber-700">
              {data.totals.unpricedCalls} call{data.totals.unpricedCalls === 1 ? "" : "s"} excluded from the cost total —
              set pricing on the relevant provider in{" "}
              <a href="/llm" className="underline">
                LLM Providers
              </a>{" "}
              to include them.
            </p>
          )}

          <div className="mt-8 space-y-8">
            <BreakdownTable
              title="By workflow"
              emptyText="No LLM calls recorded yet. Ideas are being generated heuristically, or no source has been refreshed with a provider configured."
              rows={data.byWorkflow.map((w) => ({
                label: WORKFLOW_LABEL[w.workflow] ?? w.workflow,
                sublabel: "use case",
                calls: w.calls,
                inputTokens: w.inputTokens,
                outputTokens: w.outputTokens,
                costUsd: w.costUsd,
              }))}
            />

            <BreakdownTable
              title="By provider"
              emptyText="No LLM calls recorded yet."
              rows={data.byProvider.map((p) => ({
                label: p.providerName,
                sublabel: PROVIDER_KIND_LABEL[p.providerKind] ?? p.providerKind,
                calls: p.calls,
                inputTokens: p.inputTokens,
                outputTokens: p.outputTokens,
                costUsd: p.costUsd,
              }))}
            />
          </div>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent calls</h2>
            {data.recentEvents.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">Nothing yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-md border border-neutral-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-400">
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Workflow</th>
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens (in/out)</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentEvents.map((e) => (
                      <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                        <td className="px-3 py-2 text-neutral-500">{new Date(e.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 text-neutral-700">{WORKFLOW_LABEL[e.workflow] ?? e.workflow}</td>
                        <td className="px-3 py-2 text-neutral-700">{e.providerName}</td>
                        <td className="px-3 py-2 text-neutral-500">{e.model}</td>
                        <td className="px-3 py-2 text-right text-neutral-700">
                          {formatTokens(e.inputTokens)} / {formatTokens(e.outputTokens)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-neutral-900">{formatUsd(e.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
