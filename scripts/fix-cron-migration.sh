#!/bin/bash
# Script to fix the cron job execution migration issue
# This resolves the migration tracking mismatch

echo "🔧 Fixing cron job execution migration..."

# Check if we're in a Docker environment
if [ -f /.dockerenv ]; then
    echo "Running in Docker container"
    PRISMA_CMD="npx prisma"
else
    echo "Running locally"
    PRISMA_CMD="npx prisma"
fi

# Resolve the missing migration by marking it as rolled back
# This tells Prisma that the migration 20251203000000_add_cron_job_executions
# was rolled back and should be ignored
echo "Marking missing migration as rolled back..."
$PRISMA_CMD migrate resolve --rolled-back 20251203000000_add_cron_job_executions || {
    echo "⚠️  Could not resolve migration (this is okay if it doesn't exist in tracking)"
}

# Now apply the correct migration
echo "Applying migrations..."
$PRISMA_CMD migrate deploy

echo "✅ Migration fix complete!"

