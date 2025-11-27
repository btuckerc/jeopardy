import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    serverErrorResponse,
    requireAuth,
    parseSearchParams,
    paginationSchema
} from '@/lib/api-utils'
import { FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

// Cache leaderboard for 5 minutes
export const revalidate = 300

// Request validation schema
const leaderboardParamsSchema = z.object({
    limit: z.string().optional().transform(v => v ? Math.min(parseInt(v, 10), 100) : 10)
})

interface LeaderboardEntry {
    id: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    correctAnswers: number
    totalAnswered: number
    totalPoints: number
    avgPointsPerCorrect: number
}

export async function GET(request: Request) {
    // Require authentication
    const { error: authError } = await requireAuth()
    if (authError) return authError

    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, leaderboardParamsSchema)
        
        if (error) return error

        // Get all users with their stats using optimized query
        // Note: We join with Question to get round and value for normalized scoring
        // GameHistory.points remains unchanged (may contain wagers) for future use
        const userStats = await prisma.$queryRaw<LeaderboardEntry[]>`
            WITH UserStats AS (
                SELECT 
                    u.id,
                    u."displayName",
                    u."selectedIcon",
                    u."avatarBackground",
                    COUNT(DISTINCT CASE WHEN gh.correct = true THEN gh."questionId" END)::integer as correct_answers,
                    COUNT(DISTINCT gh."questionId")::integer as total_answered,
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
                GROUP BY u.id, u."displayName", u."selectedIcon", u."avatarBackground"
                HAVING COALESCE(SUM(
                    CASE 
                        WHEN gh.correct = true AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                        WHEN gh.correct = true THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                        ELSE 0 
                    END
                ), 0) > 0
            )
            SELECT 
                id,
                COALESCE("displayName", 'Anonymous Player') as "displayName",
                "selectedIcon",
                "avatarBackground",
                correct_answers as "correctAnswers",
                total_answered as "totalAnswered",
                total_points as "totalPoints",
                CASE 
                    WHEN correct_answers > 0 
                    THEN ROUND(CAST(total_points AS DECIMAL) / correct_answers, 2)::float
                    ELSE 0 
                END as "avgPointsPerCorrect"
            FROM UserStats
            ORDER BY total_points DESC
            LIMIT ${params.limit}
        `

        return jsonResponse({
            leaderboard: userStats,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch leaderboard', error)
    }
} 