-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSpoilerPrompt" TIMESTAMP(3),
ADD COLUMN     "spoilerBlockDate" TIMESTAMP(3),
ADD COLUMN     "spoilerBlockEnabled" BOOLEAN NOT NULL DEFAULT true;
