-- Add dailyChallengeMinLookbackDays field to GuestConfig
-- Default: 365 days (1 year)

ALTER TABLE "GuestConfig" ADD COLUMN IF NOT EXISTS "dailyChallengeMinLookbackDays" INTEGER NOT NULL DEFAULT 365;

