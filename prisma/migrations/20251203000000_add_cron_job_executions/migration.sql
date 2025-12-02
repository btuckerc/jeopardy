-- CreateEnum (idempotent)
DO $$ BEGIN
    CREATE TYPE "CronJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "CronJobExecution" (
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

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CronJobExecution_jobName_startedAt_idx" ON "CronJobExecution"("jobName", "startedAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CronJobExecution_status_idx" ON "CronJobExecution"("status");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "CronJobExecution_startedAt_idx" ON "CronJobExecution"("startedAt");

