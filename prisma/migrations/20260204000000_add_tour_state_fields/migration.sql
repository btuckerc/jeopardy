-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasSeenTour" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tourCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tourDismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tourDismissedAt" TIMESTAMP(3);

