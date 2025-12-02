/**
 * Daily Challenge Cron Service
 * 
 * Automatically generates daily challenges and fetches recent games using node-cron.
 * Runs daily at 2 AM UTC to ensure challenges are always available.
 * Only runs in production mode (when deployed via Docker Compose).
 */

import * as cron from 'node-cron'
import { setupDailyChallenge } from '@/app/api/daily-challenge/route'
import { prisma } from './prisma'
import { parseGameByDate } from './jarchive-scraper'
import { format, subDays } from 'date-fns'

let dailyChallengeCronJob: cron.ScheduledTask | null = null
let fetchGamesCronJob: cron.ScheduledTask | null = null

/**
 * Fetch and save games for the last 7 days
 */
async function fetchLast7DaysGames() {
    console.log('[Fetch Games Cron] Starting to fetch last 7 days of games...')
    
    let totalCreated = 0
    let totalSkipped = 0
    let totalErrors = 0

    // Fetch games for the last 7 days (including today)
    for (let i = 0; i < 7; i++) {
        const targetDate = subDays(new Date(), i)
        const dateStr = format(targetDate, 'yyyy-MM-dd')

        try {
            console.log(`[Fetch Games Cron] Fetching game for ${dateStr}...`)

            // Parse game from J-Archive
            const game = await parseGameByDate(dateStr)

            if (!game || !game.questions || game.questions.length === 0) {
                console.log(`[Fetch Games Cron] No game found for ${dateStr}`)
                totalSkipped++
                continue
            }

            console.log(`[Fetch Games Cron] Found ${game.questions.length} questions from game ${game.gameId}`)

            // Save questions to database
            let created = 0
            let skipped = 0

            await prisma.$transaction(async (tx) => {
                for (const question of game.questions) {
                    // Check if question already exists (avoid duplicates)
                    const existing = await tx.question.findFirst({
                        where: {
                            question: question.question,
                            airDate: new Date(dateStr)
                        }
                    })

                    if (existing) {
                        skipped++
                        continue
                    }

                    // Create or update category
                    const category = await tx.category.upsert({
                        where: { name: question.category },
                        create: { 
                            name: question.category,
                            knowledgeCategory: question.knowledgeCategory
                        },
                        update: {}
                    })

                    // Create the question with proper round field
                    await tx.question.create({
                        data: {
                            question: question.question,
                            answer: question.answer,
                            value: question.value,
                            difficulty: question.difficulty,
                            knowledgeCategory: question.knowledgeCategory,
                            airDate: new Date(dateStr),
                            round: question.round,
                            isDoubleJeopardy: question.round === 'DOUBLE', // Legacy field
                            wasTripleStumper: question.wasTripleStumper ?? false,
                            category: {
                                connect: { id: category.id }
                            }
                        }
                    })
                    created++
                }
            })

            totalCreated += created
            totalSkipped += skipped

            if (created > 0) {
                console.log(`[Fetch Games Cron] Saved ${created} questions for ${dateStr} (skipped ${skipped} duplicates)`)
            } else {
                console.log(`[Fetch Games Cron] All questions already exist for ${dateStr}`)
            }

            // Small delay to avoid overwhelming J-Archive
            await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error: any) {
            totalErrors++
            console.error(`[Fetch Games Cron] Error fetching game for ${dateStr}:`, error.message)
        }
    }

    console.log(`[Fetch Games Cron] Completed: ${totalCreated} created, ${totalSkipped} skipped, ${totalErrors} errors`)
}

/**
 * Initialize all cron jobs
 * Should be called once when the application starts
 */
export function startDailyChallengeCron() {
    // Only run in production (Docker Compose deployment)
    if (process.env.NODE_ENV !== 'production') {
        console.log('[Cron Jobs] Skipping cron initialization in non-production environment')
        return
    }

    // Prevent duplicate initialization
    if (dailyChallengeCronJob || fetchGamesCronJob) {
        console.log('[Cron Jobs] Cron jobs already initialized')
        return
    }

    console.log('[Cron Jobs] Initializing cron jobs...')

    // Schedule: Run daily at 2 AM UTC
    // Format: minute hour day month weekday
    // '0 2 * * *' = At 02:00 UTC every day
    dailyChallengeCronJob = cron.schedule('0 2 * * *', async () => {
        console.log('[Daily Challenge Cron] Starting daily challenge generation...')
        
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Generate challenges for today + next 7 days (8 total)
            const daysToGenerate = 8
            let created = 0
            let skipped = 0
            let errors = 0

            for (let i = 0; i < daysToGenerate; i++) {
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
                        skipped++
                        console.log(`[Daily Challenge Cron] Challenge already exists for ${dateStr}: questionId=${existing.questionId}, airDate=${existing.question?.airDate?.toISOString().split('T')[0]}`)
                        continue
                    }

                    // Create challenge (setupDailyChallenge handles retries internally)
                    const challenge = await setupDailyChallenge(targetDate)

                    if (challenge) {
                        created++
                        console.log(`[Daily Challenge Cron] Created challenge for ${dateStr}: questionId=${challenge.questionId}, airDate=${challenge.question?.airDate?.toISOString().split('T')[0]}`)
                    } else {
                        errors++
                        console.error(`[Daily Challenge Cron] Failed to create challenge for ${dateStr}`)
                    }
                } catch (error: any) {
                    if (error.code === 'P2002') {
                        // Unique constraint - challenge was created by another process (race condition)
                        skipped++
                        console.log(`[Daily Challenge Cron] Race condition detected for ${dateStr}, challenge was created by another process`)
                    } else {
                        errors++
                        console.error(`[Daily Challenge Cron] Error creating challenge for ${dateStr}:`, error.message)
                    }
                }
            }

            console.log(`[Daily Challenge Cron] Completed: ${created} created, ${skipped} skipped, ${errors} errors`)
        } catch (error: any) {
            console.error('[Daily Challenge Cron] Fatal error:', error.message)
        }
    }, {
        timezone: 'UTC'
    })

    console.log('[Daily Challenge Cron] Scheduled to run daily at 2 AM UTC')

    // Schedule game fetching: Run daily at 3 AM UTC (after challenge generation)
    // This fetches the last 7 days of games to ensure we have recent data
    fetchGamesCronJob = cron.schedule('0 3 * * *', async () => {
        console.log('[Fetch Games Cron] Starting game fetch job...')
        try {
            await fetchLast7DaysGames()
        } catch (error: any) {
            console.error('[Fetch Games Cron] Fatal error:', error.message)
        }
    }, {
        timezone: 'UTC'
    })

    console.log('[Fetch Games Cron] Scheduled to run daily at 3 AM UTC')
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopDailyChallengeCron() {
    if (dailyChallengeCronJob) {
        dailyChallengeCronJob.stop()
        dailyChallengeCronJob = null
        console.log('[Daily Challenge Cron] Stopped')
    }
    if (fetchGamesCronJob) {
        fetchGamesCronJob.stop()
        fetchGamesCronJob = null
        console.log('[Fetch Games Cron] Stopped')
    }
}

