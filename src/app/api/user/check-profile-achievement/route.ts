import { getAppUser } from '@/lib/clerk-auth'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

/**
 * POST /api/user/check-profile-achievement
 * Check if user should unlock PROFILE_CUSTOMIZED achievement
 */
export async function POST() {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Check for profile customization achievement
        const unlocked = await checkAndUnlockAchievements(user.id, {
            type: 'profile_updated',
            data: { userId: user.id }
        })

        return jsonResponse({
            unlocked: unlocked.length > 0,
            achievements: unlocked
        })
    } catch (error) {
        return serverErrorResponse('Error checking profile achievement', error)
    }
}
