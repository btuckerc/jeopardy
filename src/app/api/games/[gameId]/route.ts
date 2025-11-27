import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'

interface RouteParams {
    params: Promise<{ gameId: string }>
}

/**
 * GET /api/games/[gameId]
 * Get full game state for a specific game.
 * Only the game owner (or opponent in multiplayer) can access.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return unauthorizedResponse()
        }

        const { gameId } = await params

        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                questions: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                },
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true
                    }
                }
            }
        })

        if (!game) {
            return notFoundResponse('Game not found')
        }

        // Check authorization: must be owner or opponent
        const isOwner = game.userId === session.user.id
        const isOpponent = game.opponentUserId === session.user.id
        
        if (!isOwner && !isOpponent) {
            // Check visibility for public/unlisted games
            if (game.visibility === 'PRIVATE') {
                return forbiddenResponse('You do not have access to this game')
            }
        }

        // Transform questions into a more usable format
        const questionsMap: Record<string, {
            id: string
            answered: boolean
            correct: boolean | null
            questionId: string
            categoryId: string
            categoryName: string
        }> = {}

        game.questions.forEach(gq => {
            questionsMap[gq.questionId] = {
                id: gq.id,
                answered: gq.answered,
                correct: gq.correct,
                questionId: gq.questionId,
                categoryId: gq.question.categoryId,
                categoryName: gq.question.category.name
            }
        })

        // Calculate stats
        const totalQuestions = game.questions.length
        const answeredQuestions = game.questions.filter(q => q.answered).length
        const correctQuestions = game.questions.filter(q => q.correct === true).length

        return jsonResponse({
            id: game.id,
            seed: game.seed,
            config: game.config,
            status: game.status,
            currentRound: game.currentRound,
            currentScore: game.currentScore,
            visibility: game.visibility,
            owner: game.user,
            isOwner,
            questions: questionsMap,
            stats: {
                totalQuestions,
                answeredQuestions,
                correctQuestions,
                percentComplete: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
            },
            createdAt: game.createdAt,
            updatedAt: game.updatedAt
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch game', error)
    }
}

// Schema for updating game
const updateGameSchema = z.object({
    status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
    currentRound: z.enum(['SINGLE', 'DOUBLE', 'FINAL']).optional(),
    currentScore: z.number().optional(),
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).optional()
})

/**
 * PATCH /api/games/[gameId]
 * Update game state (status, round, score, visibility).
 * Only the game owner can update.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return unauthorizedResponse()
        }

        const { gameId } = await params

        // Verify ownership
        const existingGame = await prisma.game.findUnique({
            where: { id: gameId },
            select: { userId: true }
        })

        if (!existingGame) {
            return notFoundResponse('Game not found')
        }

        if (existingGame.userId !== session.user.id) {
            return forbiddenResponse('You can only update your own games')
        }

        const { data: updates, error } = await parseBody(request, updateGameSchema)
        if (error) return error

        const game = await prisma.game.update({
            where: { id: gameId },
            data: {
                ...updates,
                // Also update the legacy 'completed' field for backward compatibility
                completed: updates.status === 'COMPLETED' ? true : updates.status === 'ABANDONED' ? true : undefined
            }
        })

        return jsonResponse({
            id: game.id,
            status: game.status,
            currentRound: game.currentRound,
            currentScore: game.currentScore,
            visibility: game.visibility,
            updatedAt: game.updatedAt
        })
    } catch (error) {
        return serverErrorResponse('Failed to update game', error)
    }
}

/**
 * DELETE /api/games/[gameId]
 * Delete/abandon a game. Only the owner can delete.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return unauthorizedResponse()
        }

        const { gameId } = await params

        // Verify ownership
        const existingGame = await prisma.game.findUnique({
            where: { id: gameId },
            select: { userId: true }
        })

        if (!existingGame) {
            return notFoundResponse('Game not found')
        }

        if (existingGame.userId !== session.user.id) {
            return forbiddenResponse('You can only delete your own games')
        }

        // Mark as abandoned rather than actually deleting
        await prisma.game.update({
            where: { id: gameId },
            data: {
                status: 'ABANDONED',
                completed: true
            }
        })

        return jsonResponse({ success: true, message: 'Game abandoned' })
    } catch (error) {
        return serverErrorResponse('Failed to delete game', error)
    }
}

