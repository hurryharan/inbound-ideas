import Papa from "papaparse";
import type { NormalizedItem } from "./types";
import { contentHash } from "./dedup";

// LinkedIn Saved Posts ingestion (PRD section 13). LinkedIn does not offer a
// stable public API for saved posts, so the MVP ingests via user-provided
// CSV/JSON export. The normalized shape is identical regardless of import
// method, so a future browser-extension or API listener can replace this
// file without touching anything downstream (PRD section 14).

export interface LinkedInRawPost {
  source_url?: string;
  url?: string;
  author?: string;
  company?: string;
  text?: string;
  content?: string;
  title?: string;
  captured_at?: string;
  date?: string;
}

function toNormalizedItem(raw: LinkedInRawPost, index: number): NormalizedItem | null {
  const content = (raw.text ?? raw.content ?? "").trim();
  if (!content) return null;

  const url = raw.source_url ?? raw.url ?? undefined;
  const createdAtRaw = raw.captured_at ?? raw.date;
  const createdAt = createdAtRaw && !Number.isNaN(Date.parse(createdAtRaw)) ? new Date(createdAtRaw) : new Date();

  const externalId = url || `linkedin-${contentHash(content)}-${index}`;
  const title = raw.title?.trim() || content.slice(0, 80).trim();

  return {
    externalId,
    sourceType: "LINKEDIN_SAVED_POSTS",
    title,
    content,
    url,
    author: raw.author,
    createdAt,
    metadata: {
      company: raw.company,
    },
  };
}

export function parseLinkedInCsv(csvText: string): NormalizedItem[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .map((row, i) =>
      toNormalizedItem(
        {
          source_url: row.source_url ?? row.url ?? row.URL ?? row.Url,
          author: row.author ?? row.Author,
          company: row.company ?? row.Company,
          text: row.text ?? row.Text ?? row.content ?? row.Content ?? row.body ?? row.Body,
          title: row.title ?? row.Title,
          captured_at: row.captured_at ?? row.date ?? row.Date,
        },
        i
      )
    )
    .filter((item): item is NormalizedItem => item !== null);
}

export function parseLinkedInJson(jsonText: string): NormalizedItem[] {
  const raw = JSON.parse(jsonText);
  const rows: LinkedInRawPost[] = Array.isArray(raw) ? raw : raw.items ?? raw.posts ?? [];
  return rows
    .map((row, i) => toNormalizedItem(row, i))
    .filter((item): item is NormalizedItem => item !== null);
}

export function parseLinkedInImport(filename: string, text: string): NormalizedItem[] {
  if (filename.toLowerCase().endsWith(".json")) {
    return parseLinkedInJson(text);
  }
  return parseLinkedInCsv(text);
}
