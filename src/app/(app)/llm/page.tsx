"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import { SettingsSubNav } from "@/components/settings-subnav";
import { suggestPricing } from "@/lib/llm/pricing";
import type { LLMProvider, LLMProviderKind } from "@/lib/types";

const KIND_LABEL: Record<LLMProviderKind, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GOOGLE: "Google",
  OPENAI_COMPATIBLE: "OpenAI-compatible",
};

const DEFAULT_MODEL: Record<LLMProviderKind, string> = {
  OPENAI: "gpt-4.1",
  ANTHROPIC: "claude-sonnet-5",
  GOOGLE: "gemini-2.5-pro",
  OPENAI_COMPATIBLE: "",
};

function AddProviderForm({ onCreated }: { onCreated: () => void }) {
  const [kind, setKind] = useState<LLMProviderKind>("ANTHROPIC");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL.ANTHROPIC);
  const [temperature, setTemperature] = useState(0.7);
  const [isDefault, setIsDefault] = useState(false);
  const initialSuggestion = suggestPricing("ANTHROPIC", DEFAULT_MODEL.ANTHROPIC);
  const [inputPrice, setInputPrice] = useState(initialSuggestion ? String(initialSuggestion.input) : "");
  const [outputPrice, setOutputPrice] = useState(initialSuggestion ? String(initialSuggestion.output) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPricingSuggestion(k: LLMProviderKind, model: string) {
    const suggestion = suggestPricing(k, model);
    setInputPrice(suggestion ? String(suggestion.input) : "");
    setOutputPrice(suggestion ? String(suggestion.output) : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/llm/providers", {
        kind,
        name: name || KIND_LABEL[kind],
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        defaultModel,
        temperature,
        isDefault,
        inputPricePerMillion: inputPrice ? Number(inputPrice) : undefined,
        outputPricePerMillion: outputPrice ? Number(outputPrice) : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add provider");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Provider</span>
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as LLMProviderKind;
              setKind(k);
              setDefaultModel(DEFAULT_MODEL[k]);
              applyPricingSuggestion(k, DEFAULT_MODEL[k]);
            }}
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
          >
            <option value="ANTHROPIC">Anthropic</option>
            <option value="OPENAI">OpenAI</option>
            <option value="GOOGLE">Google</option>
            <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={KIND_LABEL[kind]} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
        </label>
      </div>

      {kind === "OPENAI_COMPATIBLE" && (
        <label className="block text-sm">
          <span className="text-xs font-medium text-neutral-500">Base URL</span>
          <input required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">API key</span>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Default model</span>
          <input
            required
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            onBlur={(e) => applyPricingSuggestion(kind, e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="space-y-2 rounded-md bg-neutral-50 p-3">
        <p className="text-xs font-medium text-neutral-500">
          Pricing (USD per 1M tokens) — powers the Usage dashboard&apos;s cost numbers. Leave blank to still track
          token counts without a dollar figure.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-neutral-500">
            Input $/1M
            <input
              type="number"
              step="0.01"
              min="0"
              value={inputPrice}
              onChange={(e) => setInputPrice(e.target.value)}
              placeholder="e.g. 3.00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Output $/1M
            <input
              type="number"
              step="0.01"
              min="0"
              value={outputPrice}
              onChange={(e) => setOutputPrice(e.target.value)}
              placeholder="e.g. 15.00"
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      <label className="text-sm">
        <span className="text-xs font-medium text-neutral-500">Temperature: {temperature}</span>
        <input type="range" min={0} max={1.5} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="mt-1 w-full" />
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        Set as default provider
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={saving} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {saving ? "Saving…" : "Add Provider"}
      </button>
    </form>
  );
}

function EditPricingForm({ provider, onSaved, onCancel }: { provider: LLMProvider; onSaved: () => void; onCancel: () => void }) {
  const [inputPrice, setInputPrice] = useState(provider.inputPricePerMillion?.toString() ?? "");
  const [outputPrice, setOutputPrice] = useState(provider.outputPricePerMillion?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await postJson(
        `/api/llm/providers/${provider.id}`,
        {
          inputPricePerMillion: inputPrice ? Number(inputPrice) : null,
          outputPricePerMillion: outputPrice ? Number(outputPrice) : null,
        },
        "PATCH"
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-md bg-neutral-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-neutral-500">
          Input $/1M
          <input type="number" step="0.01" min="0" value={inputPrice} onChange={(e) => setInputPrice(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-neutral-500">
          Output $/1M
          <input type="number" step="0.01" min="0" value={outputPrice} onChange={(e) => setOutputPrice(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          {saving ? "Saving…" : "Save pricing"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function LLMPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null);
  const { data: providers, mutate } = useSWR<LLMProvider[]>("/api/llm/providers", fetchJson);

  async function setDefault(id: string) {
    await postJson(`/api/llm/providers/${id}`, { isDefault: true }, "PATCH");
    mutate();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    await postJson(`/api/llm/providers/${id}`, {}, "DELETE");
    mutate();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <SettingsSubNav />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">LLM Providers</h1>
          <p className="mt-1 text-sm text-neutral-500">Where ideation sessions get launched, and which model helps surface ideas.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800">
          + Add Provider
        </button>
      </div>

      {showForm && <AddProviderForm onCreated={() => { setShowForm(false); mutate(); }} />}

      <div className="mt-6 space-y-3">
        {providers?.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No providers configured. Without one, ideas are still generated using built-in heuristics — add a provider for richer ideation.
          </div>
        )}
        {providers?.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {p.name} {p.isDefault && <span className="ml-1 rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white">default</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {KIND_LABEL[p.kind]} · {p.defaultModel} · {p.hasApiKey ? "Connected ✓" : "No API key"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {p.inputPricePerMillion != null && p.outputPricePerMillion != null
                    ? `$${p.inputPricePerMillion}/$${p.outputPricePerMillion} per 1M in/out tokens`
                    : "No pricing set — usage will be tracked without a cost figure"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!p.isDefault && (
                  <button onClick={() => setDefault(p.id)} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Make default
                  </button>
                )}
                <button
                  onClick={() => setEditingPricingId(editingPricingId === p.id ? null : p.id)}
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  {editingPricingId === p.id ? "Hide pricing" : "Edit pricing"}
                </button>
                <button onClick={() => remove(p.id, p.name)} className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                  Remove
                </button>
              </div>
            </div>
            {editingPricingId === p.id && (
              <EditPricingForm provider={p} onSaved={() => { setEditingPricingId(null); mutate(); }} onCancel={() => setEditingPricingId(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
