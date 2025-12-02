-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN "category" TEXT,
ADD COLUMN "tier" INTEGER,
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");

