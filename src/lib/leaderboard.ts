import { prisma } from '@/lib/prisma'
import { FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring'
import { listFriendIds } from '@/lib/friends'
import { Prisma } from '@prisma/client'

export interface LeaderboardEntry {
    id: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    correctAnswers: number
    totalAnswered: number
    totalPoints: number
    avgPointsPerCorrect: number
}

export type LeaderboardScope = 'global' | 'friends'

interface LeaderboardQuery {
    limit: number
    scope?: LeaderboardScope
    viewerUserId?: string
}

export async function getLeaderboardEntries({
    limit,
    scope = 'global',
    viewerUserId,
}: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const friendIds =
        scope === 'friends' && viewerUserId
            ? await listFriendIds(viewerUserId)
            : []

    const userIdFilter = scope === 'friends' && viewerUserId
        ? [...new Set([viewerUserId, ...friendIds])]
        : null

    if (scope === 'friends' && userIdFilter && userIdFilter.length === 0) {
        return []
    }

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
            ${userIdFilter
                ? Prisma.sql`AND u.id IN (${Prisma.join(userIdFilter)})`
                : Prisma.sql``}
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

    return userStats
}
