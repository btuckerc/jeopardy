import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'

interface RouteParams {
    params: Promise<{ gameId: string; questionId: string }>
}

export const dynamic = 'force-dynamic'

/**
 * GET /api/games/[gameId]/questions/[questionId]/details
 * Returns the user's answer details for a specific question in a game, including
 * the user's answer text, correctness status (including dispute resolution), and dispute status.
 */
async function getHandler(request: NextRequest, context?: { params?: Record<string, string | string[]> }) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const gameId = context?.params?.gameId as string
        const questionId = context?.params?.questionId as string

        if (!gameId || !questionId) {
            return jsonResponse({ error: 'Missing gameId or questionId parameter' }, 400)
        }

        // Verify game exists and user owns it
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            select: {
                id: true,
                userId: true
            }
        })

        if (!game) {
            return notFoundResponse('Game not found')
        }

        if (game.userId !== appUser.id) {
            return forbiddenResponse('You can only view details for your own games')
        }

        // Fetch the GameQuestion record
        const gameQuestion = await prisma.gameQuestion.findUnique({
            where: {
                gameId_questionId: {
                    gameId,
                    questionId
                }
            },
            select: {
                answered: true,
                correct: true,
                userAnswer: true
            }
        })

        if (!gameQuestion) {
            return jsonResponse({
                answered: false,
                correct: null,
                userAnswer: null,
                disputeStatus: null
            })
        }

        // Check for disputes related to this question
        const disputes = await prisma.answerDispute.findMany({
            where: {
                gameId,
                questionId,
                userId: appUser.id
            },
            select: {
                id: true,
                status: true,
                resolvedAt: true,
                userAnswer: true // Also fetch the userAnswer from dispute as fallback
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // Determine dispute status
        let disputeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NONE'
        let disputeUserAnswer: string | null = null
        if (disputes.length > 0) {
            const latestDispute = disputes[0]
            disputeUserAnswer = latestDispute.userAnswer // Fallback answer from dispute
            if (latestDispute.status === 'APPROVED') {
                disputeStatus = 'APPROVED'
            } else if (latestDispute.status === 'REJECTED') {
                disputeStatus = 'REJECTED'
            } else if (latestDispute.status === 'PENDING') {
                disputeStatus = 'PENDING'
            }
        }

        // If there's an approved dispute, the answer should be considered correct
        const effectiveCorrect = disputeStatus === 'APPROVED' ? true : gameQuestion.correct

        // Use GameQuestion.userAnswer if available, otherwise fall back to dispute's userAnswer
        const effectiveUserAnswer = gameQuestion.userAnswer || disputeUserAnswer

        return jsonResponse({
            answered: gameQuestion.answered,
            correct: effectiveCorrect,
            userAnswer: effectiveUserAnswer,
            disputeStatus
        })
    } catch (error) {
        console.error('Error fetching question details:', error)
        return serverErrorResponse('Failed to fetch question details', error)
    }
}

export const GET = withInstrumentation(getHandler)
