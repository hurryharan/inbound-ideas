"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import type { Idea, LLMProvider, Session } from "@/lib/types";

interface PreparedIdeation {
  prompt: string;
  contextDocumentIds: string[];
  llmProvider: { id: string; kind: string; defaultModel: string; baseUrl: string | null } | null;
  launch: { strategy: "deep_link" | "clipboard"; url: string };
}

export default function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: idea, mutate } = useSWR<Idea & { sessions: Session[] }>(`/api/ideas/${id}`, fetchJson);
  const { data: providers } = useSWR<LLMProvider[]>("/api/llm/providers", fetchJson);

  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<PreparedIdeation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providerId = selectedProviderId || providers?.find((p) => p.isDefault)?.id || providers?.[0]?.id || "";

  async function explore() {
    setLaunching(true);
    setError(null);
    try {
      const prepared = await postJson<PreparedIdeation>("/api/ideation/prepare", {
        ideaId: id,
        llmProviderId: providerId || undefined,
      });
      setLaunchResult(prepared);

      if (prepared.launch.strategy === "deep_link") {
        window.open(prepared.launch.url, "_blank", "noopener,noreferrer");
      } else {
        try {
          await navigator.clipboard.writeText(prepared.prompt);
        } catch {
          // clipboard may be unavailable (e.g. insecure context) — the prompt is still shown below to copy manually.
        }
        window.open(prepared.launch.url, "_blank", "noopener,noreferrer");
      }

      await postJson("/api/sessions", {
        ideaId: id,
        llmProviderId: prepared.llmProvider?.id,
        llmModel: prepared.llmProvider?.defaultModel ?? "unknown",
        externalChatUrl: prepared.launch.url,
        promptText: prepared.prompt,
        contextDocumentIds: prepared.contextDocumentIds,
      });
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to prepare ideation session.");
    } finally {
      setLaunching(false);
    }
  }

  if (!idea) return <div className="p-8 text-sm text-neutral-500">Loading…</div>;

  const source = idea.sourceItems[0]?.sourceItem;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/inbox" className="text-xs text-neutral-400 hover:text-neutral-700">
        ← Back to Inbox
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{idea.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {source ? source.source.name : "Inbound"}
        {source?.url && (
          <>
            {" · "}
            <a href={source.url} target="_blank" rel="noreferrer" className="underline">
              view original
            </a>
          </>
        )}
      </p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Why this is interesting</h2>
        <p className="mt-1 text-sm text-neutral-800">{idea.whyRelevant}</p>
        <p className="mt-2 text-sm text-neutral-600">{idea.observation}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Potential thesis</h2>
        <p className="mt-1 text-sm text-neutral-800">{idea.potentialThesis}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {idea.angles.length} possible direction{idea.angles.length === 1 ? "" : "s"}
        </h2>
        <div className="mt-2 space-y-3">
          {idea.angles.map((angle, i) => (
            <div key={angle.label} className="rounded-md border border-neutral-200 p-3">
              <p className="text-sm font-medium text-neutral-900">
                {String.fromCharCode(65 + i)} — {angle.label}
              </p>
              <p className="mt-0.5 text-sm text-neutral-600">{angle.description}</p>
            </div>
          ))}
        </div>
      </section>

      {idea.contextDocuments.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Relevant context</h2>
          <ul className="mt-2 space-y-1">
            {idea.contextDocuments.map((link) => (
              <li key={link.contextDocument.id} className="text-sm text-neutral-700">
                ✓ {link.contextDocument.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={providerId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {providers?.length ? (
              providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.defaultModel}){p.isDefault ? " · default" : ""}
                </option>
              ))
            ) : (
              <option value="">No LLM provider configured</option>
            )}
          </select>
          <button
            onClick={explore}
            disabled={launching}
            className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {launching ? "Preparing…" : "Explore"}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {launchResult && (
          <div className="mt-3 text-xs text-neutral-500">
            {launchResult.launch.strategy === "deep_link"
              ? "Opened a new chat with the idea pre-filled."
              : "Copied the ideation prompt to your clipboard and opened the provider — paste it into the new chat."}
            <details className="mt-2">
              <summary className="cursor-pointer text-neutral-600">View prepared prompt</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs text-neutral-700">
                {launchResult.prompt}
              </pre>
            </details>
          </div>
        )}
      </section>

      {idea.sessions?.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Past sessions</h2>
          <ul className="mt-2 space-y-1">
            {idea.sessions.map((s) => (
              <li key={s.id} className="text-sm text-neutral-700">
                {new Date(s.startedAt).toLocaleString()} ·{" "}
                {s.externalChatUrl ? (
                  <a href={s.externalChatUrl} target="_blank" rel="noreferrer" className="underline">
                    Open
                  </a>
                ) : (
                  "no link"
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
