import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    serverErrorResponse,
    requireAuth,
    parseSearchParams
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

// Cache leaderboard for 5 minutes
export const revalidate = 300

// Leaderboard types
type LeaderboardType = 'points' | 'streaks' | 'accuracy' | 'weekly' | 'monthly' | 'games'

// Request validation schema
const leaderboardParamsSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(10),
    type: z.enum(['points', 'streaks', 'accuracy', 'weekly', 'monthly', 'games']).default('points')
})

interface PointsLeaderboardEntry {
    id: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    correctAnswers: number
    totalAnswered: number
    totalPoints: number
    avgPointsPerCorrect: number
}

interface StreaksLeaderboardEntry {
    id: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    currentStreak: number
    longestStreak: number
}

interface AccuracyLeaderboardEntry {
    id: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    correctAnswers: number
    totalAnswered: number
    accuracy: number
}

interface GamesLeaderboardEntry {
    id: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    gamesCompleted: number
    totalPoints: number
}

// Helper to get points leaderboard (all-time)
async function getPointsLeaderboard(limit: number): Promise<PointsLeaderboardEntry[]> {
    return prisma.$queryRaw<PointsLeaderboardEntry[]>`
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
        LIMIT ${limit}
    `
}

// Helper to get time-based points leaderboard (weekly or monthly)
async function getTimeBasedLeaderboard(limit: number, days: number): Promise<PointsLeaderboardEntry[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return prisma.$queryRaw<PointsLeaderboardEntry[]>`
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
            INNER JOIN "GameHistory" gh ON u.id = gh."userId" AND gh.timestamp >= ${cutoffDate}
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
        LIMIT ${limit}
    `
}

// Helper to get streaks leaderboard
async function getStreaksLeaderboard(limit: number): Promise<StreaksLeaderboardEntry[]> {
    return prisma.$queryRaw<StreaksLeaderboardEntry[]>`
        SELECT 
            u.id,
            COALESCE(u."displayName", 'Anonymous Player') as "displayName",
            u."selectedIcon",
            u."avatarBackground",
            u."currentStreak" as "currentStreak",
            u."longestStreak" as "longestStreak"
        FROM "User" u
        WHERE u."longestStreak" > 0 OR u."currentStreak" > 0
        ORDER BY u."longestStreak" DESC, u."currentStreak" DESC
        LIMIT ${limit}
    `
}

// Helper to get accuracy leaderboard
async function getAccuracyLeaderboard(limit: number): Promise<AccuracyLeaderboardEntry[]> {
    // Minimum questions answered to appear on accuracy leaderboard
    const minQuestions = 50

    return prisma.$queryRaw<AccuracyLeaderboardEntry[]>`
        WITH UserStats AS (
            SELECT 
                u.id,
                u."displayName",
                u."selectedIcon",
                u."avatarBackground",
                COUNT(DISTINCT CASE WHEN gh.correct = true THEN gh."questionId" END)::integer as correct_answers,
                COUNT(DISTINCT gh."questionId")::integer as total_answered
            FROM "User" u
            INNER JOIN "GameHistory" gh ON u.id = gh."userId"
            GROUP BY u.id, u."displayName", u."selectedIcon", u."avatarBackground"
            HAVING COUNT(DISTINCT gh."questionId") >= ${minQuestions}
        )
        SELECT 
            id,
            COALESCE("displayName", 'Anonymous Player') as "displayName",
            "selectedIcon",
            "avatarBackground",
            correct_answers as "correctAnswers",
            total_answered as "totalAnswered",
            ROUND((CAST(correct_answers AS DECIMAL) / total_answered) * 100, 2)::float as accuracy
        FROM UserStats
        ORDER BY accuracy DESC, total_answered DESC
        LIMIT ${limit}
    `
}

// Helper to get games completed leaderboard
async function getGamesLeaderboard(limit: number): Promise<GamesLeaderboardEntry[]> {
    return prisma.$queryRaw<GamesLeaderboardEntry[]>`
        SELECT 
            u.id,
            COALESCE(u."displayName", 'Anonymous Player') as "displayName",
            u."selectedIcon",
            u."avatarBackground",
            COUNT(DISTINCT g.id)::integer as "gamesCompleted",
            COALESCE(SUM(g.score), 0)::integer as "totalPoints"
        FROM "User" u
        INNER JOIN "Game" g ON u.id = g."userId" AND g.completed = true
        GROUP BY u.id, u."displayName", u."selectedIcon", u."avatarBackground"
        HAVING COUNT(DISTINCT g.id) > 0
        ORDER BY "gamesCompleted" DESC, "totalPoints" DESC
        LIMIT ${limit}
    `
}

export const GET = withInstrumentation(async (request: NextRequest) => {
    // Require authentication
    const { error: authError } = await requireAuth()
    if (authError) return authError

    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, leaderboardParamsSchema)
        
        if (error) return error

        const leaderboardType = params.type as LeaderboardType
        let leaderboard: PointsLeaderboardEntry[] | StreaksLeaderboardEntry[] | AccuracyLeaderboardEntry[] | GamesLeaderboardEntry[]

        switch (leaderboardType) {
            case 'streaks':
                leaderboard = await getStreaksLeaderboard(params.limit)
                break
            case 'accuracy':
                leaderboard = await getAccuracyLeaderboard(params.limit)
                break
            case 'weekly':
                leaderboard = await getTimeBasedLeaderboard(params.limit, 7)
                break
            case 'monthly':
                leaderboard = await getTimeBasedLeaderboard(params.limit, 30)
                break
            case 'games':
                leaderboard = await getGamesLeaderboard(params.limit)
                break
            case 'points':
            default:
                leaderboard = await getPointsLeaderboard(params.limit)
                break
        }

        return jsonResponse({
            leaderboard,
            type: leaderboardType,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch leaderboard', error)
    }
})