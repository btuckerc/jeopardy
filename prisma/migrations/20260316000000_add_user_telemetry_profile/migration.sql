-- AlterTable
ALTER TABLE "User"
ADD COLUMN "locale" VARCHAR(16),
ADD COLUMN "timezone" VARCHAR(64),
ADD COLUMN "countryCode" VARCHAR(2),
ADD COLUMN "regionCode" VARCHAR(8),
ADD COLUMN "deviceType" VARCHAR(16),
ADD COLUMN "browserFamily" VARCHAR(32),
ADD COLUMN "osFamily" VARCHAR(32),
ADD COLUMN "referrerHost" VARCHAR(255),
ADD COLUMN "acquisitionSource" VARCHAR(64),
ADD COLUMN "acquisitionMedium" VARCHAR(64),
ADD COLUMN "acquisitionCampaign" VARCHAR(128);

-- CreateIndex
CREATE INDEX "User_countryCode_idx" ON "User"("countryCode");

-- CreateIndex
CREATE INDEX "User_deviceType_idx" ON "User"("deviceType");

-- CreateIndex
CREATE INDEX "User_locale_idx" ON "User"("locale");

-- CreateIndex
CREATE INDEX "User_timezone_idx" ON "User"("timezone");

-- CreateIndex
CREATE INDEX "User_acquisitionSource_idx" ON "User"("acquisitionSource");
