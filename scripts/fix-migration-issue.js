#!/usr/bin/env node
/**
 * Script to fix the cron job execution migration issue
 * Resolves the migration tracking mismatch by marking the missing migration as rolled back
 */

const { execSync } = require('child_process');

console.log('🔧 Fixing cron job execution migration issue...');

try {
    // Try to resolve the missing migration by marking it as rolled back
    // This tells Prisma that the migration 20251203000000_add_cron_job_executions
    // was rolled back and should be ignored
    console.log('Attempting to resolve missing migration...');
    try {
        execSync('npx prisma migrate resolve --rolled-back 20251203000000_add_cron_job_executions', {
            stdio: 'inherit'
        });
        console.log('✅ Successfully resolved migration');
    } catch (error) {
        // This is okay - the migration might not exist in tracking
        console.log('⚠️  Migration not found in tracking (this is okay)');
    }
    
    // Now try to deploy migrations
    console.log('Applying migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Migrations applied successfully');
} catch (error) {
    console.error('❌ Failed to fix migration issue:', error.message);
    console.error('\n💡 Manual fix:');
    console.error('   1. Connect to your database');
    console.error('   2. Run: DELETE FROM "_prisma_migrations" WHERE migration_name = \'20251203000000_add_cron_job_executions\';');
    console.error('   3. Or run: npx prisma migrate resolve --rolled-back 20251203000000_add_cron_job_executions');
    process.exit(1);
}

