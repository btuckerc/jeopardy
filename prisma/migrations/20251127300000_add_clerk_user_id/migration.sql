-- Add clerkUserId column to User table for Clerk authentication
-- This allows linking Clerk users to existing Prisma User records

ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;

-- Create unique index on clerkUserId
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

