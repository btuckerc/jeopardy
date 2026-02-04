import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import type { Prisma } from '@prisma/client'
import {
    getGameSpoilerPolicy,
    computeUserEffectiveCutoff,
    buildSimpleAirDateCondition,
    type SpoilerPolicy
} from '@/lib/spoiler-utils'
import {
    getBoardCacheKey,
    getCachedBoard,
    setCachedBoard,
    type CachedCategory
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

type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

// Simple seeded random number generator for deterministic selection
function seededRandom(seed: string): () => number {
    let hash = seed.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
    }, 0)
    return () => {
        hash = Math.abs(Math.sin(hash + 1) * 10000)
        return hash % 1
    }
}

// Seeded shuffle using Fisher-Yates
function seededShuffle(array: string[], random: () => number): string[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

/**
 * Select categories for challenge mode with triple stumper prioritization
 * Priority: 3+ unanswered triple stumpers → 2+ → 1+ → random
 */
async function selectChallengeCategories(
    eligibleCategoryIds: string[],
    userId: string,
    round: 'SINGLE' | 'DOUBLE',
    seed: string | null
): Promise<string[]> {
    // Handle edge case: no eligible categories
    if (eligibleCategoryIds.length === 0) {
        console.log('[selectChallengeCategories] No eligible categories provided')
        return []
    }
    
    if (eligibleCategoryIds.length <= 5) {
        return eligibleCategoryIds
    }

    // Get triple stumper counts per category with user's answered status
    // Join through Game table to get userId since GameQuestion doesn't have userId directly
    const categoryStats = await prisma.$queryRaw<Array<{
        categoryId: string
        totalTripleStumpers: bigint
        answeredCount: bigint
    }>>`
        SELECT 
            q."categoryId",
            COUNT(*) as "totalTripleStumpers",
            COUNT(CASE WHEN gq."answered" = true AND g."userId" = ${userId} THEN 1 END) as "answeredCount"
        FROM "Question" q
        LEFT JOIN "GameQuestion" gq ON q."id" = gq."questionId"
        LEFT JOIN "Game" g ON gq."gameId" = g."id" AND g."userId" = ${userId}
        WHERE q."categoryId" = ANY(${eligibleCategoryIds}::text[])
            AND q."round" = ${round}::"JeopardyRound"
            AND q."wasTripleStumper" = true
        GROUP BY q."categoryId"
    `

    // Calculate unanswered counts and group by priority
    const categoriesWithStats = categoryStats.map(stat => ({
        categoryId: stat.categoryId,
        total: Number(stat.totalTripleStumpers),
        answered: Number(stat.answeredCount),
        unanswered: Number(stat.totalTripleStumpers) - Number(stat.answeredCount)
    }))

    // Priority tiers
    const threePlus = categoriesWithStats.filter(c => c.unanswered >= 3).map(c => c.categoryId)
    const twoPlus = categoriesWithStats.filter(c => c.unanswered === 2).map(c => c.categoryId)
    const onePlus = categoriesWithStats.filter(c => c.unanswered === 1).map(c => c.categoryId)
    const anyTripleStumper = categoriesWithStats.filter(c => c.total > 0).map(c => c.categoryId)

    // Shuffle each tier
    const shuffle = (arr: string[]) => seed 
        ? seededShuffle(arr, seededRandom(seed + round))
        : arr.sort(() => Math.random() - 0.5)

    const shuffledThreePlus = shuffle(threePlus)
    const shuffledTwoPlus = shuffle(twoPlus)
    const shuffledOnePlus = shuffle(onePlus)
    const shuffledAny = shuffle(anyTripleStumper)

    // Combine in priority order
    let selected = [...shuffledThreePlus, ...shuffledTwoPlus, ...shuffledOnePlus, ...shuffledAny]
    
    // Remove duplicates and limit to 5
    selected = [...new Set(selected)].slice(0, 5)

    return selected
}

/**
 * GET /api/categories/game
 * 
 * Returns categories and questions for a game board.
 * OPTIMIZED: Uses question-driven eligibility to avoid loading all categories/questions.
 * 
 * Query parameters:
 * - gameId: (optional) If provided, uses the game's stored spoiler policy
 * - mode: 'random' | 'knowledge' | 'custom' | 'date'
 * - round: 'SINGLE' | 'DOUBLE'
 * - isDouble: (legacy) boolean for backward compatibility
 * - seed: (optional) for consistent category ordering
 * - categories: (for knowledge mode) comma-separated knowledge category names
 * - categoryIds: (for custom mode) comma-separated category IDs
 * - date: (for date mode) ISO date string
 * - categoryFilter: 'TRIPLE_STUMPER' for challenge mode
 */
export const GET = withInstrumentation(async (request: NextRequest) => {
    const timer = createTimer('/api/categories/game')
    try {
        const searchParams = request.nextUrl.searchParams
        const gameId = searchParams.get('gameId')
        const mode = searchParams.get('mode')
        const isDouble = searchParams.get('isDouble') === 'true' // Legacy support
        const roundParam = searchParams.get('round') as 'SINGLE' | 'DOUBLE' | 'FINAL' | null
        // Determine round: prefer round param, fall back to isDouble for backward compatibility
        const round: 'SINGLE' | 'DOUBLE' = roundParam === 'DOUBLE' ? 'DOUBLE' : 
                                          roundParam === 'SINGLE' ? 'SINGLE' :
                                          isDouble ? 'DOUBLE' : 'SINGLE'
        
        // Optional seed for consistent ordering
        const seed = searchParams.get('seed')
        const date = searchParams.get('date')
        const categories = searchParams.get('categories')
        const categoryIds = searchParams.get('categoryIds')
        const categoryFilter = searchParams.get('categoryFilter')

        // Check cache first for deterministic requests
        const cacheKey = getBoardCacheKey({ gameId, seed, round, mode, date, categories, categoryIds })
        if (cacheKey) {
            const cached = getCachedBoard(cacheKey)
            if (cached) {
                timer.mark('cacheHit')
                timer.log()
                return jsonResponse(cached)
            }
        }
        timer.mark('cacheMiss')

        const appUser = await getAppUser()
        timer.mark('auth')
        const userId = appUser?.id

        // Determine the effective spoiler policy
        let spoilerPolicy: SpoilerPolicy

        if (gameId) {
            spoilerPolicy = await getGameSpoilerPolicy(gameId)
        } else if (userId) {
            spoilerPolicy = await computeUserEffectiveCutoff(userId)
        } else {
            spoilerPolicy = { enabled: false, cutoffDate: null }
        }
        timer.mark('spoilerPolicy')

        // Build the airDate condition from the spoiler policy
        const airDateCondition = buildSimpleAirDateCondition(spoilerPolicy)

        // Build question filter based on mode
        const questionWhere: Prisma.QuestionWhereInput = {
            round: round,
            ...(airDateCondition ? { airDate: airDateCondition } : {})
        }

        // Add mode-specific filters
        switch (mode) {
            case 'knowledge': {
                const knowledgeCategories = categories?.split(',') || []
                if (knowledgeCategories.length > 0) {
                    questionWhere.knowledgeCategory = { in: knowledgeCategories as KnowledgeCategory[] }
                }
                break
            }
            case 'custom': {
                const customCategoryIds = categoryIds?.split(',') || []
                if (customCategoryIds.length > 0) {
                    questionWhere.categoryId = { in: customCategoryIds }
                }
                break
            }
            case 'date': {
                if (date) {
                    questionWhere.airDate = new Date(date)
                }
                break
            }
        }

        // Add triple stumper filter for challenge mode
        if (categoryFilter === 'TRIPLE_STUMPER') {
            questionWhere.wasTripleStumper = true
        }

        // OPTIMIZED: Use groupBy to get category IDs with question counts
        // This avoids loading all questions - just aggregates counts per category
        let categoryStats = await prisma.question.groupBy({
            by: ['categoryId'],
            where: questionWhere,
            _count: { id: true }
        })
        timer.mark(`groupByCategories(${categoryStats.length})`)

        // Filter to categories with at least 1 question
        const tripleStumperCategoryIds = categoryStats
            .filter(c => c._count.id > 0)
            .map(c => c.categoryId)
        
        let eligibleCategoryIds = [...tripleStumperCategoryIds]
        let fallbackCategoryIds: string[] = []

        // For challenge mode: if we don't have enough triple stumper categories, 
        // fall back to regular categories
        if (categoryFilter === 'TRIPLE_STUMPER' && eligibleCategoryIds.length < 5) {
            console.log(`[Challenge Mode] Only ${eligibleCategoryIds.length} triple stumper categories found, falling back to regular categories`)
            
            // Query for regular categories without the triple stumper filter
            const fallbackWhere: Prisma.QuestionWhereInput = {
                round: round,
                ...(airDateCondition ? { airDate: airDateCondition } : {})
            }
            
            const fallbackStats = await prisma.question.groupBy({
                by: ['categoryId'],
                where: fallbackWhere,
                _count: { id: true }
            })
            
            // Get regular category IDs (excluding ones we already have)
            const existingIds = new Set(eligibleCategoryIds)
            fallbackCategoryIds = fallbackStats
                .filter(c => c._count.id > 0 && !existingIds.has(c.categoryId))
                .map(c => c.categoryId)
            
            // Add fallback categories to fill up to at least 5
            const needed = 5 - eligibleCategoryIds.length
            const addedFallbackIds = fallbackCategoryIds.slice(0, needed)
            eligibleCategoryIds = [
                ...eligibleCategoryIds,
                ...addedFallbackIds
            ]
            
            console.log(`[Challenge Mode] Added ${addedFallbackIds.length} regular categories, total: ${eligibleCategoryIds.length}`)
        }

        if (eligibleCategoryIds.length === 0) {
            timer.log()
            if (spoilerPolicy.enabled && spoilerPolicy.cutoffDate) {
                const cutoffStr = spoilerPolicy.cutoffDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                return notFoundResponse(
                    `No eligible categories found. Your spoiler protection blocks questions from ${cutoffStr} and later. ` +
                    `Try selecting an earlier episode date or adjusting your spoiler settings.`
                )
            }
            return notFoundResponse('No eligible categories found')
        }

        // Select categories based on mode
        let selectedCategoryIds: string[]
        
        if (mode === 'custom') {
            // Custom mode: use all specified categories in the order they were provided
            const requestedIds = categoryIds?.split(',') || []
            selectedCategoryIds = requestedIds.filter(id => eligibleCategoryIds.includes(id))
        } else if (mode === 'date') {
            // Date mode: use all categories from that episode (will be filtered by date)
            selectedCategoryIds = eligibleCategoryIds
        } else if (categoryFilter === 'TRIPLE_STUMPER' && userId) {
            // Challenge mode: Prioritize categories with more triple stumpers that user hasn't answered
            selectedCategoryIds = await selectChallengeCategories(eligibleCategoryIds, userId, round, seed)
            
            // If selectChallengeCategories returns empty, fall back to regular category selection
            if (selectedCategoryIds.length === 0) {
                console.log('[Challenge Mode] selectChallengeCategories returned empty, using fallback selection')
                if (eligibleCategoryIds.length <= 5) {
                    selectedCategoryIds = eligibleCategoryIds
                } else {
                    selectedCategoryIds = seed 
                        ? seededShuffle(eligibleCategoryIds, seededRandom(seed + round)).slice(0, 5)
                        : eligibleCategoryIds.sort(() => Math.random() - 0.5).slice(0, 5)
                }
            }
        } else if (eligibleCategoryIds.length <= 5) {
            // If we have 5 or fewer, use all of them
            selectedCategoryIds = eligibleCategoryIds
        } else {
            // Random/knowledge mode: select 5 deterministically or randomly
            if (seed) {
                const random = seededRandom(seed + round) // Include round for different boards per round
                selectedCategoryIds = seededShuffle(eligibleCategoryIds, random).slice(0, 5)
            } else {
                // Random selection
                selectedCategoryIds = eligibleCategoryIds
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 5)
            }
        }
        timer.mark(`selectCategories(${selectedCategoryIds.length})`)

        // Fetch category names for selected categories
        const categoryNames = await prisma.category.findMany({
            where: { id: { in: selectedCategoryIds } },
            select: { id: true, name: true }
        })
        const categoryNameMap = new Map(categoryNames.map(c => [c.id, c.name]))
        timer.mark('fetchCategoryNames')

        // Define the category type for strong typing
        type CategoryWithQuestions = {
            id: string
            name: string
            questions: {
                id: string
                question: string
                answer: string
                value: number
                isDoubleJeopardy: boolean
                wasTripleStumper: boolean
                categoryId: string
            }[]
        }

        // OPTIMIZED: Fetch questions only for selected categories
        // For each category, prefer questions from the same episode (airDate)
        const categoriesWithQuestions: CategoryWithQuestions[] = await Promise.all(
            selectedCategoryIds.map(async (categoryId): Promise<CategoryWithQuestions> => {
                const categoryName = categoryNameMap.get(categoryId) || 'Unknown'
                
                // Check if this is a fallback category (not in the original triple stumper list)
                // Use tripleStumperCategoryIds to determine if it's a true triple stumper category
                const isTripleStumperCategory = tripleStumperCategoryIds.includes(categoryId)
                
                // For fallback categories (not in tripleStumperCategoryIds), don't apply the triple stumper filter
                const categoryQuestionWhere = !isTripleStumperCategory
                    ? { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}) }
                    : questionWhere
                
                // For date mode, questions are already filtered by date
                if (mode === 'date') {
                    const questions = await prisma.question.findMany({
                        where: {
                            categoryId,
                            ...categoryQuestionWhere
                        },
                        orderBy: { value: 'asc' },
                        take: 5,
                        select: {
                            id: true,
                            question: true,
                            answer: true,
                            value: true,
                            isDoubleJeopardy: true,
                            wasTripleStumper: true,
                            categoryId: true
                        }
                    })
                    return { id: categoryId, name: categoryName, questions }
                }

                // For other modes: find an episode date that has 5 questions for this category
                // First, group questions by airDate and find the best date
                const dateGroups = await prisma.question.groupBy({
                    by: ['airDate'],
                    where: {
                        categoryId,
                        ...categoryQuestionWhere,
                        airDate: { not: null }
                    },
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } }
                })

                // Pick the date with 5 questions, or the date with most questions
                const bestDate = dateGroups.find(d => d._count.id >= 5)?.airDate 
                    || dateGroups[0]?.airDate

                // Fetch questions from that date (or all questions if no good date found)
                const questions = await prisma.question.findMany({
                    where: {
                        categoryId,
                        ...categoryQuestionWhere,
                        ...(bestDate ? { airDate: bestDate } : {})
                    },
                    orderBy: { value: 'asc' },
                    take: 5,
                    select: {
                        id: true,
                        question: true,
                        answer: true,
                        value: true,
                        isDoubleJeopardy: true,
                        wasTripleStumper: true,
                        categoryId: true
                    }
                })

                return { id: categoryId, name: categoryName, questions }
            })
        )
        timer.mark('fetchQuestions')

        // Sort categories by name for consistency (except custom mode preserves order)
        const sortedCategories = mode === 'custom' 
            ? categoriesWithQuestions 
            : categoriesWithQuestions.sort((a, b) => a.name.localeCompare(b.name))

        // Check that we have at least 3 total clues across all categories
        const totalQuestions = sortedCategories.reduce((sum, cat) => sum + cat.questions.length, 0)
        if (totalQuestions < 3) {
            timer.log()
            if (spoilerPolicy.enabled && spoilerPolicy.cutoffDate) {
                const cutoffStr = spoilerPolicy.cutoffDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                return notFoundResponse(
                    `Not enough questions available under your spoiler protection settings (blocking ${cutoffStr} and later). ` +
                    `Found ${totalQuestions} questions across ${sortedCategories.length} categories, but need at least 3. ` +
                    `Try selecting an earlier episode date or adjusting your spoiler settings.`
                )
            }
            return notFoundResponse(
                `Not enough questions available. Found ${totalQuestions} questions across ${sortedCategories.length} categories, but need at least 3 total questions.`
            )
        }

        // Cache the result for future requests
        if (cacheKey) {
            setCachedBoard(cacheKey, sortedCategories as CachedCategory[])
        }

        timer.mark('done')
        timer.log()
        return jsonResponse(sortedCategories)
    } catch (error) {
        timer.mark('error')
        timer.log()
        console.error('[Categories API] Error loading categories:', error)
        // Log additional context for debugging
        if (error instanceof Error) {
            console.error('[Categories API] Error stack:', error.stack)
        }
        return serverErrorResponse('Failed to load categories', error)
    }
})
