import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-utils'
import { getActiveChallengeDate } from '@/lib/daily-challenge-utils'
import { z } from 'zod'

const searchParamsSchema = z.object({
    date: z.string().optional() // ISO date string, defaults to today
})

/**
 * GET /api/daily-challenge/leaderboard
 * Get leaderboard for daily challenge
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, searchParamsSchema)
        if (error) return error

        const targetDate = params.date 
            ? (() => {
                const [year, month, day] = params.date.split('-').map(v => parseInt(v, 10))
                return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
              })()
            : getActiveChallengeDate()

        // Get challenge for the date
        const challenge = await prisma.dailyChallenge.findUnique({
            where: { date: targetDate }
        })

        if (!challenge) {
            return jsonResponse({ leaderboard: [], totalCorrect: 0, totalAttempted: 0 })
        }

        // Get all completions
        // Sort by: 1) Correct answers first (correct: true), 2) Then by earliest completion time
        const completions = await prisma.userDailyChallenge.findMany({
            where: { challengeId: challenge.id },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true
                    }
                }
            },
            orderBy: [
                { correct: 'desc' }, // Correct (true) answers first, then incorrect (false)
                { completedAt: 'asc' } // Among same correctness, earliest completion time wins
            ]
        })

        const leaderboard = completions.map((completion, index) => ({
            rank: index + 1,
            userId: completion.user.id,
            displayName: completion.user.displayName || 'Anonymous',
            selectedIcon: completion.user.selectedIcon,
            avatarBackground: completion.user.avatarBackground,
            correct: completion.correct,
            completedAt: completion.completedAt
        }))

        const totalCorrect = completions.filter(c => c.correct).length
        const totalAttempted = completions.length

        return jsonResponse({
            leaderboard,
            totalCorrect,
            totalAttempted,
            date: targetDate.toISOString().split('T')[0]
        })
    } catch (error) {
        return serverErrorResponse('Error fetching leaderboard', error)
    }
}

