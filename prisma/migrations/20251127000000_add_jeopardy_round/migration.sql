-- CreateEnum
CREATE TYPE "JeopardyRound" AS ENUM ('SINGLE', 'DOUBLE', 'FINAL');

-- AlterTable: Add round column with default value
ALTER TABLE "Question" ADD COLUMN "round" "JeopardyRound" NOT NULL DEFAULT 'SINGLE';

-- Update existing data based on isDoubleJeopardy flag
UPDATE "Question" SET "round" = 'DOUBLE' WHERE "isDoubleJeopardy" = true;

-- Update Final Jeopardy questions (value = 0 and not Double Jeopardy)
-- Note: Final Jeopardy questions typically have value 0
UPDATE "Question" SET "round" = 'FINAL' WHERE "value" = 0 AND "isDoubleJeopardy" = false;

-- CreateIndex
CREATE INDEX "Question_round_idx" ON "Question"("round");

