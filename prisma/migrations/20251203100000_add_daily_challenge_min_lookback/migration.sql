-- Add dailyChallengeMinLookbackDays and dailyChallengeSeasons fields to GuestConfig
-- dailyChallengeMinLookbackDays: Default 365 days (1 year)
-- dailyChallengeSeasons: JSON array of season numbers (nullable)

ALTER TABLE "GuestConfig" ADD COLUMN IF NOT EXISTS "dailyChallengeMinLookbackDays" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "GuestConfig" ADD COLUMN IF NOT EXISTS "dailyChallengeSeasons" JSONB;

