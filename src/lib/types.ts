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

export interface SheetTabSchema {
  sheetName: string;
  headers: string[];
  mapping: ColumnMapping;
  rowCount: number;
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
  sheetNames?: string[];
  columnMapping?: ColumnMapping;
  sheetTabs?: SheetTabSchema[];
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
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
}

export type LLMWorkflow = "IDEA_GENERATION";

export interface LLMUsageBreakdown {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

export interface LLMUsageEvent {
  id: string;
  llmProviderId: string | null;
  providerKind: LLMProviderKind;
  providerName: string;
  model: string;
  workflow: LLMWorkflow;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  createdAt: string;
}

export interface LLMUsageSummary {
  totals: LLMUsageBreakdown & { unpricedCalls: number };
  byWorkflow: (LLMUsageBreakdown & { workflow: LLMWorkflow })[];
  byProvider: (LLMUsageBreakdown & { llmProviderId: string | null; providerName: string; providerKind: LLMProviderKind })[];
  recentEvents: LLMUsageEvent[];
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
