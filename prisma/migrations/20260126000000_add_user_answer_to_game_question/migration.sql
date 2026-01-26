-- AlterTable: Add userAnswer field to GameQuestion for showing what users answered
-- This is a nullable field to be backward compatible with existing records
ALTER TABLE "GameQuestion" ADD COLUMN "userAnswer" TEXT;
