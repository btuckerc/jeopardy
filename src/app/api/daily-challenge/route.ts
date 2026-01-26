import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse, parseBody, badRequestResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseGameByDate, parseGameById, getSeasonGames, type SeasonGame } from '@/lib/jarchive-scraper'
import { checkAnswer } from '@/app/lib/answer-checker'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { getGuestConfig, createGuestSession } from '@/lib/guest-sessions'
import { isWeekday } from '@/lib/game-utils'
import { getQuestionOverrides, isAnswerAcceptedWithOverrides } from '@/lib/answer-overrides'
import { getActiveChallengeDate } from '@/lib/daily-challenge-utils'

/**
 * GET /api/daily-challenge
 * Get today's daily challenge (Final Jeopardy question from historical games)
 */
export const GET = withInstrumentation(async (request: NextRequest) => {
    try {
        // Get the active challenge date (based on 9AM ET boundary)
        const challengeDate = getActiveChallengeDate()
        
        // Check if challenge exists for today
        let challenge = await prisma.dailyChallenge.findUnique({
            where: { date: challengeDate },
            include: {
                question: {
                    include: {
                        category: true
                    }
                }
            }
        })

        // If no challenge exists, create one (with proper error handling)
        if (!challenge) {
            try {
                challenge = await setupDailyChallenge(challengeDate)
            } catch (error: any) {
                // If it's a unique constraint error, challenge was created by another request
                if (error.code === 'P2002') {
                    // Retry fetching the challenge
                    challenge = await prisma.dailyChallenge.findUnique({
                        where: { date: challengeDate },
                        include: {
                            question: {
                                include: {
                                    category: true
                                }
                            }
                        }
                    })
                } else {
                    console.error('Error setting up daily challenge:', error)
                }
            }
        }

        if (!challenge) {
            return jsonResponse({ error: 'Failed to setup daily challenge' }, 500)
        }

        // Get user's answer if authenticated
        let userAnswer = null
        const user = await getAppUser()
        if (user) {
            const userChallenge = await prisma.userDailyChallenge.findUnique({
                where: {
                    userId_challengeId: {
                        userId: user.id,
                        challengeId: challenge.id
                    }
                }
            })
            if (userChallenge) {
                userAnswer = {
                    correct: userChallenge.correct,
                    completedAt: userChallenge.completedAt,
                    userAnswerText: userChallenge.userAnswer || null
                }
            }
        }

        // Get guest config to include in response
        const guestConfig = await getGuestConfig()

        return jsonResponse({
            id: challenge.id,
            date: challenge.date,
            question: {
                id: challenge.question.id,
                question: challenge.question.question,
                answer: challenge.question.answer,
                category: challenge.question.category.name,
                airDate: challenge.question.airDate
            },
            userAnswer,
            guestConfig: {
                guestEnabled: guestConfig.dailyChallengeGuestEnabled,
                guestAppearsOnLeaderboard: guestConfig.dailyChallengeGuestAppearsOnLeaderboard
            }
        })
    } catch (error) {
        return serverErrorResponse('Error fetching daily challenge', error)
    }
})

/**
 * POST /api/daily-challenge
 * Submit answer for today's daily challenge
 */
const submitAnswerSchema = z.object({
    answer: z.string().min(1)
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    try {
        const user = await getAppUser()
        const guestConfig = await getGuestConfig()
        
        // Check if guest participation is enabled
        const isGuest = !user
        if (isGuest && !guestConfig.dailyChallengeGuestEnabled) {
            return jsonResponse({
                error: 'Authentication required for daily challenge',
                requiresAuth: true
            }, 401)
        }

        const { data: body, error } = await parseBody(request, submitAnswerSchema)
        if (error) return error

        // Get the active challenge date (based on 9AM ET boundary)
        const challengeDate = getActiveChallengeDate()

        // Get today's challenge
        let challenge = await prisma.dailyChallenge.findUnique({
            where: { date: challengeDate },
            include: {
                question: true
            }
        })

        if (!challenge) {
            try {
                challenge = await setupDailyChallenge(challengeDate)
            } catch (error: any) {
                // If it's a unique constraint error, challenge was created by another request
                if (error.code === 'P2002') {
                    challenge = await prisma.dailyChallenge.findUnique({
                        where: { date: challengeDate },
                        include: {
                            question: true
                        }
                    })
                } else {
                    console.error('Error setting up daily challenge:', error)
                }
            }
        }

        if (!challenge) {
            return jsonResponse({ error: 'Daily challenge not available' }, 404)
        }

        // Check answer using override-aware checking
        const overrides = await getQuestionOverrides(challenge.questionId)
        const correct = isAnswerAcceptedWithOverrides(
            body.answer,
            challenge.question.answer,
            overrides
        )

        // Handle guest vs authenticated user differently
        if (isGuest) {
            // Create guest session for later claim
            const session = await createGuestSession('DAILY_CHALLENGE', {
                challengeId: challenge.id,
                questionId: challenge.questionId,
                correct,
                userAnswer: body.answer,
                timestamp: new Date().toISOString()
            })

            return jsonResponse({
                correct,
                answer: challenge.question.answer,
                guestSessionId: session.id,
                expiresAt: session.expiresAt.toISOString(),
                requiresAuth: true,
                message: 'Sign in to save your answer and appear on the leaderboard'
            })
        }

        // Authenticated user flow
        // Check if user already answered
        const existingAnswer = await prisma.userDailyChallenge.findUnique({
            where: {
                userId_challengeId: {
                    userId: user!.id,
                    challengeId: challenge.id
                }
            }
        })

        if (existingAnswer) {
            return jsonResponse({
                correct: existingAnswer.correct,
                alreadyAnswered: true
            })
        }

        // Save answer
        await prisma.userDailyChallenge.create({
            data: {
                userId: user!.id,
                challengeId: challenge.id,
                correct,
                userAnswer: body.answer
            }
        })

        // Check for achievements
        const newlyUnlocked = await checkAndUnlockAchievements(user!.id, {
            type: 'daily_challenge_completed',
            data: { challengeId: challenge.id, correct }
        })

        return jsonResponse({
            correct,
            answer: challenge.question.answer,
            newlyUnlockedAchievements: newlyUnlocked
        })
    } catch (error) {
        return serverErrorResponse('Error submitting daily challenge answer', error)
    }
})

/**
 * Setup daily challenge for a given date
 * Uses season/episode-based selection:
 * 1. Gets episodes from admin-configured seasons
 * 2. Filters out episodes used in last 365 days
 * 3. Selects an episode deterministically
 * 4. Downloads only that specific game
 * 5. Uses its Final Jeopardy question (never repeats globally)
 * 
 * @param date The date for which to create the daily challenge
 * @param maxRetries Maximum number of retries if unique constraint conflicts occur
 * @returns The created DailyChallenge or null if creation failed
 */
export async function setupDailyChallenge(date: Date, maxRetries: number = 5): Promise<any> {
    const dateString = date.toISOString().split('T')[0]
    
    // Get configuration
    const guestConfig = await getGuestConfig()
    const minLookbackDays = guestConfig.dailyChallengeMinLookbackDays || 365
    
    // Get configured seasons (default to recent seasons if not configured)
    let configuredSeasons: number[] = []
    if (guestConfig.dailyChallengeSeasons && Array.isArray(guestConfig.dailyChallengeSeasons)) {
        configuredSeasons = guestConfig.dailyChallengeSeasons as number[]
    } else {
        // Default: use seasons from 1-3 years ago
        const currentYear = date.getFullYear()
        const threeYearsAgo = currentYear - 3
        const oneYearAgo = currentYear - 1
        // Jeopardy seasons roughly map to years (season 1 = 1984, so season ≈ year - 1983)
        configuredSeasons = []
        for (let year = threeYearsAgo; year <= oneYearAgo; year++) {
            const estimatedSeason = year - 1983
            if (estimatedSeason > 0) {
                configuredSeasons.push(estimatedSeason)
            }
        }
    }

    if (configuredSeasons.length === 0) {
        console.error(`[Daily Challenge ${dateString}] No seasons configured`)
        return null
    }

    console.log(`[Daily Challenge ${dateString}] Using seasons: ${configuredSeasons.join(', ')}`)

    // Track episodes we've tried to avoid infinite loops
    const attemptedEpisodeGameIds = new Set<string>()

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Step 1: Get all globally used question IDs (NEVER repeat these)
            const usedQuestionIds = await prisma.dailyChallenge.findMany({
                select: { questionId: true },
                distinct: ['questionId']
            })
            const usedIdsSet = new Set(usedQuestionIds.map(c => c.questionId))
            
            // Step 2: Get episodes used in the last 365 days (by gameId/airDate)
            const cutoffDate = new Date(date)
            cutoffDate.setDate(cutoffDate.getDate() - 365)
            cutoffDate.setHours(0, 0, 0, 0)
            
            const recentChallenges = await prisma.dailyChallenge.findMany({
                where: {
                    date: {
                        gte: cutoffDate
                    }
                },
                select: {
                    episodeGameId: true,
                    airDate: true
                }
            })
            
            const usedEpisodeGameIds = new Set(
                recentChallenges
                    .map(c => c.episodeGameId)
                    .filter(Boolean) as string[]
            )
            const usedAirDates = new Set(
                recentChallenges
                    .map(c => c.airDate?.toISOString().split('T')[0])
                    .filter(Boolean) as string[]
            )
            
            // Also exclude episodes we've already tried in this call
            attemptedEpisodeGameIds.forEach(id => usedEpisodeGameIds.add(id))
            
            console.log(`[Daily Challenge ${dateString}] Attempt ${attempt + 1}: ${usedIdsSet.size} questions used globally, ${usedEpisodeGameIds.size} episodes excluded from last 365 days`)

            // Step 3: Get all episodes from configured seasons
            const allEpisodes: SeasonGame[] = []
            for (const season of configuredSeasons) {
                try {
                    const episodes = await getSeasonGames(season)
                    allEpisodes.push(...episodes)
                    console.log(`[Daily Challenge ${dateString}] Found ${episodes.length} episodes in season ${season}`)
                } catch (error: any) {
                    console.warn(`[Daily Challenge ${dateString}] Error fetching season ${season}:`, error.message)
                }
            }

            if (allEpisodes.length === 0) {
                console.error(`[Daily Challenge ${dateString}] No episodes found in configured seasons`)
                return null
            }

            // Step 4: Filter episodes:
            // - Not used in last 365 days (by gameId or airDate)
            // - Air date is at least minLookbackDays ago
            // - Air date is weekday (optional, but Jeopardy typically airs weekdays)
            const minDate = new Date(date)
            minDate.setDate(minDate.getDate() - minLookbackDays)
            minDate.setHours(0, 0, 0, 0)

            const eligibleEpisodes = allEpisodes.filter(episode => {
                const episodeDate = new Date(episode.airDate)
                episodeDate.setHours(0, 0, 0, 0)
                
                // Must be at least minLookbackDays ago
                if (episodeDate >= minDate) {
                    return false
                }
                
                // Must not be used in last 365 days (by gameId or airDate)
                if (usedEpisodeGameIds.has(episode.gameId)) {
                    return false
                }
                if (usedAirDates.has(episode.airDate)) {
                    return false
                }
                
                // Prefer weekdays (but don't exclude weekends entirely)
                return true
            })

            // Sort by airDate descending (more recent first, but still within range)
            eligibleEpisodes.sort((a, b) => b.airDate.localeCompare(a.airDate))

            if (eligibleEpisodes.length === 0) {
                console.error(`[Daily Challenge ${dateString}] No eligible episodes found after filtering`)
                return null
            }

            console.log(`[Daily Challenge ${dateString}] Found ${eligibleEpisodes.length} eligible episodes`)

            // Step 5: Deterministic selection of episode
            const seed = dateString.split('-').reduce((acc, val) => acc + parseInt(val), 0)
            const selectedEpisodeIndex = (seed + attempt) % eligibleEpisodes.length
            const selectedEpisode = eligibleEpisodes[selectedEpisodeIndex]

            console.log(`[Daily Challenge ${dateString}] Selected episode: gameId=${selectedEpisode.gameId}, airDate=${selectedEpisode.airDate}`)

            // Step 6: Check if we already have this game's Final Jeopardy question in database
            let finalQuestion = await prisma.question.findFirst({
                where: {
                    round: 'FINAL',
                    airDate: new Date(selectedEpisode.airDate),
                    episodeId: selectedEpisode.gameId
                },
                include: {
                    category: true
                }
            })

            // Step 7: If not in database, download only this specific game
            if (!finalQuestion) {
                console.log(`[Daily Challenge ${dateString}] Episode not in database, downloading game ${selectedEpisode.gameId}...`)
                
                const game = await parseGameById(selectedEpisode.gameId)
                if (!game || !game.questions || game.questions.length === 0) {
                    console.error(`[Daily Challenge ${dateString}] Failed to download game ${selectedEpisode.gameId}`)
                    attemptedEpisodeGameIds.add(selectedEpisode.gameId)
                    if (attempt < maxRetries - 1) {
                        continue
                    } else {
                        return null
                    }
                }

                // Save the game to database (all questions)
                const saveResult = await saveGameToDatabase(game, selectedEpisode.airDate)
                console.log(`[Daily Challenge ${dateString}] Saved game: ${saveResult.created} questions created, ${saveResult.skipped} skipped`)

                // Get the Final Jeopardy question we just saved
                finalQuestion = await prisma.question.findFirst({
                    where: {
                        round: 'FINAL',
                        airDate: new Date(selectedEpisode.airDate),
                        episodeId: selectedEpisode.gameId
                    },
                    include: {
                        category: true
                    }
                })

                if (!finalQuestion) {
                    console.error(`[Daily Challenge ${dateString}] No Final Jeopardy question found in downloaded game`)
                    attemptedEpisodeGameIds.add(selectedEpisode.gameId)
                    if (attempt < maxRetries - 1) {
                        continue
                    } else {
                        return null
                    }
                }
            }

            // Step 8: Verify question hasn't been used globally
            if (usedIdsSet.has(finalQuestion.id)) {
                console.warn(`[Daily Challenge ${dateString}] Selected question ${finalQuestion.id} is already used globally`)
                attemptedEpisodeGameIds.add(selectedEpisode.gameId)
                if (attempt < maxRetries - 1) {
                    continue
                } else {
                    return null
                }
            }

            // Step 9: Create challenge (DB unique constraints will prevent duplicates)
            const challenge = await prisma.dailyChallenge.create({
                data: {
                    date,
                    questionId: finalQuestion.id,
                    airDate: finalQuestion.airDate,
                    episodeGameId: selectedEpisode.gameId
                },
                include: {
                    question: {
                        include: {
                            category: true
                        }
                    }
                }
            })

            console.log(`[Daily Challenge ${dateString}] ✓ Created challenge: questionId=${finalQuestion.id}, episodeGameId=${selectedEpisode.gameId}, airDate=${selectedEpisode.airDate}`)
            return challenge

        } catch (error: any) {
            // Handle unique constraint violations (race conditions or duplicate questionId/episodeGameId)
            if (error.code === 'P2002') {
                const constraint = error.meta?.target
                const conflictingField = error.meta?.target?.[0]
                
                if (constraint?.includes('questionId') || conflictingField === 'questionId') {
                    // Question already used - try different episode
                    console.warn(`[Daily Challenge ${dateString}] Attempt ${attempt + 1} failed: questionId already used. Retrying with different episode...`)
                    if (attempt < maxRetries - 1) {
                        continue
                    } else {
                        return null
                    }
                } else if (constraint?.includes('date') || conflictingField === 'date') {
                    // Challenge already exists for this date - fetch and return it
                    console.log(`[Daily Challenge ${dateString}] Challenge already exists for this date`)
                    const existing = await prisma.dailyChallenge.findUnique({
                        where: { date },
                        include: {
                            question: {
                                include: {
                                    category: true
                                }
                            }
                        }
                    })
                    return existing
                }
            }
            
            // For other errors, log and retry
            console.error(`[Daily Challenge ${dateString}] Error on attempt ${attempt + 1}:`, error)
            if (attempt === maxRetries - 1) {
                return null
            }
        }
    }

    return null
}

/**
 * Save a game to the database (all questions)
 * Returns count of created and skipped questions
 */
async function saveGameToDatabase(game: any, airDate: string): Promise<{ created: number; skipped: number }> {
    let created = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
        for (const question of game.questions) {
            // Check if question already exists (by question text, air date, and round)
            const existing = await tx.question.findFirst({
                where: {
                    question: question.question,
                    airDate: new Date(airDate),
                    round: question.round || 'SINGLE'
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

            // Determine round
            let round: 'SINGLE' | 'DOUBLE' | 'FINAL' = 'SINGLE'
            if (question.round) {
                round = question.round as 'SINGLE' | 'DOUBLE' | 'FINAL'
            } else if (question.isFinalJeopardy) {
                round = 'FINAL'
            } else if (question.isDoubleJeopardy) {
                round = 'DOUBLE'
            }

            // Create question
            await tx.question.create({
                data: {
                    question: question.question,
                    answer: question.answer,
                    value: question.value,
                    difficulty: question.difficulty || 'MEDIUM',
                    knowledgeCategory: question.knowledgeCategory || 'GENERAL_KNOWLEDGE',
                    airDate: new Date(airDate),
                    episodeId: game.gameId,
                    round,
                    isDoubleJeopardy: round === 'DOUBLE',
                    wasTripleStumper: question.wasTripleStumper ?? false,
                    category: {
                        connect: { id: category.id }
                    }
                }
            })
            created++
        }
    })

    return { created, skipped }
}

/**
 * Helper function to backfill a game from J-Archive for a given date
 * Downloads the full game (all rounds) and saves all questions to database
 * Returns the number of Final Jeopardy questions added
 * Uses the same logic as the admin page fetch game feature
 */
async function backfillGameForDate(targetDate: Date): Promise<{ success: boolean; finalJeopardyAdded: number; error?: string }> {
    try {
        const dateStr = targetDate.toISOString().split('T')[0]
        console.log(`[Backfill] Fetching game for ${dateStr} from J-Archive...`)

        // Parse game from J-Archive (same as admin page)
        const game = await parseGameByDate(dateStr)

        if (!game || !game.questions || game.questions.length === 0) {
            return { success: false, finalJeopardyAdded: 0, error: `No game found for ${dateStr} in J-Archive` }
        }

        // Save game to database
        const result = await saveGameToDatabase(game, dateStr)
        const finalJeopardyCount = game.questions.filter((q: any) => q.round === 'FINAL' || q.isFinalJeopardy).length

        console.log(`[Backfill] Added ${result.created} questions (${finalJeopardyCount} Final Jeopardy) for ${dateStr} (skipped ${result.skipped} duplicates)`)
        return { success: true, finalJeopardyAdded: finalJeopardyCount }
    } catch (error: any) {
        console.error(`[Backfill] Error fetching game for ${targetDate.toISOString().split('T')[0]}:`, error.message)
        return { success: false, finalJeopardyAdded: 0, error: error.message }
    }
}

/**
 * Push game data to database (similar to admin API)
 */
async function pushGameToDatabase(game: any) {
    let created = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
        for (const question of game.questions) {
            // Check if question already exists
            const existing = await tx.question.findFirst({
                where: {
                    question: question.question,
                    airDate: game.airDate ? new Date(game.airDate) : null
                }
            })

            if (existing) {
                skipped++
                continue
            }

            // Create or update category
            const category = await tx.category.upsert({
                where: { name: question.category },
                update: {},
                create: { name: question.category }
            })

            // Determine round
            let round: 'SINGLE' | 'DOUBLE' | 'FINAL' = 'SINGLE'
            if (question.round) {
                round = question.round as 'SINGLE' | 'DOUBLE' | 'FINAL'
            } else if (question.isFinalJeopardy) {
                round = 'FINAL'
            } else if (question.isDoubleJeopardy) {
                round = 'DOUBLE'
            }

            // Create question
            await tx.question.create({
                data: {
                    question: question.question,
                    answer: question.answer,
                    value: question.value,
                    categoryId: category.id,
                    difficulty: question.difficulty || 'MEDIUM',
                    airDate: game.airDate ? new Date(game.airDate) : null,
                    season: game.season,
                    episodeId: game.episodeId || game.gameId,
                    knowledgeCategory: question.knowledgeCategory || 'GENERAL_KNOWLEDGE',
                    round,
                    isDoubleJeopardy: round === 'DOUBLE',
                    wasTripleStumper: question.wasTripleStumper ?? false
                }
            })
            created++
        }
    })

    return { created, skipped }
}

