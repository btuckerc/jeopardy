-- AlterTable: Add episodeGameId column to DailyChallenge
-- This tracks which J-Archive game/episode was used for the daily challenge
-- Allows us to avoid reusing the same episode within a time window

ALTER TABLE "DailyChallenge" ADD COLUMN IF NOT EXISTS "episodeGameId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyChallenge_airDate_idx" ON "DailyChallenge"("airDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyChallenge_episodeGameId_idx" ON "DailyChallenge"("episodeGameId");

