// Client-facing shapes (Prisma rows as they arrive over JSON — dates are strings).

export interface Angle {
  label: string;
  description: string;
}

export type IdeaStatus = "NEW" | "SURFACED" | "EXPLORING" | "EXPLORED" | "PARKED" | "ARCHIVED";
export type SourcePriority = "LOW" | "MEDIUM" | "HIGH";
export type ContextSourceType = "GOOGLE_DRIVE_DOCUMENT" | "GOOGLE_DRIVE_FOLDER" | "GOOGLE_SHEET";
export type LLMProviderKind = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "OPENAI_COMPATIBLE";
export type SessionStatus = "STARTED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export interface ColumnMapping {
  title?: string;
  body?: string;
  topic?: string;
  status?: string;
  sourceUrl?: string;
  author?: string;
}

export interface SourceItemRef {
  id: string;
  title: string;
  content: string;
  url: string | null;
  author: string | null;
  createdAt: string;
  source: { id: string; name: string };
}

export interface ContextDocumentRef {
  id: string;
  title: string;
  content: string;
  url: string | null;
  tags: string[];
}

export interface Idea {
  id: string;
  title: string;
  summary: string;
  observation: string;
  whyRelevant: string;
  potentialThesis: string;
  angles: Angle[];
  topics: string[];
  score: number;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  lastExploredAt: string | null;
  sourceItems: { sourceItem: SourceItemRef }[];
  contextDocuments: { contextDocument: ContextDocumentRef; relevance: number }[];
}

export interface SourceConfig {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  sheetName: string;
  columnMapping?: ColumnMapping;
}

export interface Source {
  id: string;
  name: string;
  enabled: boolean;
  config: SourceConfig;
  tags: string[];
  priority: SourcePriority;
  refreshFrequencyMinutes: number;
  lastRefreshedAt: string | null;
  createdAt: string;
  _count: { items: number };
}

export interface ContextSource {
  id: string;
  name: string;
  description: string | null;
  type: ContextSourceType;
  externalId: string;
  url: string | null;
  tags: string[];
  priority: SourcePriority;
  instructions: string | null;
  enabled: boolean;
  lastIndexedAt: string | null;
  createdAt: string;
  _count: { documents: number };
}

export interface LLMProvider {
  id: string;
  kind: LLMProviderKind;
  name: string;
  baseUrl: string | null;
  defaultModel: string;
  temperature: number | null;
  maxTokens: number | null;
  systemPrompt: string | null;
  isDefault: boolean;
  hasApiKey: boolean;
}

export interface Session {
  id: string;
  ideaId: string;
  llmModel: string;
  startedAt: string;
  externalChatUrl: string | null;
  status: SessionStatus;
  notes: string | null;
  idea?: { id: string; title: string };
  llmProvider?: { name: string; kind: LLMProviderKind } | null;
}
