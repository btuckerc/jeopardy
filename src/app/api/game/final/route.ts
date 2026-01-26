import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, notFoundResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import type { Prisma } from '@prisma/client'
import {
    getGameSpoilerPolicy,
    computeUserEffectiveCutoff,
    buildSimpleAirDateCondition,
    wouldViolateSpoilerPolicy,
    type SpoilerPolicy
} from '@/lib/spoiler-utils'
import {
    getFinalJeopardyCacheKey,
    getCachedFinalJeopardy,
    setCachedFinalJeopardy,
    type CachedFinalJeopardy
} from '@/lib/game-cache'

export const dynamic = 'force-dynamic'

// Step-level timing helper for performance analysis
function createTimer(label: string) {
    const times: { step: string; ms: number }[] = []
    let lastTime = performance.now()
    return {
        mark(step: string) {
            const now = performance.now()
            times.push({ step, ms: Math.round(now - lastTime) })
            lastTime = now
        },
        log() {
            const total = times.reduce((sum, t) => sum + t.ms, 0)
            console.log(`[PERF] ${label}: ${total}ms total`, times.map(t => `${t.step}=${t.ms}ms`).join(', '))
        }
    }
}

// Deterministic hash from seed string to number
function hashSeed(seed: string): number {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
}

type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

/**
 * GET /api/game/final
 * 
 * Returns a Final Jeopardy question for a game.
 * OPTIMIZED: Uses count + skip for O(1) selection instead of loading all questions.
 * 
 * Query parameters:
 * - gameId: (optional) If provided, uses the game's stored spoiler policy + seed for determinism
 * - questionId: (optional) For fetching a specific question (resume)
 * - mode: 'random' | 'knowledge' | 'custom' | 'date'
 * - finalCategoryMode: 'shuffle' | 'byDate' | 'specificCategory'
 * - finalCategoryId: (for specificCategory mode) category ID
 * - categories: (for knowledge mode) comma-separated knowledge category names
 * - categoryIds: (for custom mode) comma-separated category IDs
 * - date: (for date mode or byDate finalCategoryMode) ISO date string
 */
export const GET = withInstrumentation(async (request: NextRequest) => {
    const timer = createTimer('/api/game/final')
    try {
        const searchParams = request.nextUrl.searchParams
        const gameId = searchParams.get('gameId')
        const mode = searchParams.get('mode')
        const finalCategoryMode = searchParams.get('finalCategoryMode') || 'shuffle'
        const date = searchParams.get('date')
        const finalCategoryId = searchParams.get('finalCategoryId')
        const questionId = searchParams.get('questionId') // For fetching a specific question (resume)

        // For specific questionId lookups, don't cache (used for resume)
        // For new FJ selection with deterministic params, check cache
        if (!questionId) {
            const cacheKey = getFinalJeopardyCacheKey({ 
                gameId, 
                seed: null, // Will use gameId's seed internally
                mode, 
                date, 
                finalCategoryMode, 
                finalCategoryId 
            })
            if (cacheKey) {
                const cached = getCachedFinalJeopardy(cacheKey)
                if (cached) {
                    timer.mark('cacheHit')
                    timer.log()
                    return jsonResponse(cached)
                }
            }
            timer.mark('cacheMiss')
        }

        const appUser = await getAppUser()
        timer.mark('auth')
        const userId = appUser?.id

        // Determine the effective spoiler policy
        let spoilerPolicy: SpoilerPolicy
        let gameSeed: string | null = null

        if (gameId) {
            // Use the game's spoiler policy for consistent board generation
            spoilerPolicy = await getGameSpoilerPolicy(gameId)
            // Also fetch the game's seed for deterministic selection
            const game = await prisma.game.findUnique({
                where: { id: gameId },
                select: { seed: true }
            })
            gameSeed = game?.seed ?? null
        } else if (userId) {
            // Fall back to the current user's profile settings
            spoilerPolicy = await computeUserEffectiveCutoff(userId)
        } else {
            // No user, no game - no spoiler protection
            spoilerPolicy = { enabled: false, cutoffDate: null }
        }
        timer.mark('spoilerPolicy')

        // If a specific question ID is provided, fetch that question directly
        if (questionId) {
            const question = await prisma.question.findUnique({
                where: { id: questionId },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            })
            timer.mark('findUniqueQuestion')

            if (!question) {
                timer.log()
                return notFoundResponse('Final Jeopardy question not found')
            }

            // When resuming, verify the stored question is still compatible with the spoiler policy
            if (wouldViolateSpoilerPolicy(question.airDate, spoilerPolicy)) {
                const cutoffStr = spoilerPolicy.cutoffDate?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                timer.log()
                return badRequestResponse(
                    `This Final Jeopardy question is from an episode that would violate the game's spoiler protection ` +
                    `(blocking ${cutoffStr} and later). The game cannot be resumed with current settings.`
                )
            }

            timer.mark('done')
            timer.log()
            return jsonResponse({
                id: question.id,
                question: question.question,
                answer: question.answer,
                category: {
                    id: question.category.id,
                    name: question.category.name
                }
            })
        }

        // Build the airDate condition from the spoiler policy
        const airDateCondition = buildSimpleAirDateCondition(spoilerPolicy)

        // Base where clause for Final Jeopardy questions
        let whereClause: Prisma.QuestionWhereInput = {
            round: 'FINAL',
            ...(airDateCondition ? { airDate: airDateCondition } : {})
        }

        // Apply mode-specific filters
        switch (mode) {
            case 'knowledge': {
                const categories = searchParams.get('categories')?.split(',') || []
                if (categories.length > 0) {
                    whereClause = {
                        ...whereClause,
                        knowledgeCategory: {
                            in: categories as KnowledgeCategory[]
                        }
                    }
                }
                break
            }

            case 'custom': {
                const categoryIds = searchParams.get('categoryIds')?.split(',') || []
                if (categoryIds.length > 0) {
                    whereClause = {
                        ...whereClause,
                        categoryId: {
                            in: categoryIds
                        }
                    }
                }
                break
            }

            case 'date': {
                if (date) {
                    // For date mode, we want the Final Jeopardy from that specific episode
                    whereClause = {
                        round: 'FINAL',
                        airDate: new Date(date)
                    }
                }
                break
            }
        }

        // Handle Final Jeopardy category selection mode
        if (finalCategoryMode === 'specificCategory' && finalCategoryId) {
            whereClause = {
                ...whereClause,
                categoryId: finalCategoryId
            }
        } else if (finalCategoryMode === 'byDate' && date) {
            // For byDate mode, override to get the exact episode's Final Jeopardy
            whereClause = {
                round: 'FINAL',
                airDate: new Date(date)
            }
        }

        // OPTIMIZED: Use count + deterministic skip instead of loading all questions
        const totalCount = await prisma.question.count({ where: whereClause })
        timer.mark(`countQuestions(${totalCount})`)

        if (totalCount === 0) {
            timer.log()
            if (spoilerPolicy.enabled && spoilerPolicy.cutoffDate) {
                const cutoffStr = spoilerPolicy.cutoffDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                return notFoundResponse(
                    `No Final Jeopardy questions found matching the criteria. Your spoiler protection blocks questions from ${cutoffStr} and later. ` +
                    `Try selecting an earlier episode date or adjusting your spoiler settings.`
                )
            }
            return notFoundResponse('No Final Jeopardy questions found matching the criteria')
        }

        // Determine skip index - deterministic if we have a game seed, random otherwise
        let skipIndex: number
        if (gameSeed) {
            // Use game seed + 'FINAL' to get deterministic but unique selection for FJ
            skipIndex = hashSeed(gameSeed + 'FINAL') % totalCount
        } else {
            skipIndex = Math.floor(Math.random() * totalCount)
        }

        // Fetch just the one question using skip
        const selectedQuestion = await prisma.question.findFirst({
            where: whereClause,
            orderBy: { id: 'asc' }, // Stable ordering for deterministic skip
            skip: skipIndex,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        })
        timer.mark('fetchSingleQuestion')

        if (!selectedQuestion) {
            timer.log()
            return notFoundResponse('Failed to select Final Jeopardy question')
        }

        const result: CachedFinalJeopardy = {
            id: selectedQuestion.id,
            question: selectedQuestion.question,
            answer: selectedQuestion.answer,
            category: {
                id: selectedQuestion.category.id,
                name: selectedQuestion.category.name
            }
        }

        // Cache the result for future requests
        const cacheKey = getFinalJeopardyCacheKey({ 
            gameId, 
            seed: gameSeed, 
            mode, 
            date, 
            finalCategoryMode, 
            finalCategoryId 
        })
        if (cacheKey) {
            setCachedFinalJeopardy(cacheKey, result)
        }

        timer.mark('done')
        timer.log()
        return jsonResponse(result)
    } catch (error) {
        timer.mark('error')
        timer.log()
        return serverErrorResponse('Failed to load Final Jeopardy', error)
    }
})
