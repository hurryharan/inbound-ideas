"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import type { Source, SourceType } from "@/lib/types";

const TYPE_LABEL: Record<SourceType, string> = {
  LINKEDIN_SAVED_POSTS: "LinkedIn Saved Posts",
  GOOGLE_SHEET: "Google Sheet",
  GOOGLE_DRIVE_DOCUMENT: "Google Drive Document",
  GOOGLE_DRIVE_FOLDER: "Google Drive Folder",
};

function AddSourceForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<SourceType>("LINKEDIN_SAVED_POSTS");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [titleCol, setTitleCol] = useState("Title");
  const [bodyCol, setBodyCol] = useState("Idea");
  const [topicCol, setTopicCol] = useState("Topic");
  const [urlCol, setUrlCol] = useState("URL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const config =
        type === "GOOGLE_SHEET"
          ? {
              spreadsheetUrl,
              sheetName,
              columnMapping: { title: titleCol, body: bodyCol, topic: topicCol, sourceUrl: urlCol },
            }
          : {};

      await postJson("/api/sources", {
        type,
        name,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        priority,
        config,
      });
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SourceType)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
          >
            <option value="LINKEDIN_SAVED_POSTS">LinkedIn Saved Posts</option>
            <option value="GOOGLE_SHEET">Google Sheet</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
          />
        </label>
      </div>

      {type === "GOOGLE_SHEET" && (
        <div className="space-y-3 rounded-md bg-neutral-50 p-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-neutral-500">Spreadsheet URL</span>
            <input
              required
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-neutral-500">Sheet name</span>
            <input
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <p className="text-xs font-medium text-neutral-500">Column mapping</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-neutral-500">
              Title column
              <input value={titleCol} onChange={(e) => setTitleCol(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-500">
              Idea/body column
              <input value={bodyCol} onChange={(e) => setBodyCol(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-500">
              Topic column
              <input value={topicCol} onChange={(e) => setTopicCol(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-500">
              URL column
              <input value={urlCol} onChange={(e) => setUrlCol(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
        </div>
      )}

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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add Source"}
      </button>
    </form>
  );
}

function SourceRow({ source, onChange }: { source: Source; onChange: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await postJson<{ createdCount: number; ideaCount: number }>(`/api/sources/${source.id}/refresh`, {});
      setMessage(`Imported ${result.createdCount} new item(s), ${result.ideaCount} idea(s) surfaced.`);
      onChange();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/sources/${source.id}/import`, { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      setMessage(`Imported ${body.createdCount} new item(s), ${body.ideaCount} idea(s) surfaced.`);
      onChange();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function toggleEnabled() {
    await postJson(`/api/sources/${source.id}`, { enabled: !source.enabled }, "PATCH");
    onChange();
  }

  async function remove() {
    if (!confirm(`Delete "${source.name}" and its imported items?`)) return;
    await postJson(`/api/sources/${source.id}`, {}, "DELETE");
    onChange();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">{source.name}</p>
          <p className="text-xs text-neutral-500">
            {TYPE_LABEL[source.type]} · {source._count.items} items ·{" "}
            {source.lastRefreshedAt ? `refreshed ${new Date(source.lastRefreshedAt).toLocaleDateString()}` : "never refreshed"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${source.enabled ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-500"}`}>
          {source.enabled ? "Active" : "Disabled"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {source.type === "LINKEDIN_SAVED_POSTS" ? (
          <>
            <input ref={fileInput} type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
            >
              Import CSV/JSON
            </button>
          </>
        ) : (
          <button
            onClick={refresh}
            disabled={busy}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {busy ? "Working…" : "Refresh"}
          </button>
        )}
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

export default function SourcesPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: sources, mutate } = useSWR<Source[]>("/api/sources", fetchJson);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Sources</h1>
          <p className="mt-1 text-sm text-neutral-500">Where inbound material comes from.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Add Source
        </button>
      </div>

      {showForm && <AddSourceForm onCreated={() => { setShowForm(false); mutate(); }} />}

      <div className="mt-6 space-y-3">
        {sources?.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No sources yet. Add a LinkedIn import or a Google Sheet to start collecting ideas.
          </div>
        )}
        {sources?.map((s) => (
          <SourceRow key={s.id} source={s} onChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
