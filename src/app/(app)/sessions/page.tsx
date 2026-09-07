"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetchJson } from "@/lib/api-client";
import type { Session } from "@/lib/types";

export default function SessionsPage() {
  const { data: sessions } = useSWR<Session[]>("/api/sessions", fetchJson);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold text-neutral-900">Ideation Sessions</h1>
      <p className="mt-1 text-sm text-neutral-500">Every idea you&apos;ve launched into a chat, and where to find it again.</p>

      <div className="mt-6 space-y-3">
        {sessions?.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No sessions yet — explore an idea from the Inbox to start one.
          </div>
        )}
        {sessions?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <Link href={`/ideas/${s.ideaId}`} className="text-sm font-medium text-neutral-900 hover:underline">
                {s.idea?.title ?? "Untitled idea"}
              </Link>
              <p className="mt-0.5 text-xs text-neutral-500">
                {s.llmProvider?.name ?? "Unknown provider"} · {s.llmModel} ·{" "}
                {new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">{s.status.replace("_", " ").toLowerCase()}</span>
              {s.externalChatUrl && (
                <a
                  href={s.externalChatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Open
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
