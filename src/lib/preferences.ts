import { prisma } from "@/lib/prisma";
import { DEFAULT_RANKING_WEIGHTS, type RankingWeights } from "@/lib/ideas/scoring";
import { DEFAULT_IDEATION_PROMPT } from "@/lib/ideas/prompt";

// Centralized configuration (PRD section 23): every configurable value the
// spec calls out is stored here as a UserPreference row, editable via
// Settings without a code change.

export const PREFERENCE_KEYS = {
  rankingWeights: "ranking_weights",
  ideationPrompt: "ideation_prompt",
  general: "general",
} as const;

export interface GeneralPreferences {
  inboxDailySuggestionCount: number;
}

export const DEFAULT_GENERAL_PREFERENCES: GeneralPreferences = {
  inboxDailySuggestionCount: 5,
};

async function getPreference<T>(userId: string, key: string, fallback: T): Promise<T> {
  const row = await prisma.userPreference.findUnique({ where: { userId_key: { userId, key } } });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as object) } as T;
}

async function setPreference<T>(userId: string, key: string, value: T): Promise<void> {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key } },
    update: { value: value as object },
    create: { userId, key, value: value as object },
  });
}

export async function getRankingWeights(userId: string): Promise<RankingWeights> {
  return getPreference(userId, PREFERENCE_KEYS.rankingWeights, DEFAULT_RANKING_WEIGHTS);
}

export async function setRankingWeights(userId: string, weights: RankingWeights): Promise<void> {
  return setPreference(userId, PREFERENCE_KEYS.rankingWeights, weights);
}

export async function getIdeationPrompt(userId: string): Promise<string> {
  const row = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: PREFERENCE_KEYS.ideationPrompt } },
  });
  if (!row) return DEFAULT_IDEATION_PROMPT;
  const value = row.value as { template?: string };
  return value.template ?? DEFAULT_IDEATION_PROMPT;
}

export async function setIdeationPrompt(userId: string, template: string): Promise<void> {
  return setPreference(userId, PREFERENCE_KEYS.ideationPrompt, { template });
}

export async function getGeneralPreferences(userId: string): Promise<GeneralPreferences> {
  return getPreference(userId, PREFERENCE_KEYS.general, DEFAULT_GENERAL_PREFERENCES);
}

export async function setGeneralPreferences(userId: string, prefs: GeneralPreferences): Promise<void> {
  return setPreference(userId, PREFERENCE_KEYS.general, prefs);
}
