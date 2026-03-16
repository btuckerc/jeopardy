import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface SegmentDatum {
    name: string
    value: number
}

interface GroupByCountRow {
    _count: {
        id: number
    }
}

const usageMetricsParamsSchema = z.object({
    window: z.enum(['24h', '7d', '14d', '30d', '90d', 'all']).optional().default('30d'),
    bucket: z.enum(['hour', 'day']).optional().default('day')
})

async function getUsageMetricsStartTime(now: Date): Promise<Date> {
    const [firstUser, firstGuestSession, firstGame, firstDailyChallenge] = await Promise.all([
        prisma.user.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        prisma.guestSession.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        prisma.game.findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        }),
        prisma.userDailyChallenge.findFirst({
            orderBy: { completedAt: 'asc' },
            select: { completedAt: true },
        }),
    ])

    const candidates = [
        firstUser?.createdAt,
        firstGuestSession?.createdAt,
        firstGame?.createdAt,
        firstDailyChallenge?.completedAt,
    ].filter((value): value is Date => value instanceof Date)

    return candidates.sort((left, right) => left.getTime() - right.getTime())[0] || now
}

/**
 * GET /api/admin/usage-metrics
 * Get time-series usage metrics for admin dashboard
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, usageMetricsParamsSchema)
        
        if (error) return error

        const { window, bucket } = params
        const now = new Date()
        const active30dDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        
        // Calculate start time based on window
        let startTime: Date
        let bucketMs: number
        
        switch (window) {
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                bucketMs = bucket === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
                break
            case '14d':
                startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // Always use day buckets for 14d
                break
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // Always use day buckets for 30d
                break
            case '90d':
                startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000
                break
            case 'all':
                startTime = await getUsageMetricsStartTime(now)
                bucketMs = 7 * 24 * 60 * 60 * 1000 // weekly buckets to keep payload bounded
                break
            case '24h':
            default:
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                bucketMs = bucket === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
                break
        }

        // Helper function to get bucket key from date
        const getBucketKey = (date: Date): string => {
            if (bucket === 'hour' && window !== '30d' && window !== '14d') {
                return `${date.toISOString().slice(0, 13)}:00:00`
            }
            if (window === 'all') {
                return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs).toISOString().slice(0, 10)
            }
            return date.toISOString().slice(0, 10)
        }

        // Generate time buckets
        const buckets: Array<{ timestamp: Date; bucketKey: string }> = []
        let currentTime = new Date(startTime)
        while (currentTime <= now) {
            buckets.push({
                timestamp: new Date(currentTime),
                bucketKey: getBucketKey(currentTime)
            })
            currentTime = new Date(currentTime.getTime() + bucketMs)
        }

        // Query all data and group in JavaScript
        const [guestSessions, games, guestGames, dailyChallenges] = await Promise.all([
            prisma.guestSession.findMany({
                where: {
                    createdAt: { gte: startTime }
                },
                select: {
                    createdAt: true,
                    claimedAt: true,
                    type: true
                }
            }),
            prisma.game.findMany({
                where: {
                    createdAt: { gte: startTime }
                },
                select: {
                    createdAt: true,
                    updatedAt: true,
                    completed: true
                }
            }),
            prisma.guestGame.findMany({
                where: {
                    createdAt: { gte: startTime }
                },
                select: {
                    createdAt: true
                }
            }),
            prisma.userDailyChallenge.findMany({
                where: {
                    completedAt: { gte: startTime }
                },
                select: {
                    completedAt: true
                }
            })
        ])

        // Group data by bucket
        const createLookup = () => new Map<string, number>()

        const createdMap = createLookup()
        const claimedMap = createLookup()
        const questionsMap = createLookup()
        const gamesStartedMap = createLookup()
        const gamesCompletedMap = createLookup()
        const guestGamesStartedMap = createLookup()
        const dailyChallengeMap = createLookup()
        const guestDailyChallengeMap = createLookup()

        // Process guest sessions
        guestSessions.forEach(session => {
            const bucketKey = getBucketKey(session.createdAt)
            createdMap.set(bucketKey, (createdMap.get(bucketKey) || 0) + 1)
            
            if (session.type === 'RANDOM_QUESTION') {
                questionsMap.set(bucketKey, (questionsMap.get(bucketKey) || 0) + 1)
            }
            
            if (session.type === 'DAILY_CHALLENGE') {
                guestDailyChallengeMap.set(bucketKey, (guestDailyChallengeMap.get(bucketKey) || 0) + 1)
            }
            
            if (session.claimedAt) {
                const claimedBucketKey = getBucketKey(session.claimedAt)
                claimedMap.set(claimedBucketKey, (claimedMap.get(claimedBucketKey) || 0) + 1)
            }
        })

        // Process games
        games.forEach(game => {
            const startedBucketKey = getBucketKey(game.createdAt)
            gamesStartedMap.set(startedBucketKey, (gamesStartedMap.get(startedBucketKey) || 0) + 1)
            
            if (game.completed) {
                const completedBucketKey = getBucketKey(game.updatedAt)
                gamesCompletedMap.set(completedBucketKey, (gamesCompletedMap.get(completedBucketKey) || 0) + 1)
            }
        })

        // Process guest games
        guestGames.forEach(guestGame => {
            const bucketKey = getBucketKey(guestGame.createdAt)
            guestGamesStartedMap.set(bucketKey, (guestGamesStartedMap.get(bucketKey) || 0) + 1)
        })

        // Process daily challenges
        dailyChallenges.forEach(challenge => {
            const bucketKey = getBucketKey(challenge.completedAt)
            dailyChallengeMap.set(bucketKey, (dailyChallengeMap.get(bucketKey) || 0) + 1)
        })

        // Get overall userbase metrics
        const [totalUsers, activeUsers, _newUsers] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    lastOnlineAt: {
                        gte: active30dDate // Active in last 30 days
                    }
                }
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime }
                }
            })
        ])

        const [
            activeUsersInWindow,
            activeNewUsersInWindow,
            engagedUsersInWindow,
            playersInWindow,
            completedGamePlayersInWindow,
            dailyParticipantsInWindow,
            newUsersWithDisplayNameInWindow,
            newUsersWithGamesInWindow,
            newUsersWithDailyChallengesInWindow,
            newUsersWithAchievementsInWindow,
            activatedUsersInWindow,
            totalFriendships,
            usersWithFriends,
            activeUsersWithFriendsInWindow,
            friendChallengesCreatedInWindow,
            friendChallengesAcceptedInWindow,
            friendChallengesCompletedInWindow,
        ] = await Promise.all([
            prisma.user.count({
                where: {
                    lastOnlineAt: { gte: startTime },
                },
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime },
                    lastOnlineAt: { gte: startTime },
                },
            }),
            prisma.user.count({
                where: {
                    OR: [
                        { games: { some: { createdAt: { gte: startTime } } } },
                        { dailyChallenges: { some: { completedAt: { gte: startTime } } } },
                    ],
                },
            }),
            prisma.user.count({
                where: {
                    games: { some: { createdAt: { gte: startTime } } },
                },
            }),
            prisma.user.count({
                where: {
                    games: { some: { completed: true, updatedAt: { gte: startTime } } },
                },
            }),
            prisma.user.count({
                where: {
                    dailyChallenges: { some: { completedAt: { gte: startTime } } },
                },
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime },
                    displayName: { not: null },
                },
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime },
                    games: { some: {} },
                },
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime },
                    dailyChallenges: { some: {} },
                },
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime },
                    achievements: { some: {} },
                },
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime },
                    OR: [
                        { displayName: { not: null } },
                        { games: { some: {} } },
                        { dailyChallenges: { some: {} } },
                        { achievements: { some: {} } },
                        { tourCompleted: true },
                    ],
                },
            }),
            prisma.friendship.count(),
            prisma.user.count({
                where: {
                    OR: [
                        { friendshipsAsUserOne: { some: {} } },
                        { friendshipsAsUserTwo: { some: {} } },
                    ],
                },
            }),
            prisma.user.count({
                where: {
                    lastOnlineAt: { gte: startTime },
                    OR: [
                        { friendshipsAsUserOne: { some: {} } },
                        { friendshipsAsUserTwo: { some: {} } },
                    ],
                },
            }),
            prisma.friendChallenge.count({
                where: { createdAt: { gte: startTime } },
            }),
            prisma.friendChallenge.count({
                where: {
                    createdAt: { gte: startTime },
                    status: { in: ['ACCEPTED', 'COMPLETED'] },
                },
            }),
            prisma.friendChallenge.count({
                where: {
                    completedAt: { gte: startTime },
                },
            }),
        ])

        // Onboarding status breakdown
        const [
            usersWithDisplayName,
            usersWithGames,
            usersWithDailyChallenges,
            usersWithAchievements,
            activeLastWeek,
            activeLastDay
        ] = await Promise.all([
            prisma.user.count({ where: { displayName: { not: null } } }),
            prisma.user.count({ where: { games: { some: {} } } }),
            prisma.user.count({ where: { dailyChallenges: { some: {} } } }),
            prisma.user.count({ where: { achievements: { some: {} } } }),
            prisma.user.count({
                where: {
                    lastOnlineAt: {
                        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
            prisma.user.count({
                where: {
                    lastOnlineAt: {
                        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
                    }
                }
            })
        ])

        const segmentWhere = {
            lastOnlineAt: {
                gte: active30dDate,
            },
        }

        const toSegments = <K extends string>(
            rows: Array<GroupByCountRow & Record<K, string | null>>,
            key: K
        ): SegmentDatum[] =>
            rows
                .map(row => ({
                    name: row[key] || 'unknown',
                    value: row._count.id,
                }))
                .sort((left, right) => right.value - left.value)
                .slice(0, 10)

        const [
            countries,
            devices,
            locales,
            timezones,
            browsers,
            operatingSystems,
            referrers,
            acquisitionSources,
        ] = await Promise.all([
            prisma.user.groupBy({
                by: ['countryCode'],
                where: {
                    ...segmentWhere,
                    countryCode: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['deviceType'],
                where: {
                    ...segmentWhere,
                    deviceType: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['locale'],
                where: {
                    ...segmentWhere,
                    locale: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['timezone'],
                where: {
                    ...segmentWhere,
                    timezone: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['browserFamily'],
                where: {
                    ...segmentWhere,
                    browserFamily: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['osFamily'],
                where: {
                    ...segmentWhere,
                    osFamily: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['referrerHost'],
                where: {
                    ...segmentWhere,
                    referrerHost: { not: null },
                },
                _count: { id: true },
            }),
            prisma.user.groupBy({
                by: ['acquisitionSource'],
                where: {
                    ...segmentWhere,
                    acquisitionSource: { not: null },
                },
                _count: { id: true },
            }),
        ])

        // Calculate onboarding funnel
        const onboarding = {
            total: totalUsers,
            withDisplayName: usersWithDisplayName,
            withGames: usersWithGames,
            withDailyChallenges: usersWithDailyChallenges,
            withAchievements: usersWithAchievements,
            // Derived percentages
            profileCompleted: totalUsers > 0 ? Math.round((usersWithDisplayName / totalUsers) * 100) : 0,
            playedGame: totalUsers > 0 ? Math.round((usersWithGames / totalUsers) * 100) : 0,
            triedDaily: totalUsers > 0 ? Math.round((usersWithDailyChallenges / totalUsers) * 100) : 0,
            earnedAchievement: totalUsers > 0 ? Math.round((usersWithAchievements / totalUsers) * 100) : 0,
        }

        // User activity breakdown
        const activity = {
            activeLastDay,
            activeLastWeek,
            activeLastMonth: activeUsers,
            dormant: totalUsers - activeUsers, // Not active in 30 days
        }

        const activation = {
            newUsers: totals.newUsers,
            activatedUsers: activatedUsersInWindow,
            activationRate: totals.newUsers > 0 ? (activatedUsersInWindow / totals.newUsers) * 100 : 0,
            withDisplayName: newUsersWithDisplayNameInWindow,
            withGames: newUsersWithGamesInWindow,
            withDailyChallenges: newUsersWithDailyChallengesInWindow,
            withAchievements: newUsersWithAchievementsInWindow,
        }

        const windowSummary = {
            activeUsers: activeUsersInWindow,
            activeNewUsers: activeNewUsersInWindow,
            returningUsers: Math.max(activeUsersInWindow - activeNewUsersInWindow, 0),
            returningShare: activeUsersInWindow > 0
                ? (Math.max(activeUsersInWindow - activeNewUsersInWindow, 0) / activeUsersInWindow) * 100
                : 0,
            engagedUsers: engagedUsersInWindow,
            engagementRate: activeUsersInWindow > 0 ? (engagedUsersInWindow / activeUsersInWindow) * 100 : 0,
        }

        const valueMetrics = {
            dauMauStickiness: activeUsers > 0 ? (activeLastDay / activeUsers) * 100 : 0,
            wauMauStickiness: activeUsers > 0 ? (activeLastWeek / activeUsers) * 100 : 0,
            gameCompletionRate: totals.gamesStarted > 0 ? (totals.gamesCompleted / totals.gamesStarted) * 100 : 0,
            avgGamesPerPlayer: playersInWindow > 0 ? totals.gamesStarted / playersInWindow : 0,
            avgCompletedGamesPerPlayer: completedGamePlayersInWindow > 0 ? totals.gamesCompleted / completedGamePlayersInWindow : 0,
            dailyParticipationRate: activeUsersInWindow > 0 ? (dailyParticipantsInWindow / activeUsersInWindow) * 100 : 0,
            avgDailyChallengesPerParticipant: dailyParticipantsInWindow > 0
                ? totals.dailyChallengeSubmissions / dailyParticipantsInWindow
                : 0,
            guestClaimRate: conversionRate,
        }

        const social = {
            totalFriendships,
            usersWithFriends,
            activeUsersWithFriends: activeUsersWithFriendsInWindow,
            socialAdoptionRate: activeUsersInWindow > 0 ? (activeUsersWithFriendsInWindow / activeUsersInWindow) * 100 : 0,
            challengesCreated: friendChallengesCreatedInWindow,
            challengesAccepted: friendChallengesAcceptedInWindow,
            challengesCompleted: friendChallengesCompletedInWindow,
            challengeAcceptanceRate: friendChallengesCreatedInWindow > 0
                ? (friendChallengesAcceptedInWindow / friendChallengesCreatedInWindow) * 100
                : 0,
            challengeCompletionRate: friendChallengesCreatedInWindow > 0
                ? (friendChallengesCompletedInWindow / friendChallengesCreatedInWindow) * 100
                : 0,
        }

        // Get user activity by bucket
        const usersByBucket = await prisma.user.findMany({
            where: {
                createdAt: { gte: startTime }
            },
            select: {
                createdAt: true,
                lastOnlineAt: true
            }
        })

        const newUsersMap = createLookup()
        const activeUsersMap = createLookup()

        usersByBucket.forEach(user => {
            const createdBucketKey = getBucketKey(user.createdAt)
            newUsersMap.set(createdBucketKey, (newUsersMap.get(createdBucketKey) || 0) + 1)
            
            if (user.lastOnlineAt && user.lastOnlineAt >= startTime) {
                const activeBucketKey = getBucketKey(user.lastOnlineAt)
                activeUsersMap.set(activeBucketKey, (activeUsersMap.get(activeBucketKey) || 0) + 1)
            }
        })

        // Build time-series data
        const timeSeries = buckets.map(bucket => {
            const bucketKey = bucket.bucketKey
            return {
                timestamp: bucket.timestamp.toISOString(),
                guestSessionsCreated: createdMap.get(bucketKey) || 0,
                guestSessionsClaimed: claimedMap.get(bucketKey) || 0,
                guestQuestionsAnswered: questionsMap.get(bucketKey) || 0,
                gamesStarted: gamesStartedMap.get(bucketKey) || 0,
                gamesCompleted: gamesCompletedMap.get(bucketKey) || 0,
                guestGamesStarted: guestGamesStartedMap.get(bucketKey) || 0,
                dailyChallengeSubmissions: (dailyChallengeMap.get(bucketKey) || 0) + (guestDailyChallengeMap.get(bucketKey) || 0),
                newUsers: newUsersMap.get(bucketKey) || 0,
                activeUsers: activeUsersMap.get(bucketKey) || 0
            }
        })

        // Calculate aggregates
        const totals = {
            guestSessionsCreated: Array.from(createdMap.values()).reduce((sum, val) => sum + val, 0),
            guestSessionsClaimed: Array.from(claimedMap.values()).reduce((sum, val) => sum + val, 0),
            guestQuestionsAnswered: Array.from(questionsMap.values()).reduce((sum, val) => sum + val, 0),
            gamesStarted: Array.from(gamesStartedMap.values()).reduce((sum, val) => sum + val, 0),
            gamesCompleted: Array.from(gamesCompletedMap.values()).reduce((sum, val) => sum + val, 0),
            guestGamesStarted: Array.from(guestGamesStartedMap.values()).reduce((sum, val) => sum + val, 0),
            dailyChallengeSubmissions: Array.from(dailyChallengeMap.values()).reduce((sum, val) => sum + val, 0) +
                Array.from(guestDailyChallengeMap.values()).reduce((sum, val) => sum + val, 0),
            newUsers: Array.from(newUsersMap.values()).reduce((sum, val) => sum + val, 0),
            activeUsers: Array.from(activeUsersMap.values()).reduce((sum, val) => sum + val, 0)
        }

        const averages = {
            guestSessionsCreated: totals.guestSessionsCreated / buckets.length,
            guestSessionsClaimed: totals.guestSessionsClaimed / buckets.length,
            guestQuestionsAnswered: totals.guestQuestionsAnswered / buckets.length,
            gamesStarted: totals.gamesStarted / buckets.length,
            gamesCompleted: totals.gamesCompleted / buckets.length,
            guestGamesStarted: totals.guestGamesStarted / buckets.length,
            dailyChallengeSubmissions: totals.dailyChallengeSubmissions / buckets.length,
            newUsers: totals.newUsers / buckets.length,
            activeUsers: totals.activeUsers / buckets.length
        }

        // Calculate conversion rate
        const conversionRate = totals.guestSessionsCreated > 0
            ? (totals.guestSessionsClaimed / totals.guestSessionsCreated) * 100
            : 0

        return jsonResponse({
            window,
            bucket,
            timeSeries,
            totals,
            averages,
            conversionRate: Number(conversionRate.toFixed(2)),
            userbase: {
                totalUsers,
                activeUsers30d: activeUsers,
                newUsersInWindow: totals.newUsers
            },
            onboarding,
            activity,
            activation,
            windowSummary,
            valueMetrics,
            social,
            audience: {
                activeUsers30d: activeUsers,
                countries: toSegments(countries, 'countryCode'),
                devices: toSegments(devices, 'deviceType'),
                locales: toSegments(locales, 'locale'),
                timezones: toSegments(timezones, 'timezone'),
                browsers: toSegments(browsers, 'browserFamily'),
                operatingSystems: toSegments(operatingSystems, 'osFamily'),
                referrers: toSegments(referrers, 'referrerHost'),
                acquisitionSources: toSegments(acquisitionSources, 'acquisitionSource'),
            }
        })
    } catch (error) {
        return serverErrorResponse('Error fetching usage metrics', error)
    }
}
