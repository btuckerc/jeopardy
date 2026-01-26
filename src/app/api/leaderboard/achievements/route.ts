import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

/**
 * GET /api/leaderboard/achievements
 * Get achievement badges for leaderboard users
 * Returns a map of userId -> array of achievement icons (limited to top achievements)
 */
export async function GET(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        const { searchParams } = new URL(request.url)
        const userIds = searchParams.get('userIds')?.split(',') || []

        if (userIds.length === 0) {
            return jsonResponse({})
        }

        // Get top-tier achievements for these users (tier 3+ or significant achievements)
        const userAchievements = await prisma.userAchievement.findMany({
            where: {
                userId: { in: userIds },
                achievement: {
                    OR: [
                        { tier: { gte: 3 } },
                        { code: { in: ['STREAK_30', 'STREAK_100', 'QUESTIONS_1000', 'QUESTIONS_5000', 'PERFECT_GAME', 'ALL_CATEGORIES_MASTER'] } }
                    ]
                }
            },
            include: {
                achievement: {
                    select: {
                        icon: true,
                        code: true
                    }
                }
            },
            orderBy: {
                unlockedAt: 'desc'
            }
        })

        // Group by userId and limit to 3 most recent/significant achievements per user
        const achievementsByUser: Record<string, string[]> = {}
        userAchievements.forEach(ua => {
            if (!achievementsByUser[ua.userId]) {
                achievementsByUser[ua.userId] = []
            }
            if (achievementsByUser[ua.userId].length < 3 && ua.achievement.icon) {
                achievementsByUser[ua.userId].push(ua.achievement.icon)
            }
        })

        return jsonResponse(achievementsByUser)
    } catch (error) {
        return serverErrorResponse('Error fetching leaderboard achievements', error)
    }
}
