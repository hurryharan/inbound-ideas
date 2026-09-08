"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import { SettingsSubNav } from "@/components/settings-subnav";

interface RankingWeights {
  interestingness: number;
  relevance: number;
  novelty: number;
  connectionPotential: number;
  sourceQuality: number;
}

interface Preferences {
  rankingWeights: RankingWeights;
  ideationPrompt: string;
  general: { inboxDailySuggestionCount: number };
}

const WEIGHT_LABELS: { key: keyof RankingWeights; label: string }[] = [
  { key: "interestingness", label: "Interestingness" },
  { key: "relevance", label: "Relevance" },
  { key: "novelty", label: "Novelty" },
  { key: "connectionPotential", label: "Connection potential" },
  { key: "sourceQuality", label: "Source quality" },
];

type Tab = "general" | "ranking" | "prompt";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  const { data: prefs, mutate } = useSWR<Preferences>("/api/preferences", fetchJson);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <SettingsSubNav />
      </div>

      <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        How often to surface ideas, how they&apos;re ranked, and the instructions handed to your LLM.
      </p>

      <div className="mt-4 flex gap-1">
        {(["general", "ranking", "prompt"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {t === "general" ? "General" : t === "ranking" ? "Idea Ranking" : "Ideation Prompt"}
          </button>
        ))}
      </div>

      {!prefs ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mt-6">
          {tab === "general" && <GeneralTab prefs={prefs} onSaved={() => mutate()} />}
          {tab === "ranking" && <RankingTab prefs={prefs} onSaved={() => mutate()} />}
          {tab === "prompt" && <PromptTab key={prefs.ideationPrompt} prefs={prefs} onSaved={() => mutate()} />}
        </div>
      )}
    </div>
  );
}

function GeneralTab({ prefs, onSaved }: { prefs: Preferences; onSaved: () => void }) {
  const [count, setCount] = useState(prefs.general.inboxDailySuggestionCount);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await postJson("/api/preferences", { general: { inboxDailySuggestionCount: count } }, "PATCH");
    setSaving(false);
    onSaved();
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      <label className="block text-sm">
        <span className="text-xs font-medium text-neutral-500">Ideas to surface per day (3–7 recommended)</span>
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="mt-1 w-32 rounded-md border border-neutral-300 px-2 py-1.5"
        />
      </label>
      <button onClick={save} disabled={saving} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function RankingTab({ prefs, onSaved }: { prefs: Preferences; onSaved: () => void }) {
  const [weights, setWeights] = useState(prefs.rankingWeights);
  const [saving, setSaving] = useState(false);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  async function save() {
    setSaving(true);
    await postJson("/api/preferences", { rankingWeights: weights }, "PATCH");
    setSaving(false);
    onSaved();
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
      {WEIGHT_LABELS.map(({ key, label }) => (
        <label key={key} className="block text-sm">
          <span className="text-xs font-medium text-neutral-500">
            {label}: {weights[key].toFixed(2)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={weights[key]}
            onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
            className="mt-1 w-full"
          />
        </label>
      ))}
      <p className={`text-xs ${Math.abs(total - 1) > 0.01 ? "text-amber-600" : "text-neutral-400"}`}>
        Weights sum to {total.toFixed(2)} (should sum to ~1.00 for a normalized score).
      </p>
      <button onClick={save} disabled={saving} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function PromptTab({ prefs, onSaved }: { prefs: Preferences; onSaved: () => void }) {
  const [template, setTemplate] = useState(prefs.ideationPrompt);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await postJson("/api/preferences", { ideationPrompt: template }, "PATCH");
    setSaving(false);
    onSaved();
  }

  async function resetToDefault() {
    const res = await fetch("/api/preferences/default-prompt");
    const { defaultPrompt } = await res.json();
    setTemplate(defaultPrompt);
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={20}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs leading-relaxed"
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={resetToDefault} className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          Reset to default
        </button>
      </div>
    </div>
  );
}
