import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

/**
 * GET /api/user/streak
 * Get current user's streak information
 */
export async function GET(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                currentStreak: true,
                longestStreak: true,
                lastGameDate: true
            }
        })

        if (!userData) {
            return jsonResponse({ error: 'User not found' }, 404)
        }

        return jsonResponse({
            currentStreak: userData.currentStreak || 0,
            longestStreak: userData.longestStreak || 0,
            lastGameDate: userData.lastGameDate
        })
    } catch (error) {
        return serverErrorResponse('Error fetching streak', error)
    }
}

