import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'
import type { Category, Prisma } from '@prisma/client'
import {
    getGameSpoilerPolicy,
    computeUserEffectiveCutoff,
    buildSimpleAirDateCondition,
    type SpoilerPolicy
} from '@/lib/spoiler-utils'

export const dynamic = 'force-dynamic'

type KnowledgeCategory =
    | 'GEOGRAPHY_AND_HISTORY'
    | 'ENTERTAINMENT'
    | 'ARTS_AND_LITERATURE'
    | 'SCIENCE_AND_NATURE'
    | 'SPORTS_AND_LEISURE'
    | 'GENERAL_KNOWLEDGE'

type CategoryWithQuestions = Category & {
    _count: {
        questions: number
    }
    questions: {
        airDate: Date | null
    }[]
}

/**
 * GET /api/categories/game
 * 
 * Returns categories and questions for a game board.
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
 */
export async function GET(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        const userId = appUser?.id

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

        // Determine the effective spoiler policy
        // Priority:
        // 1. If gameId is provided, use the game's stored/computed policy
        // 2. Otherwise, compute from the current user's profile
        let spoilerPolicy: SpoilerPolicy

        if (gameId) {
            // Use the game's spoiler policy for consistent board generation
            spoilerPolicy = await getGameSpoilerPolicy(gameId)
        } else if (userId) {
            // Fall back to the current user's profile settings
            spoilerPolicy = await computeUserEffectiveCutoff(userId)
        } else {
            // No user, no game - no spoiler protection
            spoilerPolicy = { enabled: false, cutoffDate: null }
        }

        // Build the airDate condition from the spoiler policy
        const airDateCondition = buildSimpleAirDateCondition(spoilerPolicy)

        // Base query - use round field to get questions from the correct round
        const baseWhere: Prisma.CategoryWhereInput = {
            questions: {
                some: {
                    round: round,
                    ...(airDateCondition ? { airDate: airDateCondition } : {})
                }
            }
        }

        // Add mode-specific filters
        let whereClause: Prisma.CategoryWhereInput = { ...baseWhere }

        switch (mode) {
            case 'knowledge': {
                const categories = searchParams.get('categories')?.split(',') || []
                if (categories.length > 0) {
                    whereClause = {
                        AND: [
                            baseWhere,
                            {
                                questions: {
                                    some: {
                                        knowledgeCategory: {
                                            in: categories as KnowledgeCategory[]
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
                break
            }

            case 'custom': {
                const categoryIds = searchParams.get('categoryIds')?.split(',') || []
                if (categoryIds.length > 0) {
                    whereClause = {
                        AND: [
                            baseWhere,
                            { id: { in: categoryIds } }
                        ]
                    }
                }
                break
            }

            case 'date': {
                const date = searchParams.get('date')
                if (date) {
                    // For date mode, we want categories that have questions from this specific episode
                    // AND from the correct round
                    // Note: Date mode typically means we want exactly that episode's questions,
                    // but we still respect the spoiler policy (which may block newer episodes)
                    whereClause = {
                        questions: {
                            some: {
                                airDate: new Date(date),
                                round: round
                            }
                        }
                    }
                }
                break
            }
        }

        // Build the question filter for counting and fetching
        const questionWhereBase: Prisma.QuestionWhereInput = {
            round: round,
            ...(mode === 'date' && searchParams.get('date') ? {
                airDate: new Date(searchParams.get('date')!)
            } : {}),
            ...(airDateCondition ? { airDate: airDateCondition } : {})
        }

        // Get categories with their question counts
        const categoriesWithCounts = await prisma.category.findMany({
            where: whereClause,
            include: {
                questions: {
                    where: questionWhereBase,
                    select: {
                        airDate: true
                    }
                },
                _count: {
                    select: {
                        questions: {
                            where: questionWhereBase
                        }
                    }
                }
            }
        }) as unknown as CategoryWithQuestions[]

        // Filter to categories that have at least 1 question
        const eligibleCategories = categoriesWithCounts.filter((category: CategoryWithQuestions) => {
            return category._count.questions > 0
        })

        if (eligibleCategories.length === 0) {
            // Provide a more specific error message when spoiler protection is active
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
        let selectedCategories: CategoryWithQuestions[]
        
        if (mode === 'custom') {
            // Custom mode: use all specified categories in the order they were provided
            const categoryIds = searchParams.get('categoryIds')?.split(',') || []
            selectedCategories = categoryIds
                .map(id => eligibleCategories.find(c => c.id === id))
                .filter((c): c is CategoryWithQuestions => c !== undefined)
        } else if (mode === 'date') {
            // Date mode: use all categories from that episode, sorted by name for consistency
            selectedCategories = eligibleCategories
                .sort((a, b) => a.name.localeCompare(b.name))
        } else if (eligibleCategories.length <= 5) {
            // If we have 5 or fewer, use all of them sorted by name
            selectedCategories = eligibleCategories
                .sort((a, b) => a.name.localeCompare(b.name))
        } else {
            // Random/knowledge mode with more than 5 categories: select 5
            // Use seed for consistent ordering if provided, otherwise random
            if (seed) {
                // Simple seeded shuffle using the seed string
                const seededRandom = (s: string, i: number) => {
                    const hash = s.split('').reduce((a, b) => {
                        a = ((a << 5) - a) + b.charCodeAt(0)
                        return a & a
                    }, 0)
                    return Math.abs(Math.sin(hash + i) * 10000) % 1
                }
                selectedCategories = eligibleCategories
                    .map((cat, i) => ({ cat, sort: seededRandom(seed, i) }))
                    .sort((a, b) => a.sort - b.sort)
                    .slice(0, 5)
                    .map(x => x.cat)
            } else {
                // Random selection
                selectedCategories = eligibleCategories
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 5)
            }
        }

        // Get questions for each category
        const categoriesWithQuestions = await Promise.all(
            selectedCategories.map(async (category: CategoryWithQuestions) => {
                const questions = await prisma.question.findMany({
                    where: {
                        categoryId: category.id,
                        round: round,
                        ...(mode === 'date' && searchParams.get('date') ? {
                            airDate: new Date(searchParams.get('date')!)
                        } : {}),
                        ...(airDateCondition ? { airDate: airDateCondition } : {})
                    },
                    orderBy: [
                        { value: 'asc' }
                    ],
                    select: {
                        id: true,
                        question: true,
                        answer: true,
                        value: true,
                        isDoubleJeopardy: true,
                        wasTripleStumper: true,
                        airDate: true,
                        categoryId: true
                    }
                })

                // For date mode, use the questions directly (they're already filtered by date and round)
                // For other modes, try to group by airdate to prefer questions from the same episode
                let selectedQuestions: typeof questions = []
                
                if (mode === 'date') {
                    // Date mode: use all questions from this date/round, sorted by value
                    selectedQuestions = questions.sort((a, b) => a.value - b.value).slice(0, 5)
                } else {
                    // Group questions by airdate to prefer questions from the same episode
                    const questionsByDate = questions.reduce((acc: Record<string, typeof questions>, q) => {
                        const date = q.airDate?.toISOString().split('T')[0] ?? 'unknown'
                        if (!acc[date]) acc[date] = []
                        acc[date].push(q)
                        return acc
                    }, {})

                    // Prefer a date with 5 questions, but fall back to the date with the most questions
                    const dateWithFive = Object.entries(questionsByDate)
                        .find(([_, qs]) => qs.length === 5)?.[0]
                    
                    if (dateWithFive) {
                        selectedQuestions = questionsByDate[dateWithFive]
                    } else {
                        // Find the date with the most questions, up to 5
                        const sortedDates = Object.entries(questionsByDate)
                            .sort(([_, a], [__, b]) => b.length - a.length)
                        
                        if (sortedDates.length > 0) {
                            selectedQuestions = sortedDates[0][1]
                        } else {
                            selectedQuestions = questions
                        }
                    }
                }

                // Take up to 5 questions, sorted by value
                const finalQuestions = selectedQuestions
                    .sort((a, b) => a.value - b.value)
                    .slice(0, 5)
                    .map(({ airDate, ...q }) => q)

                return {
                    id: category.id,
                    name: category.name,
                    questions: finalQuestions
                }
            })
        )

        // Check that we have at least 3 total clues across all categories
        const totalQuestions = categoriesWithQuestions.reduce((sum, cat) => sum + cat.questions.length, 0)
        if (totalQuestions < 3) {
            // Provide a more specific error message when spoiler protection is active
            if (spoilerPolicy.enabled && spoilerPolicy.cutoffDate) {
                const cutoffStr = spoilerPolicy.cutoffDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                return notFoundResponse(
                    `Not enough questions available under your spoiler protection settings (blocking ${cutoffStr} and later). ` +
                    `Found ${totalQuestions} questions across ${categoriesWithQuestions.length} categories, but need at least 3. ` +
                    `Try selecting an earlier episode date or adjusting your spoiler settings.`
                )
            }
            return notFoundResponse(
                `Not enough questions available. Found ${totalQuestions} questions across ${categoriesWithQuestions.length} categories, but need at least 3 total questions.`
            )
        }

        return jsonResponse(categoriesWithQuestions)
    } catch (error) {
        return serverErrorResponse('Failed to load categories', error)
    }
}
