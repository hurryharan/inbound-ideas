"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchJson } from "@/lib/api-client";
import type { Idea, IdeaStatus } from "@/lib/types";
import { IdeaCard } from "@/components/idea-card";

const STATUS_TABS: { label: string; value: IdeaStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "New", value: "NEW" },
  { label: "Surfaced", value: "SURFACED" },
  { label: "Exploring", value: "EXPLORING" },
  { label: "Explored", value: "EXPLORED" },
  { label: "Parked", value: "PARKED" },
  { label: "Archived", value: "ARCHIVED" },
];

export default function IdeasPage() {
  const [status, setStatus] = useState<IdeaStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"score" | "recent">("score");

  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (search) params.set("search", search);
  params.set("sort", sort);

  const { data: ideas, mutate } = useSWR<Idea[]>(`/api/ideas?${params.toString()}`, fetchJson);
  const topics = Array.from(new Set(ideas?.flatMap((i) => i.topics) ?? [])).slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-neutral-900">Ideas</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every idea that&apos;s ever been surfaced, at any stage. Filter by status, search, or sort to find one again.
      </p>

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
            No ideas match this filter.
          </div>
        )}
        {ideas?.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
