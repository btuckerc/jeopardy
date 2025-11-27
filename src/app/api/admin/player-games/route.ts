import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse, forbiddenResponse, badRequestResponse, notFoundResponse } from '@/lib/api-utils'

/**
 * GET /api/admin/player-games
 * Get all games (optionally filtered by user or status)
 * Admin only
 */
export async function GET(request: Request) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const status = searchParams.get('status')
        const limit = parseInt(searchParams.get('limit') || '50')

        // Build where clause
        const where: any = {}
        if (userId) where.userId = userId
        if (status) where.status = status

        const games = await prisma.game.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true
                    }
                },
                questions: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            }
        })

        // Transform games to include useful info
        const gamesWithDetails = games.map(game => {
            const config = game.config as any
            const answeredQuestions = game.questions.filter(q => q.answered).length
            const correctQuestions = game.questions.filter(q => q.correct === true).length

            // Get unique categories
            const categoryMap = new Map<string, { id: string; name: string; round: string }>()
            game.questions.forEach(gq => {
                const cat = gq.question.category
                if (!categoryMap.has(cat.id)) {
                    categoryMap.set(cat.id, {
                        id: cat.id,
                        name: cat.name,
                        round: gq.question.round || 'SINGLE'
                    })
                }
            })

            return {
                id: game.id,
                seed: game.seed,
                status: game.status,
                currentRound: game.currentRound,
                currentScore: game.currentScore,
                visibility: game.visibility,
                config,
                user: game.user,
                answeredQuestions,
                correctQuestions,
                totalQuestionRecords: game.questions.length,
                categories: Array.from(categoryMap.values()),
                createdAt: game.createdAt,
                updatedAt: game.updatedAt
            }
        })

        return jsonResponse({ games: gamesWithDetails })
    } catch (error) {
        return serverErrorResponse('Failed to fetch games', error)
    }
}

/**
 * PATCH /api/admin/player-games
 * Update a game's properties (score, round, status, etc.)
 * Admin only
 */
export async function PATCH(request: Request) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const body = await request.json()
        const { gameId, updates } = body

        if (!gameId) {
            return badRequestResponse('gameId is required')
        }

        // Verify game exists
        const existingGame = await prisma.game.findUnique({
            where: { id: gameId }
        })

        if (!existingGame) {
            return notFoundResponse('Game not found')
        }

        // Build update data - only allow specific fields
        const updateData: any = {}
        
        if (updates.currentScore !== undefined) {
            updateData.currentScore = parseInt(updates.currentScore)
        }
        
        if (updates.currentRound !== undefined) {
            if (!['SINGLE', 'DOUBLE', 'FINAL'].includes(updates.currentRound)) {
                return badRequestResponse('Invalid round value')
            }
            updateData.currentRound = updates.currentRound
        }
        
        if (updates.status !== undefined) {
            if (!['IN_PROGRESS', 'COMPLETED', 'ABANDONED'].includes(updates.status)) {
                return badRequestResponse('Invalid status value')
            }
            updateData.status = updates.status
        }

        const updatedGame = await prisma.game.update({
            where: { id: gameId },
            data: updateData
        })

        return jsonResponse({ 
            success: true, 
            game: updatedGame 
        })
    } catch (error) {
        return serverErrorResponse('Failed to update game', error)
    }
}

/**
 * POST /api/admin/player-games
 * Update question answered status for a game
 * Admin only
 */
export async function POST(request: Request) {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const body = await request.json()
        const { action, gameId, questionId, updates } = body

        if (action === 'updateQuestion') {
            if (!gameId || !questionId) {
                return badRequestResponse('gameId and questionId are required')
            }

            // Find the GameQuestion record
            const gameQuestion = await prisma.gameQuestion.findFirst({
                where: {
                    gameId,
                    questionId
                }
            })

            if (!gameQuestion) {
                return notFoundResponse('Game question not found')
            }

            // Update the GameQuestion
            const updateData: any = {}
            if (updates.answered !== undefined) updateData.answered = updates.answered
            if (updates.correct !== undefined) updateData.correct = updates.correct

            const updated = await prisma.gameQuestion.update({
                where: { id: gameQuestion.id },
                data: updateData
            })

            return jsonResponse({ success: true, gameQuestion: updated })
        }

        if (action === 'resetQuestion') {
            if (!gameId || !questionId) {
                return badRequestResponse('gameId and questionId are required')
            }

            // Delete the GameQuestion record to "reset" it
            await prisma.gameQuestion.deleteMany({
                where: {
                    gameId,
                    questionId
                }
            })

            return jsonResponse({ success: true, message: 'Question reset' })
        }

        if (action === 'deleteGame') {
            if (!gameId) {
                return badRequestResponse('gameId is required')
            }

            // Delete all game questions first
            await prisma.gameQuestion.deleteMany({
                where: { gameId }
            })

            // Delete the game
            await prisma.game.delete({
                where: { id: gameId }
            })

            return jsonResponse({ success: true, message: 'Game deleted' })
        }

        return badRequestResponse('Invalid action')
    } catch (error) {
        return serverErrorResponse('Failed to process request', error)
    }
}

