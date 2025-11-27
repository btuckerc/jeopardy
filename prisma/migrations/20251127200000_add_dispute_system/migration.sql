-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeMode" AS ENUM ('GAME', 'PRACTICE');

-- CreateEnum
CREATE TYPE "OverrideSource" AS ENUM ('ADMIN', 'DISPUTE');

-- AlterTable: Add userAnswer field to GameHistory for retroactive re-grading
ALTER TABLE "GameHistory" ADD COLUMN "userAnswer" TEXT;

-- CreateTable
CREATE TABLE "AnswerOverride" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "source" "OverrideSource" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerDispute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "gameId" TEXT,
    "mode" "DisputeMode" NOT NULL,
    "round" "JeopardyRound" NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "systemWasCorrect" BOOLEAN NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "adminId" TEXT,
    "adminComment" TEXT,
    "overrideId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AnswerDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerOverride_questionId_idx" ON "AnswerOverride"("questionId");

-- CreateIndex
CREATE INDEX "AnswerOverride_createdByUserId_idx" ON "AnswerOverride"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerOverride_questionId_text_key" ON "AnswerOverride"("questionId", "text");

-- CreateIndex
CREATE INDEX "AnswerDispute_userId_idx" ON "AnswerDispute"("userId");

-- CreateIndex
CREATE INDEX "AnswerDispute_questionId_idx" ON "AnswerDispute"("questionId");

-- CreateIndex
CREATE INDEX "AnswerDispute_status_idx" ON "AnswerDispute"("status");

-- CreateIndex
CREATE INDEX "AnswerDispute_createdAt_idx" ON "AnswerDispute"("createdAt");

-- CreateIndex
CREATE INDEX "AnswerDispute_userId_questionId_mode_idx" ON "AnswerDispute"("userId", "questionId", "mode");

-- AddForeignKey
ALTER TABLE "AnswerOverride" ADD CONSTRAINT "AnswerOverride_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOverride" ADD CONSTRAINT "AnswerOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerDispute" ADD CONSTRAINT "AnswerDispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerDispute" ADD CONSTRAINT "AnswerDispute_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerDispute" ADD CONSTRAINT "AnswerDispute_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerDispute" ADD CONSTRAINT "AnswerDispute_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "AnswerOverride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

