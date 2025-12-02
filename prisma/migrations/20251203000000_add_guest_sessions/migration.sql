-- CreateEnum
CREATE TYPE "GuestSessionType" AS ENUM ('RANDOM_QUESTION', 'RANDOM_GAME', 'DAILY_CHALLENGE');

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "type" "GuestSessionType" NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestGame" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "seed" TEXT,
    "config" JSONB,
    "status" "GameStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentRound" "JeopardyRound" NOT NULL DEFAULT 'SINGLE',
    "currentScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestGameQuestion" (
    "id" TEXT NOT NULL,
    "guestGameId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "correct" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestGameQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestConfig" (
    "id" TEXT NOT NULL,
    "randomGameMaxQuestionsBeforeAuth" INTEGER NOT NULL DEFAULT 1,
    "randomGameMaxCategoriesBeforeAuth" INTEGER,
    "randomGameMaxRoundsBeforeAuth" INTEGER,
    "randomGameMaxGamesBeforeAuth" INTEGER NOT NULL DEFAULT 0,
    "randomQuestionMaxQuestionsBeforeAuth" INTEGER NOT NULL DEFAULT 1,
    "randomQuestionMaxCategoriesBeforeAuth" INTEGER,
    "dailyChallengeGuestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyChallengeGuestAppearsOnLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "timeToAuthenticateMinutes" INTEGER NOT NULL DEFAULT 1440,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");

-- CreateIndex
CREATE INDEX "GuestSession_claimedByUserId_idx" ON "GuestSession"("claimedByUserId");

-- CreateIndex
CREATE INDEX "GuestSession_type_expiresAt_idx" ON "GuestSession"("type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestGame_guestSessionId_key" ON "GuestGame"("guestSessionId");

-- CreateIndex
CREATE INDEX "GuestGame_guestSessionId_idx" ON "GuestGame"("guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestGame_seed_key" ON "GuestGame"("seed");

-- CreateIndex
CREATE UNIQUE INDEX "GuestGameQuestion_guestGameId_questionId_key" ON "GuestGameQuestion"("guestGameId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestConfig_id_key" ON "GuestConfig"("id");

-- AddForeignKey
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGame" ADD CONSTRAINT "GuestGame_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGameQuestion" ADD CONSTRAINT "GuestGameQuestion_guestGameId_fkey" FOREIGN KEY ("guestGameId") REFERENCES "GuestGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestGameQuestion" ADD CONSTRAINT "GuestGameQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default GuestConfig
INSERT INTO "GuestConfig" ("id", "randomGameMaxQuestionsBeforeAuth", "randomGameMaxCategoriesBeforeAuth", "randomGameMaxRoundsBeforeAuth", "randomGameMaxGamesBeforeAuth", "randomQuestionMaxQuestionsBeforeAuth", "randomQuestionMaxCategoriesBeforeAuth", "dailyChallengeGuestEnabled", "dailyChallengeGuestAppearsOnLeaderboard", "timeToAuthenticateMinutes", "createdAt", "updatedAt")
VALUES ('default', 1, NULL, NULL, 0, 1, NULL, false, false, 1440, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

