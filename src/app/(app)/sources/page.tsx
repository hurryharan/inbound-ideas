"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchJson, postJson } from "@/lib/api-client";
import { SettingsSubNav } from "@/components/settings-subnav";
import type { ColumnMapping, Source } from "@/lib/types";

function AddSourceForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [tags, setTags] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/sources", {
        name,
        config: { spreadsheetUrl, sheetName },
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        priority,
      });
      setName("");
      setSpreadsheetUrl("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">
        Every source is a Google Sheet — export LinkedIn saved posts, Twitter bookmarks, or anything else into a
        sheet periodically, and point this at it. Title/content/URL columns are detected automatically from the
        header row; you can remap them after the first refresh if detection gets it wrong.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. LinkedIn Saved Posts"
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-neutral-500">Sheet name</span>
          <input
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
          />
        </label>
      </div>

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

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "title", label: "Title column" },
  { key: "body", label: "Content column" },
  { key: "topic", label: "Topic column" },
  { key: "sourceUrl", label: "URL column" },
  { key: "author", label: "Author column" },
];

function EditSourceForm({ source, onSaved, onCancel }: { source: Source; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(source.name);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(source.config.spreadsheetUrl ?? "");
  const [sheetName, setSheetName] = useState(source.config.sheetName ?? "");
  const [tags, setTags] = useState(source.tags.join(", "));
  const [priority, setPriority] = useState(source.priority);
  const [mapping, setMapping] = useState<ColumnMapping>(source.config.columnMapping ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await postJson(
        `/api/sources/${source.id}`,
        {
          name,
          config: { spreadsheetUrl, sheetName, columnMapping: mapping },
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          priority,
        },
        "PATCH"
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-md bg-neutral-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-neutral-500">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-neutral-500">
          Sheet name
          <input value={sheetName} onChange={(e) => setSheetName(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <label className="block text-xs text-neutral-500">
        Spreadsheet URL
        <input value={spreadsheetUrl} onChange={(e) => setSpreadsheetUrl(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-neutral-500">
          Tags (comma separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-neutral-500">
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Source["priority"])} className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </div>

      <p className="text-xs font-medium text-neutral-500">Column mapping (leave blank to auto-detect)</p>
      <div className="grid grid-cols-2 gap-2">
        {MAPPING_FIELDS.map(({ key, label }) => (
          <label key={key} className="text-xs text-neutral-500">
            {label}
            <input
              value={mapping[key] ?? ""}
              onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
              placeholder="auto-detected"
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

function SourceRow({ source, onChange }: { source: Source; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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

  async function toggleEnabled() {
    await postJson(`/api/sources/${source.id}`, { enabled: !source.enabled }, "PATCH");
    onChange();
  }

  async function remove() {
    if (!confirm(`Delete "${source.name}" and its imported items?`)) return;
    await postJson(`/api/sources/${source.id}`, {}, "DELETE");
    onChange();
  }

  const mapping = source.config.columnMapping;
  const mappingSummary = mapping
    ? MAPPING_FIELDS.filter(({ key }) => mapping[key]).map(({ label, key }) => `${label.replace(" column", "")} → "${mapping[key]}"`).join(", ")
    : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900">{source.name}</p>
          <p className="text-xs text-neutral-500">
            {source._count.items} items ·{" "}
            {source.lastRefreshedAt ? `refreshed ${new Date(source.lastRefreshedAt).toLocaleDateString()}` : "never refreshed"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${source.enabled ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-500"}`}>
          {source.enabled ? "Active" : "Disabled"}
        </span>
      </div>

      {mappingSummary && !editing && <p className="mt-2 text-xs text-neutral-400">Detected columns: {mappingSummary}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={refresh}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {busy ? "Working…" : "Refresh"}
        </button>
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button onClick={toggleEnabled} className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
          {source.enabled ? "Disable" : "Enable"}
        </button>
        <button onClick={remove} className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
          Delete
        </button>
      </div>

      {editing && (
        <EditSourceForm source={source} onSaved={() => { setEditing(false); onChange(); }} onCancel={() => setEditing(false)} />
      )}

      {message && <p className="mt-2 text-xs text-neutral-500">{message}</p>}
    </div>
  );
}

export default function SourcesPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: sources, mutate } = useSWR<Source[]>("/api/sources", fetchJson);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <SettingsSubNav />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Sources</h1>
          <p className="mt-1 text-sm text-neutral-500">Google Sheets you feed inbound material into.</p>
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
            No sources yet. Add a Google Sheet — populate it from LinkedIn, Twitter, or anywhere else — to start
            collecting ideas.
          </div>
        )}
        {sources?.map((s) => (
          <SourceRow key={s.id} source={s} onChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
