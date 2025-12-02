import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'

/**
 * POST /api/daily-challenge/setup
 * Setup tomorrow's daily challenge (manual use only)
 * Admin only - automated generation is handled by node-cron in production
 */
export async function POST(request: Request) {
    try {
        // For cron jobs, you might want to use a secret token instead of admin check
        // For now, require admin
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)

        // Check if challenge already exists
        const existing = await prisma.dailyChallenge.findUnique({
            where: { date: tomorrow }
        })

        if (existing) {
            return jsonResponse({ 
                message: 'Challenge already exists for tomorrow',
                challengeId: existing.id
            })
        }

        // Setup challenge for tomorrow
        let challenge
        try {
            challenge = await setupDailyChallengeForDate(tomorrow)
        } catch (error: any) {
            // If it's a unique constraint error, challenge was created by another request
            if (error.code === 'P2002') {
                challenge = await prisma.dailyChallenge.findUnique({
                    where: { date: tomorrow }
                })
            } else {
                console.error('Error setting up daily challenge:', error)
                return jsonResponse({ error: 'Failed to setup challenge' }, 500)
            }
        }

        if (!challenge) {
            return jsonResponse({ error: 'Failed to setup challenge' }, 500)
        }

        return jsonResponse({
            message: 'Daily challenge setup successfully',
            challengeId: challenge.id,
            date: challenge.date,
            questionId: challenge.questionId
        })
    } catch (error) {
        return serverErrorResponse('Error setting up daily challenge', error)
    }
}

// Import the shared setup function
async function setupDailyChallengeForDate(date: Date): Promise<any> {
    // Import the setup function from the main route
    const { setupDailyChallenge } = await import('../route')
    return setupDailyChallenge(date)
}


