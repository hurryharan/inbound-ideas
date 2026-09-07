import type { SourceType } from "@prisma/client";

// The common shape every source connector normalizes into (PRD section 14).
// The idea engine only ever depends on this shape — never on a specific
// source (LinkedIn, Sheets, Drive, ...).
export interface NormalizedItem {
  externalId: string;
  sourceType: SourceType;
  title: string;
  content: string;
  url?: string;
  author?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface ColumnMapping {
  title: string;
  body: string;
  topic?: string;
  status?: string;
  sourceUrl?: string;
}

export interface GoogleSheetSourceConfig {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  sheetName: string;
  columnMapping: ColumnMapping;
}

export interface LinkedInSourceConfig {
  lastImportFilename?: string;
}

export interface GoogleDriveFolderConfig {
  folderId: string;
}

export interface GoogleDriveDocumentConfig {
  fileId: string;
}
