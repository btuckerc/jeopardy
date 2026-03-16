-- Deduplicate stale duplicate pending friend requests per user pair
WITH ranked_requests AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY LEAST("fromUserId", "toUserId"), GREATEST("fromUserId", "toUserId")
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "FriendRequest"
  WHERE "status" = 'PENDING'
)
UPDATE "FriendRequest" fr
SET
  "status" = 'CANCELLED',
  "respondedAt" = COALESCE(fr."respondedAt", NOW()),
  "updatedAt" = NOW()
FROM ranked_requests rr
WHERE fr."id" = rr."id"
  AND rr.rn > 1;

-- Deduplicate duplicate active friend challenges per user pair
WITH ranked_challenges AS (
  SELECT
    "id",
    "status",
    "expiresAt",
    ROW_NUMBER() OVER (
      PARTITION BY LEAST("challengerUserId", "opponentUserId"), GREATEST("challengerUserId", "opponentUserId")
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "FriendChallenge"
  WHERE "status" IN ('PENDING', 'ACCEPTED')
)
UPDATE "FriendChallenge" fc
SET
  "status" = CASE
    WHEN rc."status" = 'PENDING' AND rc."expiresAt" <= NOW() THEN 'EXPIRED'::"FriendChallengeStatus"
    ELSE 'CANCELLED'::"FriendChallengeStatus"
  END,
  "respondedAt" = COALESCE(fc."respondedAt", NOW()),
  "updatedAt" = NOW()
FROM ranked_challenges rc
WHERE fc."id" = rc."id"
  AND rc.rn > 1;

-- Deduplicate duplicate challenge activity rows per challenge/type pair
WITH ranked_activities AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "challengeId", "activityType"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "FriendActivity"
  WHERE "challengeId" IS NOT NULL
)
DELETE FROM "FriendActivity" fa
USING ranked_activities ra
WHERE fa."id" = ra."id"
  AND ra.rn > 1;

-- One pending friend request per user pair (bi-directional)
CREATE UNIQUE INDEX IF NOT EXISTS "FriendRequest_pending_pair_unique_idx"
ON "FriendRequest" (LEAST("fromUserId", "toUserId"), GREATEST("fromUserId", "toUserId"))
WHERE "status" = 'PENDING';

-- One active challenge (pending/accepted) per user pair (bi-directional)
CREATE UNIQUE INDEX IF NOT EXISTS "FriendChallenge_active_pair_unique_idx"
ON "FriendChallenge" (LEAST("challengerUserId", "opponentUserId"), GREATEST("challengerUserId", "opponentUserId"))
WHERE "status" IN ('PENDING', 'ACCEPTED');

-- One activity row of each type per challenge
CREATE UNIQUE INDEX IF NOT EXISTS "FriendActivity_challenge_activity_unique_idx"
ON "FriendActivity" ("challengeId", "activityType")
WHERE "challengeId" IS NOT NULL;
