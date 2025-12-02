/**
 * Test Script: Generate Daily Challenges and Verify No Duplicates
 * 
 * This script:
 * 1. Clears existing challenges for the next 30 days (optional)
 * 2. Generates 30 days of daily challenges
 * 3. Verifies no duplicate questionIds are used
 * 4. Reports detailed statistics
 * 
 * Usage:
 *   npx tsx src/scripts/test-daily-challenge-generation.ts [--clear]
 * 
 * --clear: Delete existing challenges for the test date range before generating
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // Also try .env as fallback

import { prisma } from '../lib/prisma'
import { setupDailyChallenge } from '../app/api/daily-challenge/route'

const TEST_DAYS = 30

interface ChallengeResult {
    date: string
    questionId: string
    airDate: string | null
    episodeGameId: string | null
    status: 'created' | 'skipped' | 'error'
    error?: string
}

async function clearTestChallenges(startDate: Date, endDate: Date): Promise<number> {
    console.log(`Clearing existing challenges from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`)
    
    const result = await prisma.dailyChallenge.deleteMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    })
    
    console.log(`  ✓ Deleted ${result.count} existing challenge(s)`)
    return result.count
}

async function generateChallenges(days: number): Promise<ChallengeResult[]> {
    console.log(`\nGenerating ${days} daily challenges...`)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const results: ChallengeResult[] = []
    
    for (let i = 0; i < days; i++) {
        const targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + i)
        targetDate.setHours(0, 0, 0, 0)
        
        const dateStr = targetDate.toISOString().split('T')[0]
        
        try {
            // Check if challenge already exists
            const existing = await prisma.dailyChallenge.findUnique({
                where: { date: targetDate },
                include: {
                    question: {
                        select: {
                            id: true,
                            airDate: true
                        }
                    }
                }
            })
            
            if (existing) {
                results.push({
                    date: dateStr,
                    questionId: existing.questionId,
                    airDate: existing.question?.airDate?.toISOString().split('T')[0] || null,
                    episodeGameId: existing.episodeGameId,
                    status: 'skipped'
                })
                console.log(`  [${i + 1}/${days}] ✓ Already exists: ${dateStr} (questionId: ${existing.questionId})`)
                continue
            }
            
            // Create challenge
            const challenge = await setupDailyChallenge(targetDate)
            
            if (challenge) {
                results.push({
                    date: dateStr,
                    questionId: challenge.questionId,
                    airDate: challenge.question?.airDate?.toISOString().split('T')[0] || null,
                    episodeGameId: challenge.episodeGameId,
                    status: 'created'
                })
                console.log(`  [${i + 1}/${days}] ✓ Created: ${dateStr} (questionId: ${challenge.questionId}, airDate: ${challenge.question?.airDate?.toISOString().split('T')[0]})`)
            } else {
                results.push({
                    date: dateStr,
                    questionId: '',
                    airDate: null,
                    episodeGameId: null,
                    status: 'error',
                    error: 'Failed to create challenge'
                })
                console.error(`  [${i + 1}/${days}] ✗ Failed: ${dateStr}`)
            }
            
            // Small delay to ensure database consistency
            if (i < days - 1) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        } catch (error: any) {
            if (error.code === 'P2002') {
                // Race condition - challenge was created by another process
                const existing = await prisma.dailyChallenge.findUnique({
                    where: { date: targetDate },
                    include: {
                        question: {
                            select: {
                                id: true,
                                airDate: true
                            }
                        }
                    }
                })
                
                results.push({
                    date: dateStr,
                    questionId: existing?.questionId || '',
                    airDate: existing?.question?.airDate?.toISOString().split('T')[0] || null,
                    episodeGameId: existing?.episodeGameId || null,
                    status: 'skipped'
                })
                console.log(`  [${i + 1}/${days}] ✓ Race condition: ${dateStr} (questionId: ${existing?.questionId})`)
            } else {
                results.push({
                    date: dateStr,
                    questionId: '',
                    airDate: null,
                    episodeGameId: null,
                    status: 'error',
                    error: error.message || 'Unknown error'
                })
                console.error(`  [${i + 1}/${days}] ✗ Error: ${dateStr} - ${error.message}`)
            }
        }
    }
    
    return results
}

async function verifyNoDuplicates(results: ChallengeResult[]): Promise<{
    hasDuplicates: boolean
    duplicates: Map<string, string[]>
    uniqueQuestions: number
    totalChallenges: number
}> {
    console.log('\nVerifying no duplicate questionIds...')
    
    const questionIdMap = new Map<string, string[]>()
    
    // Group challenges by questionId
    for (const result of results) {
        if (result.status === 'error' || !result.questionId) {
            continue
        }
        
        if (!questionIdMap.has(result.questionId)) {
            questionIdMap.set(result.questionId, [])
        }
        questionIdMap.get(result.questionId)!.push(result.date)
    }
    
    // Find duplicates
    const duplicates = new Map<string, string[]>()
    for (const [questionId, dates] of questionIdMap.entries()) {
        if (dates.length > 1) {
            duplicates.set(questionId, dates)
        }
    }
    
    const uniqueQuestions = questionIdMap.size
    const totalChallenges = results.filter(r => r.status !== 'error' && r.questionId).length
    
    return {
        hasDuplicates: duplicates.size > 0,
        duplicates,
        uniqueQuestions,
        totalChallenges
    }
}

async function printStatistics(results: ChallengeResult[], verification: {
    hasDuplicates: boolean
    duplicates: Map<string, string[]>
    uniqueQuestions: number
    totalChallenges: number
}) {
    console.log('\n' + '='.repeat(70))
    console.log('TEST RESULTS')
    console.log('='.repeat(70))
    
    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error').length
    
    console.log(`\nGeneration Statistics:`)
    console.log(`  Total days processed: ${results.length}`)
    console.log(`  ✓ Created: ${created}`)
    console.log(`  ⊘ Skipped (already existed): ${skipped}`)
    console.log(`  ✗ Errors: ${errors}`)
    
    console.log(`\nDuplicate Verification:`)
    console.log(`  Total challenges: ${verification.totalChallenges}`)
    console.log(`  Unique questions: ${verification.uniqueQuestions}`)
    
    if (verification.hasDuplicates) {
        console.log(`  ⚠ DUPLICATES FOUND: ${verification.duplicates.size} questionId(s) used multiple times`)
        console.log(`\n  Duplicate Details:`)
        for (const [questionId, dates] of verification.duplicates.entries()) {
            console.log(`    QuestionId: ${questionId}`)
            console.log(`    Used on ${dates.length} dates:`)
            dates.forEach(date => {
                console.log(`      - ${date}`)
            })
        }
    } else {
        console.log(`  ✓ NO DUPLICATES: All ${verification.uniqueQuestions} questions are unique!`)
    }
    
    // Show sample of generated challenges
    const successfulResults = results.filter(r => r.status !== 'error' && r.questionId)
    if (successfulResults.length > 0) {
        console.log(`\nSample Challenges (first 5):`)
        successfulResults.slice(0, 5).forEach(result => {
            console.log(`  ${result.date}: questionId=${result.questionId}, airDate=${result.airDate || 'N/A'}`)
        })
    }
    
    console.log('\n' + '='.repeat(70))
}

async function main() {
    const args = process.argv.slice(2)
    const shouldClear = args.includes('--clear')
    
    try {
        console.log('Daily Challenge Generation Test')
        console.log('='.repeat(70))
        console.log(`Test: Generate ${TEST_DAYS} days of daily challenges and verify no duplicates`)
        
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + TEST_DAYS - 1)
        endDate.setHours(23, 59, 59, 999)
        
        // Clear existing challenges if requested
        if (shouldClear) {
            await clearTestChallenges(today, endDate)
        } else {
            console.log(`\nNote: Existing challenges will be skipped. Use --clear to delete them first.`)
        }
        
        // Generate challenges
        const results = await generateChallenges(TEST_DAYS)
        
        // Verify no duplicates
        const verification = await verifyNoDuplicates(results)
        
        // Print statistics
        await printStatistics(results, verification)
        
        // Exit with error code if duplicates found
        if (verification.hasDuplicates) {
            console.error('\n❌ TEST FAILED: Duplicates detected!')
            process.exit(1)
        } else if (results.filter(r => r.status === 'error').length > 0) {
            console.warn('\n⚠ TEST COMPLETED WITH ERRORS: Some challenges failed to generate')
            process.exit(1)
        } else {
            console.log('\n✅ TEST PASSED: All challenges generated successfully with no duplicates!')
            process.exit(0)
        }
    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()

