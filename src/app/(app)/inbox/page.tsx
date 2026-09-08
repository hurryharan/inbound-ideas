"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import type { Idea, Source } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";

export default function InboxPage() {
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: ideas, mutate } = useSWR<Idea[]>(
    `/api/ideas?status=NEW,SURFACED${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    fetchJson
  );
  const { data: sources } = useSWR<Source[]>("/api/sources", fetchJson);

  async function refreshAll() {
    if (!sources || sources.length === 0) return;
    setRefreshing(true);
    try {
      await Promise.allSettled(sources.filter((s) => s.enabled).map((s) => postJson(`/api/sources/${s.id}/refresh`, {})));
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Inbound</h1>
          <p className="mt-1 text-sm text-neutral-500">
            New ideas surfaced from your sources. Explore one worth thinking about, or mark it Interesting, Park, or
            Archive to clear it out.
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {ideas ? `${ideas.length} item${ideas.length === 1 ? "" : "s"} worth exploring` : "Loading…"}
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh Sources"}
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search inbound ideas…"
        className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />

      <div className="mt-6 space-y-4">
        {ideas?.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            Nothing new right now. Connect a source or hit Refresh to pull in more inbound material.
          </div>
        )}
        {ideas?.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
