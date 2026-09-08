-- CreateEnum
CREATE TYPE "LLMWorkflow" AS ENUM ('IDEA_GENERATION');

-- AlterTable
ALTER TABLE "LLMProvider" ADD COLUMN     "inputPricePerMillion" DOUBLE PRECISION,
ADD COLUMN     "outputPricePerMillion" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "LLMUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "llmProviderId" TEXT,
    "providerKind" "LLMProviderKind" NOT NULL,
    "providerName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "workflow" "LLMWorkflow" NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LLMUsageEvent_userId_idx" ON "LLMUsageEvent"("userId");

-- CreateIndex
CREATE INDEX "LLMUsageEvent_workflow_idx" ON "LLMUsageEvent"("workflow");

-- CreateIndex
CREATE INDEX "LLMUsageEvent_llmProviderId_idx" ON "LLMUsageEvent"("llmProviderId");

-- CreateIndex
CREATE INDEX "LLMUsageEvent_createdAt_idx" ON "LLMUsageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "LLMUsageEvent" ADD CONSTRAINT "LLMUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMUsageEvent" ADD CONSTRAINT "LLMUsageEvent_llmProviderId_fkey" FOREIGN KEY ("llmProviderId") REFERENCES "LLMProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
