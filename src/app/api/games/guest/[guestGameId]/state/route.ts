import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, notFoundResponse } from '@/lib/api-utils'
import { getGuestConfig } from '@/lib/guest-sessions'

export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{ guestGameId: string }>
}

/**
 * GET /api/games/guest/[guestGameId]/state
 * Get the current state of a guest game (similar to regular game state endpoint)
 */
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { guestGameId } = await params

        const guestGame = await prisma.guestGame.findUnique({
            where: { id: guestGameId },
            include: {
                guestSession: true,
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

        if (!guestGame) {
            return notFoundResponse('Guest game not found')
        }

        // Check if session is expired or claimed
        if (new Date() > guestGame.guestSession.expiresAt || guestGame.guestSession.claimedAt) {
            return jsonResponse({
                error: 'Guest session expired or already claimed',
                requiresAuth: true
            }, 403)
        }

        // Check guest limits
        const answeredCount = guestGame.questions.filter(q => q.answered).length
        const config = await getGuestConfig()
        const limitReached = answeredCount >= config.randomGameMaxQuestionsBeforeAuth

        // For guest games, we'll return a simplified state
        // The frontend will need to fetch questions dynamically similar to regular games
        return jsonResponse({
            id: guestGame.id,
            guestSessionId: guestGame.guestSessionId,
            seed: guestGame.seed,
            status: guestGame.status,
            currentRound: guestGame.currentRound,
            currentScore: guestGame.currentScore,
            config: guestGame.config,
            answeredCount,
            limitReached,
            requiresAuth: limitReached,
            expiresAt: guestGame.guestSession.expiresAt.toISOString()
        })
    } catch (error) {
        return serverErrorResponse('Error fetching guest game state', error)
    }
}

