-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "Achievement_code_idx" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default achievements
INSERT INTO "Achievement" ("id", "code", "name", "description", "icon")
VALUES 
    (gen_random_uuid(), 'FIRST_GAME', 'First Steps', 'Complete your first game', '🎮'),
    (gen_random_uuid(), 'PERFECT_ROUND', 'Perfect Round', 'Answer every question correctly in a round', '⭐'),
    (gen_random_uuid(), 'TRIPLE_STUMPER_MASTER', 'Triple Stumper Master', 'Answer 10 triple stumper questions correctly', '🧠'),
    (gen_random_uuid(), 'STREAK_MASTER_7', 'Week Warrior', 'Maintain a 7-day streak', '🔥'),
    (gen_random_uuid(), 'STREAK_MASTER_30', 'Monthly Master', 'Maintain a 30-day streak', '💪'),
    (gen_random_uuid(), 'SCORE_MASTER_10000', 'High Roller', 'Score $10,000 or more in a single game', '💰'),
    (gen_random_uuid(), 'SCORE_MASTER_20000', 'Jeopardy Champion', 'Score $20,000 or more in a single game', '🏆'),
    (gen_random_uuid(), 'DAILY_CHALLENGE_STREAK_7', 'Daily Dedication', 'Complete 7 daily challenges in a row', '📅'),
    (gen_random_uuid(), 'QUESTIONS_MASTER_100', 'Century Club', 'Answer 100 questions', '💯'),
    (gen_random_uuid(), 'QUESTIONS_MASTER_1000', 'Millennium Master', 'Answer 1,000 questions', '🌟')
ON CONFLICT ("code") DO NOTHING;

