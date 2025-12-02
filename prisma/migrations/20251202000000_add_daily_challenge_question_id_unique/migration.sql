-- Add unique constraint on questionId to prevent duplicate daily challenges
-- This ensures each Final Jeopardy question can only be used once as a daily challenge

-- Step 1: Handle any existing duplicates by keeping only the earliest date for each questionId
-- Delete later duplicates, keeping the one with the earliest date
DELETE FROM "DailyChallenge" dc1
WHERE EXISTS (
    SELECT 1 FROM "DailyChallenge" dc2
    WHERE dc2."questionId" = dc1."questionId"
    AND dc2."date" < dc1."date"
);

-- Step 2: Add unique constraint on questionId
-- This will fail if duplicates still exist, but we've cleaned them above
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'DailyChallenge_questionId_key'
    ) THEN
        ALTER TABLE "DailyChallenge" ADD CONSTRAINT "DailyChallenge_questionId_key" UNIQUE ("questionId");
    END IF;
END $$;

-- Step 3: Add index on questionId for better query performance (if not already exists)
CREATE INDEX IF NOT EXISTS "DailyChallenge_questionId_idx" ON "DailyChallenge"("questionId");

-- Step 4: Add composite index on Question table for better daily challenge queries
CREATE INDEX IF NOT EXISTS "Question_round_airDate_idx" ON "Question"("round", "airDate");

