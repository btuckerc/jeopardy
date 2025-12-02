import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

/**
 * GET /api/achievements
 * Get all achievements and user's unlocked achievements
 */
export async function GET(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Get all achievements
        const allAchievements = await prisma.achievement.findMany({
            orderBy: { name: 'asc' }
        })

        // Get user's unlocked achievements
        const userAchievements = await prisma.userAchievement.findMany({
            where: { userId: user.id },
            include: {
                achievement: true
            },
            orderBy: { unlockedAt: 'desc' }
        })

        const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId))

        // Combine with unlock status
        const achievements = allAchievements.map(achievement => ({
            ...achievement,
            unlocked: unlockedIds.has(achievement.id),
            unlockedAt: userAchievements.find(ua => ua.achievementId === achievement.id)?.unlockedAt || null
        }))

        return jsonResponse({
            achievements,
            unlockedCount: userAchievements.length,
            totalCount: allAchievements.length
        })
    } catch (error) {
        return serverErrorResponse('Error fetching achievements', error)
    }
}

