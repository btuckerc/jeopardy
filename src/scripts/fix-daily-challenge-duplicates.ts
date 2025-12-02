/**
 * Script to detect and optionally fix duplicate daily challenge questions
 * 
 * This script scans all DailyChallenge records to find:
 * 1. Duplicate questionIds (same question used for multiple dates)
 * 2. Provides option to reassign duplicates to fresh questions
 * 
 * Usage:
 *   npx tsx src/scripts/fix-daily-challenge-duplicates.ts [--fix]
 * 
 * Without --fix: Only reports duplicates
 * With --fix: Attempts to reassign duplicates to unused questions
 */

import { PrismaClient } from '@prisma/client'
import { setupDailyChallenge } from '../app/api/daily-challenge/route'

const prisma = new PrismaClient()

interface DuplicateInfo {
    questionId: string
    count: number
    challengeIds: string[]
    dates: Date[]
}

async function findDuplicates(): Promise<DuplicateInfo[]> {
    console.log('Scanning DailyChallenge records for duplicates...')

    // Get all daily challenges
    const allChallenges = await prisma.dailyChallenge.findMany({
        select: {
            id: true,
            date: true,
            questionId: true
        },
        orderBy: {
            date: 'asc'
        }
    })

    // Group by questionId
    const questionIdMap = new Map<string, { challengeIds: string[], dates: Date[] }>()
    
    for (const challenge of allChallenges) {
        if (!questionIdMap.has(challenge.questionId)) {
            questionIdMap.set(challenge.questionId, { challengeIds: [], dates: [] })
        }
        const entry = questionIdMap.get(challenge.questionId)!
        entry.challengeIds.push(challenge.id)
        entry.dates.push(challenge.date)
    }

    // Find duplicates (questionIds used more than once)
    const duplicates: DuplicateInfo[] = []
    for (const [questionId, data] of questionIdMap.entries()) {
        if (data.challengeIds.length > 1) {
            duplicates.push({
                questionId,
                count: data.challengeIds.length,
                challengeIds: data.challengeIds,
                dates: data.dates
            })
        }
    }

    return duplicates
}

async function fixDuplicates(duplicates: DuplicateInfo[], dryRun: boolean = true): Promise<void> {
    console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Attempting to fix ${duplicates.length} duplicate question(s)...`)

    let fixed = 0
    let failed = 0

    for (const dup of duplicates) {
        console.log(`\nProcessing duplicate questionId: ${dup.questionId}`)
        console.log(`  Used in ${dup.count} challenges:`)
        dup.dates.forEach((date, idx) => {
            console.log(`    - ${date.toISOString().split('T')[0]} (challengeId: ${dup.challengeIds[idx]})`)
        })

        // Keep the earliest date, reassign the rest
        const sortedIndices = dup.dates
            .map((date, idx) => ({ date, idx }))
            .sort((a, b) => a.date.getTime() - b.date.getTime())

        const keepIndex = sortedIndices[0].idx
        const reassignIndices = sortedIndices.slice(1).map(item => item.idx)

        console.log(`  Keeping challenge for ${dup.dates[keepIndex].toISOString().split('T')[0]}`)
        console.log(`  Reassigning ${reassignIndices.length} challenge(s)...`)

        for (const idx of reassignIndices) {
            const challengeId = dup.challengeIds[idx]
            const date = dup.dates[idx]

            try {
                if (dryRun) {
                    console.log(`    [DRY RUN] Would reassign challenge ${challengeId} for ${date.toISOString().split('T')[0]}`)
                } else {
                    // Delete the duplicate challenge
                    await prisma.dailyChallenge.delete({
                        where: { id: challengeId }
                    })

                    // Create a new challenge with a different question
                    const newChallenge = await setupDailyChallenge(date)
                    
                    if (newChallenge) {
                        console.log(`    ✓ Reassigned challenge ${challengeId} for ${date.toISOString().split('T')[0]} to questionId ${newChallenge.questionId}`)
                        fixed++
                    } else {
                        console.error(`    ✗ Failed to create new challenge for ${date.toISOString().split('T')[0]}`)
                        failed++
                    }
                }
            } catch (error: any) {
                console.error(`    ✗ Error reassigning challenge ${challengeId}:`, error.message)
                failed++
            }
        }
    }

    if (!dryRun) {
        console.log(`\n✓ Fixed ${fixed} duplicate(s), ${failed} failed`)
    } else {
        console.log(`\n[DRY RUN] Would fix ${duplicates.reduce((sum, d) => sum + d.count - 1, 0)} duplicate challenge(s)`)
    }
}

async function main() {
    const args = process.argv.slice(2)
    const shouldFix = args.includes('--fix')
    const dryRun = !shouldFix

    try {
        console.log('Daily Challenge Duplicate Detection and Fix Script')
        console.log('=' .repeat(60))

        // Find duplicates
        const duplicates = await findDuplicates()

        if (duplicates.length === 0) {
            console.log('\n✓ No duplicates found! All daily challenges use unique questions.')
            return
        }

        console.log(`\n⚠ Found ${duplicates.length} duplicate questionId(s):`)
        duplicates.forEach(dup => {
            console.log(`\n  QuestionId: ${dup.questionId}`)
            console.log(`  Used in ${dup.count} challenges:`)
            dup.dates.forEach((date, idx) => {
                console.log(`    - ${date.toISOString().split('T')[0]} (ID: ${dup.challengeIds[idx]})`)
            })
        })

        const totalDuplicateChallenges = duplicates.reduce((sum, d) => sum + d.count - 1, 0)
        console.log(`\nTotal duplicate challenges to fix: ${totalDuplicateChallenges}`)

        if (dryRun) {
            console.log('\nThis is a dry run. Use --fix to actually reassign duplicates.')
            await fixDuplicates(duplicates, true)
        } else {
            console.log('\n⚠ FIX MODE: This will reassign duplicate challenges to new questions.')
            console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
            await new Promise(resolve => setTimeout(resolve, 5000))
            await fixDuplicates(duplicates, false)
        }

    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()

