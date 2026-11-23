-- Clean-Room Original Trivia Engine, Cryptographic Provenance & Source Isolation
-- Additive, non-destructive migration: preserves all existing Question, Category, Game,
-- GameHistory, UserProgress, DailyChallenge, AnswerDispute, AnswerOverride, and Achievement rows.

-- 1. Create enums
CREATE TYPE "QuestionSource" AS ENUM ('LEGACY_JEOPARDY', 'ORIGINAL_ENGINE');
CREATE TYPE "QuestionPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- 2. Create QuestionGenerationRun table
CREATE TABLE "QuestionGenerationRun" (
    "id" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptTemplateHash" TEXT NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "screeningCorpusCount" INTEGER NOT NULL DEFAULT 0,
    "screeningCorpusHash" TEXT,
    "packReleaseDate" DATE,
    "totalGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalPassed" INTEGER NOT NULL DEFAULT 0,
    "totalRejectedOverlap" INTEGER NOT NULL DEFAULT 0,
    "manifestJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionGenerationRun_pkey" PRIMARY KEY ("id")
);

-- 3. Create QuestionProvenance table
CREATE TABLE "QuestionProvenance" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "licenseSpdx" TEXT NOT NULL,
    "sourceBundle" JSONB NOT NULL,
    "sourceBundleHash" TEXT NOT NULL,
    "promptTemplateHash" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "samplingParams" JSONB NOT NULL DEFAULT '{}',
    "generatedAt" TEXT NOT NULL DEFAULT '',
    "outputHash" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "merkleLeafHash" TEXT NOT NULL,
    "merkleProof" JSONB NOT NULL,
    "overlapMaxScore" DOUBLE PRECISION,
    "overlapPassed" BOOLEAN NOT NULL DEFAULT false,
    "blindSolverPassed" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DOUBLE PRECISION,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionProvenance_pkey" PRIMARY KEY ("id")
);

-- 4. Add source/status/provenance columns to Question (existing rows backfill to LEGACY_JEOPARDY)
ALTER TABLE "Question"
    ADD COLUMN "acceptableAnswers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "source" "QuestionSource" NOT NULL DEFAULT 'LEGACY_JEOPARDY',
    ADD COLUMN "publishStatus" "QuestionPublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN "generationRunId" TEXT;

-- 5. Add source column to Category and replace unique(name) with unique(name, source)
ALTER TABLE "Category"
    ADD COLUMN "source" "QuestionSource" NOT NULL DEFAULT 'LEGACY_JEOPARDY';

DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_name_source_key" ON "Category"("name", "source");
CREATE INDEX "Category_source_idx" ON "Category"("source");

-- 6. Add contentSource to Game and GuestGame (existing rows backfill to LEGACY_JEOPARDY)
ALTER TABLE "Game"
    ADD COLUMN "contentSource" "QuestionSource" NOT NULL DEFAULT 'LEGACY_JEOPARDY';

ALTER TABLE "GuestGame"
    ADD COLUMN "contentSource" "QuestionSource" NOT NULL DEFAULT 'LEGACY_JEOPARDY';

-- 7. Indexes and foreign keys
CREATE INDEX "Question_source_publishStatus_round_idx" ON "Question"("source", "publishStatus", "round");
CREATE INDEX "Question_source_publishStatus_knowledgeCategory_idx" ON "Question"("source", "publishStatus", "knowledgeCategory");
CREATE INDEX "Question_source_publishStatus_categoryId_idx" ON "Question"("source", "publishStatus", "categoryId");
CREATE INDEX "Question_generationRunId_idx" ON "Question"("generationRunId");

CREATE INDEX "QuestionGenerationRun_createdAt_idx" ON "QuestionGenerationRun"("createdAt");
CREATE INDEX "QuestionGenerationRun_merkleRoot_idx" ON "QuestionGenerationRun"("merkleRoot");

CREATE UNIQUE INDEX "QuestionProvenance_questionId_key" ON "QuestionProvenance"("questionId");
CREATE UNIQUE INDEX "QuestionProvenance_receiptHash_key" ON "QuestionProvenance"("receiptHash");
CREATE INDEX "QuestionProvenance_runId_idx" ON "QuestionProvenance"("runId");
CREATE INDEX "QuestionProvenance_sourceBundleHash_idx" ON "QuestionProvenance"("sourceBundleHash");
CREATE INDEX "QuestionProvenance_overlapPassed_idx" ON "QuestionProvenance"("overlapPassed");

ALTER TABLE "Question"
    ADD CONSTRAINT "Question_generationRunId_fkey"
    FOREIGN KEY ("generationRunId") REFERENCES "QuestionGenerationRun"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionProvenance"
    ADD CONSTRAINT "QuestionProvenance_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionProvenance"
    ADD CONSTRAINT "QuestionProvenance_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "QuestionGenerationRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
