-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LINKEDIN_SAVED_POSTS', 'GOOGLE_SHEET', 'GOOGLE_DRIVE_DOCUMENT', 'GOOGLE_DRIVE_FOLDER');

-- CreateEnum
CREATE TYPE "SourcePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ContextSourceType" AS ENUM ('GOOGLE_DRIVE_DOCUMENT', 'GOOGLE_DRIVE_FOLDER', 'GOOGLE_SHEET');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('NEW', 'SURFACED', 'EXPLORING', 'EXPLORED', 'PARKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FeedbackSignal" AS ENUM ('INTERESTING', 'NOT_INTERESTING', 'EXPLORE', 'PARK', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "LLMProviderKind" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" "SourcePriority" NOT NULL DEFAULT 'MEDIUM',
    "refreshFrequencyMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "author" TEXT,
    "contentHash" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ContextSourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" "SourcePriority" NOT NULL DEFAULT 'MEDIUM',
    "instructions" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastIndexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextDocument" (
    "id" TEXT NOT NULL,
    "contextSourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "whyRelevant" TEXT NOT NULL,
    "potentialThesis" TEXT NOT NULL,
    "angles" JSONB NOT NULL DEFAULT '[]',
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "IdeaStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastExploredAt" TIMESTAMP(3),

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaSourceItem" (
    "ideaId" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,

    CONSTRAINT "IdeaSourceItem_pkey" PRIMARY KEY ("ideaId","sourceItemId")
);

-- CreateTable
CREATE TABLE "IdeaContextDocument" (
    "ideaId" TEXT NOT NULL,
    "contextDocumentId" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "IdeaContextDocument_pkey" PRIMARY KEY ("ideaId","contextDocumentId")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "signal" "FeedbackSignal" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LLMProviderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "baseUrl" TEXT,
    "defaultModel" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "maxTokens" INTEGER DEFAULT 2048,
    "systemPrompt" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "llmProviderId" TEXT,
    "llmModel" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalChatUrl" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'STARTED',
    "notes" TEXT,
    "promptText" TEXT NOT NULL,
    "contextDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Source_userId_idx" ON "Source"("userId");

-- CreateIndex
CREATE INDEX "SourceItem_contentHash_idx" ON "SourceItem"("contentHash");

-- CreateIndex
CREATE INDEX "SourceItem_sourceId_idx" ON "SourceItem"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceItem_sourceId_externalId_key" ON "SourceItem"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "ContextSource_userId_idx" ON "ContextSource"("userId");

-- CreateIndex
CREATE INDEX "ContextDocument_contextSourceId_idx" ON "ContextDocument"("contextSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextDocument_contextSourceId_externalId_key" ON "ContextDocument"("contextSourceId", "externalId");

-- CreateIndex
CREATE INDEX "Idea_status_idx" ON "Idea"("status");

-- CreateIndex
CREATE INDEX "Idea_score_idx" ON "Idea"("score");

-- CreateIndex
CREATE INDEX "Feedback_ideaId_idx" ON "Feedback"("ideaId");

-- CreateIndex
CREATE INDEX "LLMProvider_userId_idx" ON "LLMProvider"("userId");

-- CreateIndex
CREATE INDEX "Session_ideaId_idx" ON "Session"("ideaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSource" ADD CONSTRAINT "ContextSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextDocument" ADD CONSTRAINT "ContextDocument_contextSourceId_fkey" FOREIGN KEY ("contextSourceId") REFERENCES "ContextSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaSourceItem" ADD CONSTRAINT "IdeaSourceItem_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaSourceItem" ADD CONSTRAINT "IdeaSourceItem_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaContextDocument" ADD CONSTRAINT "IdeaContextDocument_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaContextDocument" ADD CONSTRAINT "IdeaContextDocument_contextDocumentId_fkey" FOREIGN KEY ("contextDocumentId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMProvider" ADD CONSTRAINT "LLMProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_llmProviderId_fkey" FOREIGN KEY ("llmProviderId") REFERENCES "LLMProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
