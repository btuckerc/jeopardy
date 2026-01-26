import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'
import { calculateAchievementProgress } from '@/lib/achievement-progress'

/**
 * GET /api/achievements
 * Get all achievements and user's unlocked achievements
 */
export async function GET(_request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Get all achievements, prioritizing visible ones
        const allAchievements = await prisma.achievement.findMany({
            orderBy: [
                { isHidden: 'asc' }, // Show visible achievements first
                { category: 'asc' },
                { tier: 'asc' },
                { name: 'asc' }
            ]
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

        // Combine with unlock status and calculate progress
        // Filter: show hidden achievements only if unlocked
        const achievementsWithProgress = await Promise.all(
            allAchievements
                .filter(achievement => {
                    // Show hidden achievements only if unlocked
                    if (achievement.isHidden && !unlockedIds.has(achievement.id)) {
                        return false
                    }
                    return true
                })
                .map(async (achievement) => {
                    const isUnlocked = unlockedIds.has(achievement.id)
                    const progress = await calculateAchievementProgress(
                        achievement.code,
                        user.id,
                        isUnlocked
                    )
                    
                    return {
                        ...achievement,
                        unlocked: isUnlocked,
                        unlockedAt: userAchievements.find(ua => ua.achievementId === achievement.id)?.unlockedAt || null,
                        progress: progress || undefined
                    }
                })
        )

        return jsonResponse({
            achievements: achievementsWithProgress,
            unlockedCount: userAchievements.length,
            totalCount: allAchievements.length
        })
    } catch (error) {
        return serverErrorResponse('Error fetching achievements', error)
    }
}

