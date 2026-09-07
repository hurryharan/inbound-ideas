"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/api-client";
import type { Idea } from "@/lib/types";

const STATUS_LABEL: Record<Idea["status"], string> = {
  NEW: "New",
  SURFACED: "Surfaced",
  EXPLORING: "Exploring",
  EXPLORED: "Explored",
  PARKED: "Parked",
  ARCHIVED: "Archived",
};

const STATUS_COLOR: Record<Idea["status"], string> = {
  NEW: "bg-blue-100 text-blue-800",
  SURFACED: "bg-amber-100 text-amber-800",
  EXPLORING: "bg-purple-100 text-purple-800",
  EXPLORED: "bg-green-100 text-green-800",
  PARKED: "bg-neutral-200 text-neutral-600",
  ARCHIVED: "bg-neutral-200 text-neutral-500",
};

export function IdeaCard({ idea, onChange }: { idea: Idea; onChange?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const source = idea.sourceItems[0]?.sourceItem;

  async function sendFeedback(feedback: string) {
    setBusy(feedback);
    try {
      await postJson(`/api/ideas/${idea.id}`, { feedback }, "PATCH");
      onChange?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/ideas/${idea.id}`} className="text-base font-semibold text-neutral-900 hover:underline">
            {idea.title}
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            {source ? `${source.source.name} · ${source.sourceType.replaceAll("_", " ").toLowerCase()}` : "Inbound"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[idea.status]}`}>
          {STATUS_LABEL[idea.status]}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Why interesting</p>
          <p className="text-neutral-700">{idea.whyRelevant}</p>
        </div>
        {idea.potentialThesis && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Potential thesis</p>
            <p className="text-neutral-700">{idea.potentialThesis}</p>
          </div>
        )}
      </div>

      {idea.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {idea.topics.map((t) => (
            <span key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/ideas/${idea.id}`}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
        >
          Explore
        </Link>
        <button
          disabled={busy !== null}
          onClick={() => sendFeedback("INTERESTING")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Interesting
        </button>
        <button
          disabled={busy !== null}
          onClick={() => sendFeedback("PARK")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Park
        </button>
        <button
          disabled={busy !== null}
          onClick={() => sendFeedback("ARCHIVE")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
