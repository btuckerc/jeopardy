import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, notFoundResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'
import type { Prisma } from '@prisma/client'
import {
    getGameSpoilerPolicy,
    computeUserEffectiveCutoff,
    buildSimpleAirDateCondition,
    wouldViolateSpoilerPolicy,
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

/**
 * GET /api/game/final
 * 
 * Returns a Final Jeopardy question for a game.
 * 
 * Query parameters:
 * - gameId: (optional) If provided, uses the game's stored spoiler policy
 * - questionId: (optional) For fetching a specific question (resume)
 * - mode: 'random' | 'knowledge' | 'custom' | 'date'
 * - finalCategoryMode: 'shuffle' | 'byDate' | 'specificCategory'
 * - finalCategoryId: (for specificCategory mode) category ID
 * - categories: (for knowledge mode) comma-separated knowledge category names
 * - categoryIds: (for custom mode) comma-separated category IDs
 * - date: (for date mode or byDate finalCategoryMode) ISO date string
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        const userId = session?.user?.id

        const searchParams = request.nextUrl.searchParams
        const gameId = searchParams.get('gameId')
        const mode = searchParams.get('mode')
        const finalCategoryMode = searchParams.get('finalCategoryMode') || 'shuffle'
        const date = searchParams.get('date')
        const finalCategoryId = searchParams.get('finalCategoryId')
        const questionId = searchParams.get('questionId') // For fetching a specific question (resume)

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

            if (!question) {
                return notFoundResponse('Final Jeopardy question not found')
            }

            // When resuming, verify the stored question is still compatible with the spoiler policy
            // This handles edge cases where a game was created before spoiler settings were tightened
            if (wouldViolateSpoilerPolicy(question.airDate, spoilerPolicy)) {
                const cutoffStr = spoilerPolicy.cutoffDate?.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                return badRequestResponse(
                    `This Final Jeopardy question is from an episode that would violate the game's spoiler protection ` +
                    `(blocking ${cutoffStr} and later). The game cannot be resumed with current settings.`
                )
            }

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
                    // Override the airDate condition to match exactly
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
        // 'shuffle' mode uses the existing whereClause as-is

        // Get Final Jeopardy questions matching the criteria
        const questions = await prisma.question.findMany({
            where: whereClause,
            include: {
                category: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: [
                { airDate: 'desc' }
            ]
        })

        if (questions.length === 0) {
            // Provide a more specific error message when spoiler protection is active
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

        // Select a random question
        const selectedQuestion = questions[Math.floor(Math.random() * questions.length)]

        return jsonResponse({
            id: selectedQuestion.id,
            question: selectedQuestion.question,
            answer: selectedQuestion.answer,
            category: {
                id: selectedQuestion.category.id,
                name: selectedQuestion.category.name
            }
        })
    } catch (error) {
        return serverErrorResponse('Failed to load Final Jeopardy', error)
    }
}
