import { z } from 'zod'
import { NextRequest } from 'next/server'
import { FriendChallengeStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { badRequestResponse, jsonResponse, parseSearchParams, requireAuth, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { getFriendshipBetweenUsers, isFriend } from '@/lib/friends'
import { DEFAULT_STATS_CLUE_VALUE, FINAL_STATS_CLUE_VALUE } from '@/lib/scoring'

const compareSchema = z.object({
    friendId: z.string().trim().min(1, 'friendId is required'),
})

type CompareWinner = 'VIEWER' | 'FRIEND' | 'TIE'

type ComparisonStat = {
    id: string
    label: string
    winner: CompareWinner
    detail: string
}

type HeadToHeadMatch = {
    completedAt: Date
    viewerScore: number | null
    friendScore: number | null
    winner: CompareWinner
}

type UserCompareStats = {
    answeredCount: number
    correctCount: number
    accuracy: number
    totalPoints: number
    tripleStumpersAnswered: number
    roundStats: Array<{
        round: 'SINGLE' | 'DOUBLE' | 'FINAL'
        roundName: string
        totalAnswered: number
        correctAnswers: number
        totalPoints: number
        accuracy: number
    }>
    dailyCompletedCount: number
    dailyCorrectCount: number
    dailyAccuracy: number
    recentDailyCorrectCount: number
    recentDailySampleSize: number
    recentDailyAccuracy: number
}

type OverallAggregateRow = {
    userId: string
    answeredCount: number | bigint
    correctCount: number | bigint
    totalPoints: number | bigint
    tripleStumpersAnswered: number | bigint
    singleAnswered: number | bigint
    singleCorrect: number | bigint
    singlePoints: number | bigint
    doubleAnswered: number | bigint
    doubleCorrect: number | bigint
    doublePoints: number | bigint
    finalAnswered: number | bigint
    finalCorrect: number | bigint
    finalPoints: number | bigint
}

type DailyAggregateRow = {
    userId: string
    completedCount: number | bigint
    correctCount: number | bigint
    recentCorrectCount: number | bigint
    recentSampleSize: number | bigint
}

function toNumber(value: number | bigint | null | undefined): number {
    if (typeof value === 'bigint') {
        return Number(value)
    }

    return typeof value === 'number' ? value : 0
}

function toPercent(correct: number, total: number): number {
    if (total <= 0) {
        return 0
    }

    return Number(((correct / total) * 100).toFixed(1))
}

function pickWinner(viewerValue: number, friendValue: number): CompareWinner {
    if (viewerValue === friendValue) {
        return 'TIE'
    }

    return viewerValue > friendValue ? 'VIEWER' : 'FRIEND'
}

function formatPercent(value: number): string {
    return `${value.toFixed(1).replace(/\.0$/, '')}%`
}

function buildUserStats(
    userId: string,
    overallStats: Map<string, OverallAggregateRow>,
    dailyStats: Map<string, DailyAggregateRow>,
): UserCompareStats {
    const overall = overallStats.get(userId)
    const daily = dailyStats.get(userId)

    const answeredCount = toNumber(overall?.answeredCount)
    const correctCount = toNumber(overall?.correctCount)
    const totalPoints = toNumber(overall?.totalPoints)
    const tripleStumpersAnswered = toNumber(overall?.tripleStumpersAnswered)
    const dailyCompletedCount = toNumber(daily?.completedCount)
    const dailyCorrectCount = toNumber(daily?.correctCount)
    const recentDailySampleSize = toNumber(daily?.recentSampleSize)
    const recentDailyCorrectCount = toNumber(daily?.recentCorrectCount)
    const roundStats = [
        {
            round: 'SINGLE' as const,
            roundName: 'Single Jeopardy',
            totalAnswered: toNumber(overall?.singleAnswered),
            correctAnswers: toNumber(overall?.singleCorrect),
            totalPoints: toNumber(overall?.singlePoints),
        },
        {
            round: 'DOUBLE' as const,
            roundName: 'Double Jeopardy',
            totalAnswered: toNumber(overall?.doubleAnswered),
            correctAnswers: toNumber(overall?.doubleCorrect),
            totalPoints: toNumber(overall?.doublePoints),
        },
        {
            round: 'FINAL' as const,
            roundName: 'Final Jeopardy',
            totalAnswered: toNumber(overall?.finalAnswered),
            correctAnswers: toNumber(overall?.finalCorrect),
            totalPoints: toNumber(overall?.finalPoints),
        },
    ].map((round) => ({
        ...round,
        accuracy: toPercent(round.correctAnswers, round.totalAnswered),
    }))

    return {
        answeredCount,
        correctCount,
        accuracy: toPercent(correctCount, answeredCount),
        totalPoints,
        tripleStumpersAnswered,
        roundStats,
        dailyCompletedCount,
        dailyCorrectCount,
        dailyAccuracy: toPercent(dailyCorrectCount, dailyCompletedCount),
        recentDailyCorrectCount,
        recentDailySampleSize,
        recentDailyAccuracy: toPercent(recentDailyCorrectCount, recentDailySampleSize),
    }
}

function nameFor(profile: { displayName: string | null }, fallback: string): string {
    return profile.displayName || fallback
}

export const GET = withInstrumentation(async (request: NextRequest) => {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const parsed = parseSearchParams(searchParams, compareSchema)
    if (parsed.error) return parsed.error

    try {
        const friendId = parsed.data.friendId

        if (!(await isFriend(user.id, friendId))) {
            return badRequestResponse('You can only compare stats with friends')
        }

        const [viewer, friend, friendship, overallRows, dailyRows, headToHeadChallenges] = await Promise.all([
            prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    displayName: true,
                    selectedIcon: true,
                    avatarBackground: true,
                    currentStreak: true,
                    longestStreak: true,
                    createdAt: true,
                },
            }),
            prisma.user.findUnique({
                where: { id: friendId },
                select: {
                    id: true,
                    displayName: true,
                    selectedIcon: true,
                    avatarBackground: true,
                    currentStreak: true,
                    longestStreak: true,
                    createdAt: true,
                },
            }),
            getFriendshipBetweenUsers(user.id, friendId),
            prisma.$queryRaw<OverallAggregateRow[]>`
                WITH latest_answers AS (
                    SELECT DISTINCT ON ("userId", "questionId")
                        "userId",
                        "questionId",
                        correct,
                        q.round,
                        q.value,
                        q."wasTripleStumper"
                    FROM "GameHistory" gh
                    JOIN "Question" q ON q.id = gh."questionId"
                    WHERE gh."userId" IN (${user.id}, ${friendId})
                    ORDER BY gh."userId", gh."questionId", gh.timestamp DESC
                )
                SELECT
                    "userId",
                    COUNT(*)::int AS "answeredCount",
                    SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS "correctCount",
                    SUM(
                        CASE
                            WHEN correct AND round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                            WHEN correct THEN COALESCE(value, ${DEFAULT_STATS_CLUE_VALUE})
                            ELSE 0
                        END
                    )::int AS "totalPoints",
                    SUM(CASE WHEN correct AND "wasTripleStumper" THEN 1 ELSE 0 END)::int AS "tripleStumpersAnswered",
                    SUM(CASE WHEN round = 'SINGLE' THEN 1 ELSE 0 END)::int AS "singleAnswered",
                    SUM(CASE WHEN round = 'SINGLE' AND correct THEN 1 ELSE 0 END)::int AS "singleCorrect",
                    SUM(CASE WHEN round = 'SINGLE' AND correct THEN COALESCE(value, ${DEFAULT_STATS_CLUE_VALUE}) ELSE 0 END)::int AS "singlePoints",
                    SUM(CASE WHEN round = 'DOUBLE' THEN 1 ELSE 0 END)::int AS "doubleAnswered",
                    SUM(CASE WHEN round = 'DOUBLE' AND correct THEN 1 ELSE 0 END)::int AS "doubleCorrect",
                    SUM(CASE WHEN round = 'DOUBLE' AND correct THEN COALESCE(value, ${DEFAULT_STATS_CLUE_VALUE}) ELSE 0 END)::int AS "doublePoints",
                    SUM(CASE WHEN round = 'FINAL' THEN 1 ELSE 0 END)::int AS "finalAnswered",
                    SUM(CASE WHEN round = 'FINAL' AND correct THEN 1 ELSE 0 END)::int AS "finalCorrect",
                    SUM(CASE WHEN round = 'FINAL' AND correct THEN ${FINAL_STATS_CLUE_VALUE} ELSE 0 END)::int AS "finalPoints"
                FROM latest_answers
                GROUP BY "userId"
            `,
            prisma.$queryRaw<DailyAggregateRow[]>`
                WITH ranked_daily AS (
                    SELECT
                        "userId",
                        correct,
                        ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "completedAt" DESC) AS row_num
                    FROM "UserDailyChallenge"
                    WHERE "userId" IN (${user.id}, ${friendId})
                )
                SELECT
                    "userId",
                    COUNT(*)::int AS "completedCount",
                    SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int AS "correctCount",
                    SUM(CASE WHEN row_num <= 7 AND correct THEN 1 ELSE 0 END)::int AS "recentCorrectCount",
                    SUM(CASE WHEN row_num <= 7 THEN 1 ELSE 0 END)::int AS "recentSampleSize"
                FROM ranked_daily
                GROUP BY "userId"
            `,
            prisma.friendChallenge.findMany({
                where: {
                    status: FriendChallengeStatus.COMPLETED,
                    OR: [
                        { challengerUserId: user.id, opponentUserId: friendId },
                        { challengerUserId: friendId, opponentUserId: user.id },
                    ],
                },
                select: {
                    winnerUserId: true,
                    challengerUserId: true,
                    challengerScore: true,
                    opponentScore: true,
                    completedAt: true,
                },
                orderBy: { completedAt: 'desc' },
            }),
        ])

        if (!viewer || !friend) {
            return badRequestResponse('Users not found')
        }

        const overallStats = new Map(overallRows.map((row) => [row.userId, row]))
        const dailyStats = new Map(dailyRows.map((row) => [row.userId, row]))

        const viewerStats = buildUserStats(viewer.id, overallStats, dailyStats)
        const friendStats = buildUserStats(friend.id, overallStats, dailyStats)
        const roundMatchups = viewerStats.roundStats.map((viewerRound) => {
            const friendRound = friendStats.roundStats.find((round) => round.round === viewerRound.round)

            return {
                round: viewerRound.round,
                roundName: viewerRound.roundName,
                winner: pickWinner(viewerRound.accuracy, friendRound?.accuracy ?? 0),
                detail: `${formatPercent(viewerRound.accuracy)} on ${viewerRound.totalAnswered} answers vs ${formatPercent(friendRound?.accuracy ?? 0)} on ${friendRound?.totalAnswered ?? 0}`,
            }
        })

        let viewerWins = 0
        let friendWins = 0
        let ties = 0
        let marginSamples = 0
        let marginSum = 0
        let viewerScoreSum = 0
        let friendScoreSum = 0
        let scoreSamples = 0
        let viewerBestScore = 0
        let friendBestScore = 0
        const recentMatches: HeadToHeadMatch[] = []

        for (const challenge of headToHeadChallenges) {
            const winner: CompareWinner = challenge.winnerUserId === user.id
                ? 'VIEWER'
                : challenge.winnerUserId === friendId
                    ? 'FRIEND'
                    : 'TIE'

            if (challenge.winnerUserId === user.id) {
                viewerWins += 1
            } else if (challenge.winnerUserId === friendId) {
                friendWins += 1
            } else {
                ties += 1
            }

            const viewerScore = challenge.challengerUserId === user.id
                ? challenge.challengerScore
                : challenge.opponentScore
            const friendScore = challenge.challengerUserId === user.id
                ? challenge.opponentScore
                : challenge.challengerScore

            if (typeof viewerScore === 'number' && typeof friendScore === 'number') {
                marginSamples += 1
                marginSum += Math.abs(viewerScore - friendScore)
                viewerScoreSum += viewerScore
                friendScoreSum += friendScore
                scoreSamples += 1
                viewerBestScore = Math.max(viewerBestScore, viewerScore)
                friendBestScore = Math.max(friendBestScore, friendScore)
            }

            recentMatches.push({
                completedAt: challenge.completedAt ?? new Date(0),
                viewerScore: typeof viewerScore === 'number' ? viewerScore : null,
                friendScore: typeof friendScore === 'number' ? friendScore : null,
                winner,
            })
        }

        const matchupStats: ComparisonStat[] = [
            {
                id: 'points',
                label: 'Total points',
                winner: pickWinner(viewerStats.totalPoints, friendStats.totalPoints),
                detail: `${viewerStats.totalPoints.toLocaleString()} points vs ${friendStats.totalPoints.toLocaleString()}`,
            },
            {
                id: 'accuracy',
                label: 'Overall accuracy',
                winner: pickWinner(viewerStats.accuracy, friendStats.accuracy),
                detail: `${formatPercent(viewerStats.accuracy)} on ${viewerStats.answeredCount} latest attempts vs ${formatPercent(friendStats.accuracy)} on ${friendStats.answeredCount}`,
            },
            {
                id: 'triple-stumpers',
                label: 'Triple stumpers',
                winner: pickWinner(viewerStats.tripleStumpersAnswered, friendStats.tripleStumpersAnswered),
                detail: `${viewerStats.tripleStumpersAnswered} conquered vs ${friendStats.tripleStumpersAnswered}`,
            },
            {
                id: 'daily',
                label: 'Daily challenge',
                winner: pickWinner(viewerStats.dailyAccuracy, friendStats.dailyAccuracy),
                detail: viewerStats.dailyCompletedCount + friendStats.dailyCompletedCount === 0
                    ? 'No daily challenge history yet'
                    : `${formatPercent(viewerStats.dailyAccuracy)} on ${viewerStats.dailyCompletedCount} plays vs ${formatPercent(friendStats.dailyAccuracy)} on ${friendStats.dailyCompletedCount}`,
            },
            {
                id: 'volume',
                label: 'Sample size',
                winner: pickWinner(viewerStats.answeredCount, friendStats.answeredCount),
                detail: `${viewerStats.answeredCount} answered questions vs ${friendStats.answeredCount}`,
            },
        ]

        if (headToHeadChallenges.length > 0) {
            matchupStats.splice(4, 0, {
                id: 'head-to-head',
                label: 'Head-to-head',
                winner: pickWinner(viewerWins, friendWins),
                detail: `${viewerWins}-${friendWins}${ties > 0 ? ` with ${ties} tie${ties === 1 ? '' : 's'}` : ''} in completed friend challenges`,
            })
        }

        const viewerName = nameFor(viewer, 'You')
        const friendName = nameFor(friend, 'Your friend')
        const insights: string[] = []
        const headToHeadInsights: string[] = []

        if (viewerStats.totalPoints !== friendStats.totalPoints) {
            const leaderName = viewerStats.totalPoints > friendStats.totalPoints ? viewerName : friendName
            const leaderPoints = Math.max(viewerStats.totalPoints, friendStats.totalPoints)
            const trailingPoints = Math.min(viewerStats.totalPoints, friendStats.totalPoints)
            insights.push(`${leaderName} has converted more of the board into score: ${leaderPoints.toLocaleString()} points vs ${trailingPoints.toLocaleString()}.`)
        }

        if (Math.abs(viewerStats.accuracy - friendStats.accuracy) >= 3 && Math.min(viewerStats.answeredCount, friendStats.answeredCount) >= 15) {
            const leaderName = viewerStats.accuracy > friendStats.accuracy ? viewerName : friendName
            const leaderAccuracy = Math.max(viewerStats.accuracy, friendStats.accuracy)
            const trailingAccuracy = Math.min(viewerStats.accuracy, friendStats.accuracy)
            insights.push(`${leaderName} is landing more consistently overall: ${formatPercent(leaderAccuracy)} vs ${formatPercent(trailingAccuracy)}.`)
        }

        if (headToHeadChallenges.length > 0) {
            if (viewerWins === friendWins) {
                insights.push(`Your direct challenge record is even at ${viewerWins}-${friendWins}${ties > 0 ? ` with ${ties} tie${ties === 1 ? '' : 's'}` : ''}.`)
                headToHeadInsights.push(`The rivalry is dead even at ${viewerWins}-${friendWins}${ties > 0 ? ` with ${ties} tie${ties === 1 ? '' : 's'}` : ''}.`)
            } else {
                const leaderName = viewerWins > friendWins ? viewerName : friendName
                const wins = Math.max(viewerWins, friendWins)
                const losses = Math.min(viewerWins, friendWins)
                insights.push(`${leaderName} leads the rivalry ${wins}-${losses} in completed friend challenges.`)
                headToHeadInsights.push(`${leaderName} owns the current rivalry lead at ${wins}-${losses}.`)
            }
        }

        if (viewerStats.recentDailySampleSize > 0 || friendStats.recentDailySampleSize > 0) {
            const viewerRecent = viewerStats.recentDailyAccuracy
            const friendRecent = friendStats.recentDailyAccuracy
            if (viewerRecent !== friendRecent) {
                const leaderName = viewerRecent > friendRecent ? viewerName : friendName
                insights.push(`${leaderName} has the stronger recent daily form over the last seven plays.`)
            }
        }

        if (viewerStats.tripleStumpersAnswered !== friendStats.tripleStumpersAnswered) {
            const leaderName = viewerStats.tripleStumpersAnswered > friendStats.tripleStumpersAnswered ? viewerName : friendName
            const leaderCount = Math.max(viewerStats.tripleStumpersAnswered, friendStats.tripleStumpersAnswered)
            insights.push(`${leaderName} has been stronger on the hardest clues, with ${leaderCount} triple stumpers solved.`)
        }

        const mostDecisiveRound = roundMatchups.find((matchup) => matchup.winner !== 'TIE')
        if (mostDecisiveRound) {
            const leaderName = mostDecisiveRound.winner === 'VIEWER' ? viewerName : friendName
            insights.push(`${leaderName} has the clearest round edge in ${mostDecisiveRound.roundName}.`)
        }

        if (insights.length === 0) {
            insights.push(`${viewerName} and ${friendName} are tightly matched right now.`)
        }

        if (scoreSamples > 0) {
            const viewerAverageScore = Number((viewerScoreSum / scoreSamples).toFixed(1))
            const friendAverageScore = Number((friendScoreSum / scoreSamples).toFixed(1))

            if (viewerAverageScore !== friendAverageScore) {
                const leaderName = viewerAverageScore > friendAverageScore ? viewerName : friendName
                const leaderAverage = Math.max(viewerAverageScore, friendAverageScore)
                const trailingAverage = Math.min(viewerAverageScore, friendAverageScore)
                headToHeadInsights.push(`${leaderName} scores more per completed challenge on average: ${leaderAverage} to ${trailingAverage}.`)
            }
        }

        const latestMatch = recentMatches[0]
        if (latestMatch) {
            if (latestMatch.winner === 'TIE') {
                headToHeadInsights.push('Your latest completed challenge finished level.')
            } else {
                const leaderName = latestMatch.winner === 'VIEWER' ? viewerName : friendName
                headToHeadInsights.push(`${leaderName} won the latest head-to-head meeting.`)
            }
        }

        if (headToHeadInsights.length === 0) {
            headToHeadInsights.push('Complete a friend challenge to start building a direct rivalry record.')
        }

        const primaryMatchup = matchupStats.find((stat) => stat.winner !== 'TIE')
        const primaryWinnerName = primaryMatchup?.winner === 'VIEWER'
            ? viewerName
            : primaryMatchup?.winner === 'FRIEND'
                ? friendName
                : null

        return jsonResponse({
            viewer: {
                ...viewer,
                stats: viewerStats,
            },
            friend: {
                ...friend,
                stats: friendStats,
            },
            comparison: {
                currentStreakDelta: viewer.currentStreak - friend.currentStreak,
                longestStreakDelta: viewer.longestStreak - friend.longestStreak,
                overallAccuracyDelta: Number((viewerStats.accuracy - friendStats.accuracy).toFixed(1)),
                dailyAccuracyDelta: Number((viewerStats.dailyAccuracy - friendStats.dailyAccuracy).toFixed(1)),
                answeredCountDelta: viewerStats.answeredCount - friendStats.answeredCount,
                friendshipSince: friendship?.since ?? friendship?.createdAt ?? null,
                summary: primaryMatchup && primaryWinnerName
                    ? `${primaryWinnerName} has the clearest edge in ${primaryMatchup.label.toLowerCase()}.`
                    : `${viewerName} and ${friendName} are essentially even.`,
                matchupStats,
                roundMatchups,
                insights,
                headToHeadInsights,
                headToHead: {
                    completedCount: headToHeadChallenges.length,
                    viewerWins,
                    friendWins,
                    ties,
                    averageMargin: marginSamples > 0 ? Number((marginSum / marginSamples).toFixed(1)) : null,
                    viewerAverageScore: scoreSamples > 0 ? Number((viewerScoreSum / scoreSamples).toFixed(1)) : null,
                    friendAverageScore: scoreSamples > 0 ? Number((friendScoreSum / scoreSamples).toFixed(1)) : null,
                    viewerBestScore: scoreSamples > 0 ? viewerBestScore : null,
                    friendBestScore: scoreSamples > 0 ? friendBestScore : null,
                    lastCompletedAt: headToHeadChallenges[0]?.completedAt ?? null,
                    lastResult: headToHeadChallenges[0]
                        ? headToHeadChallenges[0].winnerUserId === user.id
                            ? 'VIEWER'
                            : headToHeadChallenges[0].winnerUserId === friendId
                                ? 'FRIEND'
                                : 'TIE'
                        : null,
                    recentMatches: recentMatches.slice(0, 5),
                },
            },
        })
    } catch (error) {
        return serverErrorResponse('Error comparing friend performance', error)
    }
})

export const dynamic = 'force-dynamic'
