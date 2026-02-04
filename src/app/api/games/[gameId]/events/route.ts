import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { getStatsPoints } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

/**
 * GET /api/games/[gameId]/events
 * Server-Sent Events endpoint for real-time game updates
 * Streams dispute approvals and other game events to the client
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { gameId: string } }
) {
    const appUser = await getAppUser()
    if (!appUser) {
        return unauthorizedResponse()
    }

    const { gameId } = params

    // Verify game ownership
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { userId: true }
    })

    if (!game) {
        return jsonResponse({ error: 'Game not found' }, 404)
    }

    if (game.userId !== appUser.id) {
        return forbiddenResponse('You can only access your own games')
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    let closed = false
    let lastCheck = new Date()

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection event
            controller.enqueue(encoder.encode('event: connected\ndata: {"gameId": "' + gameId + '"}\n\n'))

            // Poll for approved disputes every 2 seconds
            const interval = setInterval(async () => {
                if (closed) {
                    clearInterval(interval)
                    return
                }

                try {
                    // Check for disputes approved since last check
                    const approvedDisputes = await prisma.answerDispute.findMany({
                        where: {
                            gameId,
                            status: 'APPROVED',
                            resolvedAt: {
                                gt: lastCheck
                            }
                        },
                        include: {
                            question: {
                                select: {
                                    id: true,
                                    value: true,
                                    round: true
                                }
                            }
                        }
                    })

                    if (approvedDisputes.length > 0) {
                        // Get current game state
                        const currentGame = await prisma.game.findUnique({
                            where: { id: gameId },
                            select: {
                                currentScore: true,
                                questions: {
                                    select: {
                                        questionId: true,
                                        answered: true,
                                        correct: true
                                    }
                                }
                            }
                        })

                        // Send event for each approved dispute
                        for (const dispute of approvedDisputes) {
                            const questionValue = dispute.question.value || 200
                            const points = getStatsPoints({
                                round: dispute.question.round,
                                faceValue: questionValue,
                                correct: true
                            })

                            const eventData = {
                                type: 'dispute_approved',
                                questionId: dispute.questionId,
                                points: points,
                                newScore: currentGame?.currentScore || 0,
                                timestamp: dispute.resolvedAt?.toISOString()
                            }

                            controller.enqueue(
                                encoder.encode(`event: dispute_approved\ndata: ${JSON.stringify(eventData)}\n\n`)
                            )
                        }
                    }

                    lastCheck = new Date()
                } catch (error) {
                    console.error('SSE polling error:', error)
                }
            }, 2000)

            // Handle client disconnect
            request.signal.addEventListener('abort', () => {
                closed = true
                clearInterval(interval)
                controller.close()
            })
        },
        cancel() {
            closed = true
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}