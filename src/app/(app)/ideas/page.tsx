"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import type { Idea, IdeaStatus, Source } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";

type IdeaView = IdeaStatus | "ALL" | "FUNNEL";

const STATUS_TABS: { label: string; value: IdeaView }[] = [
  { label: "Funnel", value: "FUNNEL" },
  { label: "All", value: "ALL" },
  { label: "Surfaced", value: "SURFACED" },
  { label: "Exploring", value: "EXPLORING" },
  { label: "Explored", value: "EXPLORED" },
  { label: "Parked", value: "PARKED" },
  { label: "Archived", value: "ARCHIVED" },
];

export default function IdeasPage() {
  const [status, setStatus] = useState<IdeaView>("FUNNEL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"score" | "recent">("score");
  const [refreshing, setRefreshing] = useState(false);

  const params = new URLSearchParams();
  if (status === "FUNNEL") params.set("status", "NEW,SURFACED");
  else if (status !== "ALL") params.set("status", status);
  if (search) params.set("search", search);
  params.set("sort", sort);

  const { data: ideas, mutate } = useSWR<Idea[]>(`/api/ideas?${params.toString()}`, fetchJson);
  const { data: sources } = useSWR<Source[]>("/api/sources", fetchJson);
  const topics = Array.from(new Set(ideas?.flatMap((i) => i.topics) ?? [])).slice(0, 12);

  async function refreshAll() {
    if (!sources || sources.length === 0) return;
    setRefreshing(true);
    try {
      await Promise.allSettled(sources.filter((source) => source.enabled).map((source) => postJson(`/api/sources/${source.id}/refresh`, {})));
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Ideas</h1>
          <p className="mt-1 text-sm text-neutral-500">One funnel for sourced material, surfaced ideas, and everything you have already explored.</p>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh Sources"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              status === tab.value ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-64 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "score" | "recent")}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="score">Sort: Most interesting</option>
          <option value="recent">Sort: Most recent</option>
        </select>
      </div>

      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 text-xs text-neutral-400">
          Topics seen: {topics.join(", ")}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {ideas?.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No ideas match this filter. Refresh Sources to pull in new material.
          </div>
        )}
        {ideas?.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
