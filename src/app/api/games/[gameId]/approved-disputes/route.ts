import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { getStatsPoints } from '@/lib/scoring'

interface RouteParams {
    params: Promise<{ gameId: string }>
}

export const dynamic = 'force-dynamic'

/**
 * GET /api/games/[gameId]/approved-disputes
 * Returns list of recently approved disputes for this game that affect scoring.
 * Used by the game client to sync score when disputes are approved mid-game.
 */
async function getHandler(request: NextRequest, context?: { params?: Record<string, string | string[]> }) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const gameId = context?.params?.gameId as string
        if (!gameId) {
            return jsonResponse({ error: 'Missing gameId parameter' }, 400)
        }

        // Verify game exists and user owns it
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            select: {
                id: true,
                userId: true,
                createdAt: true
            }
        })

        if (!game) {
            return notFoundResponse('Game not found')
        }

        if (game.userId !== appUser.id) {
            return forbiddenResponse('You can only check disputes for your own games')
        }

        // Find all APPROVED disputes for this game that were resolved after the game was created
        // We only care about disputes that were approved after the game started
        const approvedDisputes = await prisma.answerDispute.findMany({
            where: {
                gameId,
                status: 'APPROVED',
                mode: 'GAME',
                resolvedAt: {
                    gte: game.createdAt // Only disputes resolved after game started
                }
            },
            include: {
                question: {
                    select: {
                        id: true,
                        round: true,
                        value: true
                    }
                }
            },
            orderBy: {
                resolvedAt: 'desc'
            }
        })

        // Calculate points for each approved dispute
        const disputesWithPoints = approvedDisputes.map(dispute => {
            const questionValue = dispute.question.value || 200
            const points = getStatsPoints({
                round: dispute.question.round,
                faceValue: questionValue,
                correct: true
            })

            return {
                questionId: dispute.questionId,
                points,
                resolvedAt: dispute.resolvedAt?.toISOString() || dispute.updatedAt.toISOString()
            }
        })

        return jsonResponse({
            approvedDisputes: disputesWithPoints
        })
    } catch (error) {
        console.error('Error fetching approved disputes:', error)
        return serverErrorResponse('Failed to fetch approved disputes', error)
    }
}

export const GET = withInstrumentation(getHandler)
