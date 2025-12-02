-- Seed default achievements (idempotent - will not insert if already exists)
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

