// The common shape a Source's sheet rows normalize into (PRD section 14).
// The idea engine only ever depends on this shape, never on where a
// particular row originally came from.
export interface NormalizedItem {
  externalId: string;
  title: string;
  content: string;
  url?: string;
  author?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

// All optional: unset fields are auto-detected from the sheet's header row.
export interface ColumnMapping {
  title?: string;
  body?: string;
  topic?: string;
  status?: string;
  sourceUrl?: string;
  author?: string;
}

export interface SheetTabSchema {
  sheetName: string;
  headers: string[];
  mapping: ColumnMapping;
  rowCount: number;
}

export interface SourceConfig {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  sheetName: string;
  sheetNames?: string[];
  columnMapping?: ColumnMapping;
  sheetTabs?: SheetTabSchema[];
}
