import { google } from "googleapis";
import type { ColumnMapping, SourceConfig, NormalizedItem } from "./types";
import { contentHash } from "./dedup";
import { getGoogleAuthClient } from "@/lib/google/oauth";

// Google Sheets connector (PRD section 12). Read-only; the app must never
// write back to the source sheet. Every Source is a sheet — the user drops
// LinkedIn/Twitter/whatever exports into it periodically, this just reads
// rows. Column mapping is auto-detected from the header row so adding a
// source doesn't require manually naming every column; an explicit mapping
// (partial or full) always overrides detection, and remains available for
// when a sheet's structure doesn't match the common aliases below.

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  title: ["title", "name", "headline", "subject"],
  body: ["idea", "content", "text", "body", "description", "post", "notes", "summary"],
  topic: ["topic", "category", "tag", "tags"],
  status: ["status"],
  sourceUrl: ["url", "link", "source url", "source_url", "reference url", "post url"],
  author: ["author", "by", "posted by", "creator"],
};

/** Matches a sheet's header row against common column-name aliases. */
export function autoDetectColumnMapping(header: string[]): ColumnMapping {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const find = (aliases: string[]): string | undefined => {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    return idx >= 0 ? header[idx] : undefined;
  };

  return {
    title: find(COLUMN_ALIASES.title),
    body: find(COLUMN_ALIASES.body),
    topic: find(COLUMN_ALIASES.topic),
    status: find(COLUMN_ALIASES.status),
    sourceUrl: find(COLUMN_ALIASES.sourceUrl),
    author: find(COLUMN_ALIASES.author),
  };
}

/** Auto-detected mapping, with any explicitly-provided field taking priority. */
export function resolveColumnMapping(header: string[], provided?: ColumnMapping): ColumnMapping {
  const detected = autoDetectColumnMapping(header);
  return {
    title: provided?.title || detected.title,
    body: provided?.body || detected.body,
    topic: provided?.topic || detected.topic,
    status: provided?.status || detected.status,
    sourceUrl: provided?.sourceUrl || detected.sourceUrl,
    author: provided?.author || detected.author,
  };
}

/** Pure, testable: turns raw sheet rows into NormalizedItems given a header row and resolved mapping. */
export function mapSheetRowsToItems(
  spreadsheetId: string,
  sheetName: string,
  header: string[],
  rows: string[][],
  mapping: ColumnMapping
): NormalizedItem[] {
  const colIndex = (name: string | undefined) =>
    name ? header.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase()) : -1;

  const titleIdx = colIndex(mapping.title);
  const bodyIdx = colIndex(mapping.body);
  const topicIdx = colIndex(mapping.topic);
  const statusIdx = colIndex(mapping.status);
  const urlIdx = colIndex(mapping.sourceUrl);
  const authorIdx = colIndex(mapping.author);

  const items: NormalizedItem[] = [];

  rows.forEach((row, i) => {
    const body = bodyIdx >= 0 ? (row[bodyIdx] ?? "").trim() : "";
    const title = titleIdx >= 0 ? (row[titleIdx] ?? "").trim() : "";
    if (!body && !title) return;

    const content = body || title;
    const url = urlIdx >= 0 ? row[urlIdx]?.trim() || undefined : undefined;
    const author = authorIdx >= 0 ? row[authorIdx]?.trim() || undefined : undefined;
    const rowNumber = i + 2; // header is row 1

    items.push({
      externalId: `${spreadsheetId}:${sheetName}:${rowNumber}`,
      title: title || content.slice(0, 80),
      content,
      url,
      author,
      createdAt: new Date(),
      metadata: {
        topic: topicIdx >= 0 ? row[topicIdx] : undefined,
        status: statusIdx >= 0 ? row[statusIdx] : undefined,
        rowNumber,
        contentHash: contentHash(content),
      },
    });
  });

  return items;
}

export interface FetchedSheetItems {
  items: NormalizedItem[];
  resolvedMapping: ColumnMapping;
}

/**
 * Wraps a sheet name for use as an A1-notation range. The Sheets API's range
 * parser rejects unquoted names containing characters like hyphens, spaces,
 * or a leading digit (e.g. "linkedin-post-triage-2026-09-05" fails with
 * "Unable to parse range") — quoting is always valid, so always quote.
 */
export function quoteSheetRange(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

export async function fetchGoogleSheetItems(userId: string, config: SourceConfig): Promise<FetchedSheetItems> {
  const auth = await getGoogleAuthClient(userId);
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: quoteSheetRange(config.sheetName),
  });

  const values = (res.data.values ?? []) as string[][];
  if (values.length === 0) return { items: [], resolvedMapping: config.columnMapping ?? {} };

  const [header, ...rows] = values;
  const resolvedMapping = resolveColumnMapping(header, config.columnMapping);

  if (!resolvedMapping.title && !resolvedMapping.body) {
    throw new Error(
      `Couldn't find a title or content column in "${config.sheetName}"'s header (${header.join(
        ", "
      )}). Set the column mapping manually on this source.`
    );
  }

  return {
    items: mapSheetRowsToItems(config.spreadsheetId, config.sheetName, header, rows, resolvedMapping),
    resolvedMapping,
  };
}

/** Extracts a spreadsheet ID from a full Google Sheets URL or returns the input if already an ID. */
export function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}
