-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastOnlineAt" TIMESTAMP(3),
ADD COLUMN "lastSeenPath" TEXT;

-- CreateIndex
CREATE INDEX "User_lastOnlineAt_idx" ON "User"("lastOnlineAt");

