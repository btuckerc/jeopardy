import { jsonResponse, serverErrorResponse, unauthorizedResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'
import { getAppUser } from '@/lib/clerk-auth'
import { claimGuestSession } from '@/lib/guest-sessions'

export const dynamic = 'force-dynamic'

const claimSchema = z.object({
    guestSessionId: z.string().uuid()
})

/**
 * POST /api/guest-sessions/claim
 * Claim a guest session and convert it to canonical user records (auth required)
 */
export async function POST(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        const { data: body, error } = await parseBody(request, claimSchema)
        if (error) return error

        const result = await claimGuestSession(body.guestSessionId, user.id)

        if (!result.success) {
            return jsonResponse({
                error: result.error || 'Failed to claim session'
            }, 400)
        }

        return jsonResponse({
            success: true,
            gameId: result.gameId,
            challengeId: result.challengeId,
            redirectPath: result.redirectPath
        })
    } catch (error) {
        return serverErrorResponse('Error claiming guest session', error)
    }
}

