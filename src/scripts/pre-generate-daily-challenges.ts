import { prisma } from '../lib/prisma'
import { setupDailyChallenge } from '../app/api/daily-challenge/route'

/**
 * Pre-generate daily challenges for the next N days
 * This makes the daily challenge page more responsive since
 * challenges are already calculated and stored in the database
 */
async function preGenerateChallenges(daysAhead: number = 90) {
    console.log(`Pre-generating daily challenges for the next ${daysAhead} days...`)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let created = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < daysAhead; i++) {
        const targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + i)
        targetDate.setHours(0, 0, 0, 0)

        try {
            // Check if challenge already exists
            const existing = await prisma.dailyChallenge.findUnique({
                where: { date: targetDate }
            })

            if (existing) {
                console.log(`  ✓ Challenge already exists for ${targetDate.toISOString().split('T')[0]}`)
                skipped++
                continue
            }

            // Create challenge
            const challenge = await setupDailyChallenge(targetDate)
            
            if (challenge) {
                console.log(`  ✓ Created challenge for ${targetDate.toISOString().split('T')[0]}`)
                created++
            } else {
                console.error(`  ✗ Failed to create challenge for ${targetDate.toISOString().split('T')[0]}`)
                errors++
            }

            // Small delay to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error: any) {
            if (error.code === 'P2002') {
                // Unique constraint - challenge was created by another process
                console.log(`  ✓ Challenge already exists for ${targetDate.toISOString().split('T')[0]} (race condition)`)
                skipped++
            } else {
                console.error(`  ✗ Error creating challenge for ${targetDate.toISOString().split('T')[0]}:`, error.message)
                errors++
            }
        }
    }

    console.log('\n✅ Pre-generation complete!')
    console.log(`   Created: ${created}`)
    console.log(`   Skipped: ${skipped}`)
    console.log(`   Errors: ${errors}`)
}

async function main() {
    const daysAhead = process.argv[2] ? parseInt(process.argv[2]) : 90
    
    if (isNaN(daysAhead) || daysAhead < 1) {
        console.error('Invalid number of days. Usage: ts-node pre-generate-daily-challenges.ts [days]')
        process.exit(1)
    }

    try {
        await preGenerateChallenges(daysAhead)
    } catch (error) {
        console.error('Fatal error:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()

