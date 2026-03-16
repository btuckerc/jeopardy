-- Improve friend challenge lookup performance for game-linked challenge flows.
-- These queries are used frequently by challenge launch/reconciliation endpoints.
CREATE INDEX IF NOT EXISTS "Game_config_friendChallengeId_createdAt_idx"
ON "Game" ((config->>'friendChallengeId'), "createdAt");

CREATE INDEX IF NOT EXISTS "Game_userId_config_friendChallengeId_createdAt_idx"
ON "Game" ("userId", (config->>'friendChallengeId'), "createdAt" DESC);
