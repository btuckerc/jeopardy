ALTER TABLE "User"
ADD COLUMN "friendCode" VARCHAR(16),
ADD COLUMN "friendInviteToken" VARCHAR(64),
ADD COLUMN "friendInviteTokenCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
CREATE UNIQUE INDEX "User_friendInviteToken_key" ON "User"("friendInviteToken");
