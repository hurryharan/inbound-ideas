import { google } from "googleapis";
import type { ColumnMapping, GoogleSheetSourceConfig, NormalizedItem } from "./types";
import { contentHash } from "./dedup";
import { getGoogleAuthClient } from "@/lib/google/oauth";

// Google Sheets connector (PRD section 12). Read-only; the app must never
// write back to the source sheet. Column mapping is user-configurable
// rather than hard-coded, so a reshaped sheet can be remapped without a
// code change.

/** Pure, testable: turns raw sheet rows into NormalizedItems given a header row and mapping. */
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

  const items: NormalizedItem[] = [];

  rows.forEach((row, i) => {
    const body = bodyIdx >= 0 ? (row[bodyIdx] ?? "").trim() : "";
    const title = titleIdx >= 0 ? (row[titleIdx] ?? "").trim() : "";
    if (!body && !title) return;

    const content = body || title;
    const url = urlIdx >= 0 ? row[urlIdx]?.trim() || undefined : undefined;
    const rowNumber = i + 2; // header is row 1

    items.push({
      externalId: `${spreadsheetId}:${sheetName}:${rowNumber}`,
      sourceType: "GOOGLE_SHEET",
      title: title || content.slice(0, 80),
      content,
      url,
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

export async function fetchGoogleSheetItems(
  userId: string,
  config: GoogleSheetSourceConfig
): Promise<NormalizedItem[]> {
  const auth = await getGoogleAuthClient(userId);
  const sheets = google.sheets({ version: "v4", auth });

  const range = `${config.sheetName}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range,
  });

  const values = (res.data.values ?? []) as string[][];
  if (values.length === 0) return [];

  const [header, ...rows] = values;
  return mapSheetRowsToItems(config.spreadsheetId, config.sheetName, header, rows, config.columnMapping);
}

/** Extracts a spreadsheet ID from a full Google Sheets URL or returns the input if already an ID. */
export function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}
