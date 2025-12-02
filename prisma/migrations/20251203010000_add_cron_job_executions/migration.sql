-- CreateEnum
CREATE TYPE "CronJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "CronJobExecution" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "CronJobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronJobExecution_jobName_startedAt_idx" ON "CronJobExecution"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "CronJobExecution_status_idx" ON "CronJobExecution"("status");

-- CreateIndex
CREATE INDEX "CronJobExecution_startedAt_idx" ON "CronJobExecution"("startedAt");

