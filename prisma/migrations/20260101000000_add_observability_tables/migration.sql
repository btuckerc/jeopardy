-- CreateTable
CREATE TABLE "ApiRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "userId" TEXT,
    "isAdminRoute" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "ApiRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbQueryEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "recordCount" INTEGER,
    "isSlow" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DbQueryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiRequestEvent_requestId_key" ON "ApiRequestEvent"("requestId");

-- CreateIndex
CREATE INDEX "ApiRequestEvent_timestamp_idx" ON "ApiRequestEvent"("timestamp");

-- CreateIndex
CREATE INDEX "ApiRequestEvent_route_idx" ON "ApiRequestEvent"("route");

-- CreateIndex
CREATE INDEX "ApiRequestEvent_statusCode_idx" ON "ApiRequestEvent"("statusCode");

-- CreateIndex
CREATE INDEX "ApiRequestEvent_userId_idx" ON "ApiRequestEvent"("userId");

-- CreateIndex
CREATE INDEX "ApiRequestEvent_route_timestamp_idx" ON "ApiRequestEvent"("route", "timestamp");

-- CreateIndex
CREATE INDEX "ApiRequestEvent_statusCode_timestamp_idx" ON "ApiRequestEvent"("statusCode", "timestamp");

-- CreateIndex
CREATE INDEX "DbQueryEvent_timestamp_idx" ON "DbQueryEvent"("timestamp");

-- CreateIndex
CREATE INDEX "DbQueryEvent_model_idx" ON "DbQueryEvent"("model");

-- CreateIndex
CREATE INDEX "DbQueryEvent_action_idx" ON "DbQueryEvent"("action");

-- CreateIndex
CREATE INDEX "DbQueryEvent_isSlow_idx" ON "DbQueryEvent"("isSlow");

-- CreateIndex
CREATE INDEX "DbQueryEvent_model_action_idx" ON "DbQueryEvent"("model", "action");

-- CreateIndex
CREATE INDEX "DbQueryEvent_requestId_idx" ON "DbQueryEvent"("requestId");

-- CreateIndex
CREATE INDEX "DbQueryEvent_durationMs_idx" ON "DbQueryEvent"("durationMs");

-- CreateIndex
CREATE INDEX "DbQueryEvent_isSlow_timestamp_idx" ON "DbQueryEvent"("isSlow", "timestamp");

