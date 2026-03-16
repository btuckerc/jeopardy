-- Friend request status enum
CREATE TYPE "FriendRequestStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED'
);

-- Friend challenge status enum
CREATE TYPE "FriendChallengeStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED'
);

-- Friend challenge mode enum
CREATE TYPE "FriendChallengeMode" AS ENUM (
  'PRACTICE',
  'GAME'
);

-- Friend activity type enum
CREATE TYPE "FriendActivityType" AS ENUM (
  'FRIEND_REQUEST_SENT',
  'FRIEND_REQUEST_ACCEPTED',
  'FRIEND_REQUEST_DECLINED',
  'FRIEND_REQUEST_CANCELLED',
  'FRIEND_REQUEST_BLOCKED',
  'CHALLENGE_CREATED',
  'CHALLENGE_ACCEPTED',
  'CHALLENGE_DECLINED',
  'CHALLENGE_COMPLETED',
  'CHALLENGE_CANCELLED'
);

-- Friendships table
CREATE TABLE "Friendship" (
  "id" TEXT NOT NULL,
  "userId1" TEXT NOT NULL,
  "userId2" TEXT NOT NULL,
  "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friendship_userId1_fkey" FOREIGN KEY ("userId1") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_userId2_fkey" FOREIGN KEY ("userId2") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_userId1_userId2_key" UNIQUE ("userId1", "userId2")
);

-- Friend requests table
CREATE TABLE "FriendRequest" (
  "id" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FriendRequest_fromUserId_idx" ON "FriendRequest" ("fromUserId");
CREATE INDEX "FriendRequest_toUserId_idx" ON "FriendRequest" ("toUserId");
CREATE INDEX "FriendRequest_status_idx" ON "FriendRequest" ("status");
CREATE INDEX "FriendRequest_fromUserId_toUserId_status_idx" ON "FriendRequest" ("fromUserId", "toUserId", "status");

CREATE TABLE "FriendChallenge" (
  "id" TEXT NOT NULL,
  "challengerUserId" TEXT NOT NULL,
  "opponentUserId" TEXT NOT NULL,
  "mode" "FriendChallengeMode" NOT NULL DEFAULT 'PRACTICE',
  "message" TEXT,
  "targetValue" INTEGER,
  "status" "FriendChallengeStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "winnerUserId" TEXT,
  "challengerScore" INTEGER,
  "opponentScore" INTEGER,
  "completedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendChallenge_challengerUserId_fkey" FOREIGN KEY ("challengerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendChallenge_opponentUserId_fkey" FOREIGN KEY ("opponentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendChallenge_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "FriendChallenge_challengerUserId_idx" ON "FriendChallenge" ("challengerUserId");
CREATE INDEX "FriendChallenge_opponentUserId_idx" ON "FriendChallenge" ("opponentUserId");
CREATE INDEX "FriendChallenge_status_idx" ON "FriendChallenge" ("status");
CREATE INDEX "FriendChallenge_expiresAt_idx" ON "FriendChallenge" ("expiresAt");

CREATE TABLE "FriendActivity" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "relatedUserId" TEXT,
  "challengeId" TEXT,
  "activityType" "FriendActivityType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendActivity_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "FriendActivity_actorUserId_idx" ON "FriendActivity" ("actorUserId");
CREATE INDEX "FriendActivity_relatedUserId_idx" ON "FriendActivity" ("relatedUserId");
CREATE INDEX "FriendActivity_activityType_idx" ON "FriendActivity" ("activityType");
CREATE INDEX "FriendActivity_createdAt_idx" ON "FriendActivity" ("createdAt");

-- Friend visibility controls for discovery + request acceptance defaults.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'FriendVisibility'
  ) THEN
    CREATE TYPE "FriendVisibility" AS ENUM ('FULL_PROFILE', 'STREAK_ONLY');
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "friendVisibility" "FriendVisibility" NOT NULL DEFAULT 'FULL_PROFILE';
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true;

-- User-level blocklist to prevent future interactions.
CREATE TABLE IF NOT EXISTS "FriendBlock" (
  "id" TEXT NOT NULL,
  "blockerUserId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendBlock_blockerUserId_blockedUserId_key" UNIQUE ("blockerUserId", "blockedUserId")
);

CREATE INDEX IF NOT EXISTS "FriendBlock_blockerUserId_idx" ON "FriendBlock" ("blockerUserId");
CREATE INDEX IF NOT EXISTS "FriendBlock_blockedUserId_idx" ON "FriendBlock" ("blockedUserId");
