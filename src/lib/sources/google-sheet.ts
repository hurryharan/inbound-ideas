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
  status: ["status", "triage status", "comment status"],
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
  sheetName: string;
  sheetNames: string[];
  sheetTabs: SheetTabSchema[];
}

export interface SheetTabSchema {
  sheetName: string;
  headers: string[];
  mapping: ColumnMapping;
  rowCount: number;
}

interface SheetTabValues {
  sheetName: string;
  values: string[][];
}

interface InspectedSheetTab extends SheetTabSchema {
  rows: string[][];
}

export interface GoogleSheetInspection {
  sheetName: string;
  header: string[];
  rows: string[][];
  resolvedMapping: ColumnMapping;
  sheetNames: string[];
  sheetTabs: SheetTabSchema[];
  selectedTabs: InspectedSheetTab[];
}

function countMappableRows(header: string[], rows: string[][], mapping: ColumnMapping): number {
  const titleIdx = mapping.title ? header.findIndex((column) => column.trim().toLowerCase() === mapping.title?.trim().toLowerCase()) : -1;
  const bodyIdx = mapping.body ? header.findIndex((column) => column.trim().toLowerCase() === mapping.body?.trim().toLowerCase()) : -1;

  return rows.filter((row) => Boolean(row[titleIdx]?.trim() || row[bodyIdx]?.trim())).length;
}

/**
 * Examines every tab before selecting one. This keeps a header-only landing
 * tab from winning over a later tab that actually contains importable rows.
 */
export function inspectSheetTabs(
  tabs: SheetTabValues[],
  preferredSheetName?: string,
  providedMapping?: ColumnMapping,
  selectedSheetNames?: string[]
): GoogleSheetInspection {
  const inspected = tabs.map(({ sheetName, values }) => {
    const [headers = [], ...rows] = values;
    const mapping = autoDetectColumnMapping(headers);
    return { sheetName, headers, rows, mapping, rowCount: countMappableRows(headers, rows, mapping) };
  });

  if (inspected.length === 0) throw new Error("No sheet tabs found in this spreadsheet.");

  const requestedName = preferredSheetName?.trim();
  const primaryTab = requestedName
    ? inspected.find((tab) => tab.sheetName.toLowerCase() === requestedName.toLowerCase())
    : inspected.find((tab) => tab.rowCount > 0 && (tab.mapping.title || tab.mapping.body)) ||
      inspected.find((tab) => tab.mapping.title || tab.mapping.body);

  if (!primaryTab) {
    if (requestedName) throw new Error(`Sheet tab "${requestedName}" was not found.`);
    throw new Error("Couldn't find a title or content column in any sheet tab.");
  }

  const requestedTabs = selectedSheetNames?.map((name) => name.trim()).filter(Boolean) ?? [];
  const selectedTabs = requestedTabs.length > 0
    ? requestedTabs.map((name) => {
        const tab = inspected.find((candidate) => candidate.sheetName.toLowerCase() === name.toLowerCase());
        if (!tab) throw new Error(`Sheet tab "${name}" was not found.`);
        return tab;
      })
    : [primaryTab];

  const resolvedMapping = resolveColumnMapping(primaryTab.headers, providedMapping);
  if (!resolvedMapping.title && !resolvedMapping.body) {
    throw new Error(
      `Couldn't find a title or content column in "${primaryTab.sheetName}"'s header (${primaryTab.headers.join(", ")}). Set the column mapping manually on this source.`
    );
  }

  return {
    sheetName: primaryTab.sheetName,
    header: primaryTab.headers,
    rows: primaryTab.rows,
    resolvedMapping,
    sheetNames: selectedTabs.map((tab) => tab.sheetName),
    sheetTabs: inspected.map(({ sheetName, headers, mapping, rowCount }) => ({ sheetName, headers, mapping, rowCount })),
    selectedTabs,
  };
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

export async function inspectGoogleSheet(userId: string, config: SourceConfig): Promise<GoogleSheetInspection> {
  const auth = await getGoogleAuthClient(userId);
  const sheets = google.sheets({ version: "v4", auth });

  let sheetNames: string[];
  try {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
      fields: "sheets.properties.title",
    });
    sheetNames = metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title)) ?? [];
  } catch (error) {
    throw new Error(`Failed to access Google Spreadsheet (${config.spreadsheetId}). ${error instanceof Error ? error.message : ""}`);
  }

  if (sheetNames.length === 0) throw new Error("No sheet tabs found in this spreadsheet.");

  const values = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: config.spreadsheetId,
    ranges: sheetNames.map((sheetName) => `${quoteSheetRange(sheetName)}!A:ZZ`),
  });
  const tabs: SheetTabValues[] = sheetNames.map((sheetName, index) => ({
    sheetName,
    values: (values.data.valueRanges?.[index]?.values ?? []).map((row) => row.map((cell) => String(cell ?? ""))),
  }));

  return inspectSheetTabs(tabs, config.sheetName, config.columnMapping, config.sheetNames);
}

export async function fetchGoogleSheetItems(userId: string, config: SourceConfig): Promise<FetchedSheetItems> {
  const inspection = await inspectGoogleSheet(userId, config);

  const items = inspection.selectedTabs.flatMap((tab) => {
    const mapping = tab.sheetName === inspection.sheetName
      ? inspection.resolvedMapping
      : resolveColumnMapping(tab.headers);
    return mapSheetRowsToItems(config.spreadsheetId, tab.sheetName, tab.headers, tab.rows, mapping);
  });

  return {
    items,
    resolvedMapping: inspection.resolvedMapping,
    sheetName: inspection.sheetName,
    sheetNames: inspection.sheetNames,
    sheetTabs: inspection.sheetTabs,
  };
}

/** Extracts a spreadsheet ID from a full Google Sheets URL or returns the input if already an ID. */
export function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}
