import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'
import { FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring'

/**
 * GET /api/user/activity
 * Get user's recent activity stats for homepage feed
 */
export async function GET(request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Get games played this week
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        weekAgo.setHours(0, 0, 0, 0)

        const gamesThisWeek = await prisma.game.count({
            where: {
                userId: user.id,
                createdAt: {
                    gte: weekAgo
                },
                status: 'COMPLETED'
            }
        })

        // Get best score
        const bestGame = await prisma.game.findFirst({
            where: {
                userId: user.id,
                status: 'COMPLETED'
            },
            orderBy: {
                score: 'desc'
            },
            select: {
                score: true
            }
        })

        // Get leaderboard rank
        const userStats = await prisma.$queryRaw<Array<{
            id: string
            total_points: number
        }>>`
            SELECT 
                u.id,
                COALESCE(SUM(
                    CASE 
                        WHEN gh.correct = true AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                        WHEN gh.correct = true THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                        ELSE 0 
                    END
                ), 0)::integer as total_points
            FROM "User" u
            LEFT JOIN "GameHistory" gh ON u.id = gh."userId"
            LEFT JOIN "Question" q ON q.id = gh."questionId"
            GROUP BY u.id
            HAVING COALESCE(SUM(
                CASE 
                    WHEN gh.correct = true AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                    WHEN gh.correct = true THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                    ELSE 0 
                END
            ), 0) > 0
            ORDER BY total_points DESC
        `

        const userRank = userStats.findIndex(u => u.id === user.id) + 1
        const totalPlayers = userStats.length

        return jsonResponse({
            gamesThisWeek,
            bestScore: bestGame?.score || 0,
            leaderboardRank: userRank > 0 ? userRank : null,
            totalPlayers
        })
    } catch (error) {
        return serverErrorResponse('Error fetching activity', error)
    }
}

