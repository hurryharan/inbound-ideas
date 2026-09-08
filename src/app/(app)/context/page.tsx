"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import { SettingsSubNav } from "@/components/settings-subnav";
import type { ContextSource, ContextSourceType } from "@/lib/types";

const TYPE_LABEL: Record<ContextSourceType, string> = {
  GOOGLE_DRIVE_DOCUMENT: "Google Doc",
  GOOGLE_DRIVE_FOLDER: "Google Drive Folder",
  GOOGLE_SHEET: "Google Sheet",
};

function GoogleConnectBanner() {
  const params = useSearchParams();
  const { data } = useSWR<{ connected: boolean }>("/api/context/google", fetchJson);
  const connectedNotice = params.get("google_connected");
  const errorNotice = params.get("google_error");

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-neutral-900">Google Drive</p>
        <p className="text-xs text-neutral-500">
          {data?.connected ? "Connected — read-only access to Docs, Sheets and folders." : "Not connected."}
        </p>
        {connectedNotice && <p className="mt-1 text-xs text-green-700">Google connected successfully.</p>}
        {errorNotice && <p className="mt-1 text-xs text-red-600">{errorNotice}</p>}
      </div>
      {data?.connected ? (
        <button
          onClick={async () => {
            await postJson("/api/context/google", {}, "DELETE");
            location.reload();
          }}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Disconnect
        </button>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route that issues a
              server-side redirect into the Google OAuth flow, not a page navigation. */}
          <a
            href="/api/context/google/auth"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            Connect Google
          </a>
        </>
      )}
    </div>
  );
}

function AddContextForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ContextSourceType>("GOOGLE_DRIVE_FOLDER");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/context", {
        name,
        description,
        type,
        url,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        priority,
        instructions,
      });
      setName("");
      setUrl("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add context source");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as ContextSourceType)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5">
            <option value="GOOGLE_DRIVE_FOLDER">Google Drive Folder</option>
            <option value="GOOGLE_DRIVE_DOCUMENT">Google Doc</option>
            <option value="GOOGLE_SHEET">Google Sheet</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-medium text-neutral-500">Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
      </label>

      <label className="block text-sm">
        <span className="text-xs font-medium text-neutral-500">Google Drive URL</span>
        <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a Drive folder/doc/sheet link" className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-medium text-neutral-500">Instructions (optional — how the LLM should use this context)</span>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5" />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={saving} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
        {saving ? "Saving…" : "Add Context Source"}
      </button>
    </form>
  );
}

function ContextRow({ source, onChange }: { source: ContextSource; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await postJson<{ documentCount: number }>(`/api/context/${source.id}/refresh`, {});
      setMessage(`Indexed ${result.documentCount} document(s).`);
      onChange();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refresh failed — is Google connected?");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    await postJson(`/api/context/${source.id}`, { enabled: !source.enabled }, "PATCH");
    onChange();
  }

  async function remove() {
    if (!confirm(`Delete "${source.name}"?`)) return;
    await postJson(`/api/context/${source.id}`, {}, "DELETE");
    onChange();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">{source.name}</p>
          <p className="text-xs text-neutral-500">
            {TYPE_LABEL[source.type]} · {source._count.documents} document(s) · tags: {source.tags.join(", ") || "none"} · priority: {source.priority.toLowerCase()}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${source.enabled ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-500"}`}>
          {source.enabled ? "Active" : "Disabled"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={refresh} disabled={busy} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">
          {busy ? "Working…" : "Refresh"}
        </button>
        <button onClick={toggleEnabled} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
          {source.enabled ? "Disable" : "Enable"}
        </button>
        <button onClick={remove} className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
          Delete
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-neutral-500">{message}</p>}
    </div>
  );
}

export default function ContextPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: sources, mutate } = useSWR<ContextSource[]>("/api/context", fetchJson);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <SettingsSubNav />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Context</h1>
          <p className="mt-1 text-sm text-neutral-500">Companies, products, projects and your own thinking — used to explain why an idea matters to you.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800">
          + Add Source
        </button>
      </div>

      <Suspense>
        <GoogleConnectBanner />
      </Suspense>

      {showForm && <AddContextForm onCreated={() => { setShowForm(false); mutate(); }} />}

      <div className="mt-6 space-y-3">
        {sources?.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No context sources yet. Connect Google, then add a folder or document.
          </div>
        )}
        {sources?.map((s) => (
          <ContextRow key={s.id} source={s} onChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
