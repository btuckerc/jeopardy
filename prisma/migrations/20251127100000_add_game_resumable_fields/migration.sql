-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GameVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- AlterTable: Add new fields to Game for resumable games and multiplayer support
ALTER TABLE "Game" ADD COLUMN "seed" TEXT;
ALTER TABLE "Game" ADD COLUMN "config" JSONB;
ALTER TABLE "Game" ADD COLUMN "status" "GameStatus" NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "Game" ADD COLUMN "currentRound" "JeopardyRound" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "Game" ADD COLUMN "currentScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Game" ADD COLUMN "visibility" "GameVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Game" ADD COLUMN "opponentUserId" TEXT;

-- CreateIndex: Unique constraint on seed (for sharing games)
CREATE UNIQUE INDEX "Game_seed_key" ON "Game"("seed");

-- CreateIndex: Composite index for querying user's games by status
CREATE INDEX "Game_userId_status_idx" ON "Game"("userId", "status");

-- CreateIndex: Index on seed for lookups
CREATE INDEX "Game_seed_idx" ON "Game"("seed");

