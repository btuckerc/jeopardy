/**
 * Script to clear all daily challenges from the database
 * 
 * WARNING: This will delete ALL daily challenges and user completions!
 * 
 * Usage (from host machine):
 *   docker-compose exec web npx tsx src/scripts/clear-daily-challenges.ts --confirm
 * 
 * Or if running locally (not recommended - requires DATABASE_URL):
 *   npx tsx src/scripts/clear-daily-challenges.ts --confirm
 */

import { PrismaClient } from '@prisma/client'

// Use the shared prisma instance from lib/prisma.ts which handles connection properly
import { prisma } from '../lib/prisma'

async function clearDailyChallenges() {
    try {
        console.log('Clearing all daily challenges...')

        // First, delete all user completions (they reference daily challenges)
        const deletedCompletions = await prisma.userDailyChallenge.deleteMany({})
        console.log(`✓ Deleted ${deletedCompletions.count} user completions`)

        // Then delete all daily challenges
        const deletedChallenges = await prisma.dailyChallenge.deleteMany({})
        console.log(`✓ Deleted ${deletedChallenges.count} daily challenges`)

        console.log('\n✅ All daily challenges cleared successfully!')
        console.log('You can now re-seed daily challenges using the admin cron job.')
    } catch (error) {
        console.error('❌ Error clearing daily challenges:', error)
        throw error
    }
}

async function main() {
    const args = process.argv.slice(2)
    const confirmed = args.includes('--confirm')

    if (!confirmed) {
        console.log('⚠ WARNING: This will delete ALL daily challenges and user completions!')
        console.log('Run with --confirm to proceed.')
        process.exit(1)
    }

    try {
        await clearDailyChallenges()
    } catch (error) {
        console.error('❌ Failed to clear daily challenges:', error)
        process.exit(1)
    } finally {
        // Note: We don't disconnect here because we're using the shared prisma instance
        // which manages its own connection lifecycle
    }
}

main()

