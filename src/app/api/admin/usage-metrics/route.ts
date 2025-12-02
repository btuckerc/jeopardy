import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const usageMetricsParamsSchema = z.object({
    window: z.enum(['24h', '7d', '14d', '30d']).optional().default('7d'),
    bucket: z.enum(['hour', 'day']).optional().default('day')
})

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
        
        // Calculate start time based on window
        let startTime: Date
        let bucketMs: number
        
        switch (window) {
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                bucketMs = bucket === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
                break
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
        }

        // Helper function to get bucket key from date
        const getBucketKey = (date: Date): string => {
            if (bucket === 'hour' && window !== '30d' && window !== '14d') {
                return `${date.toISOString().slice(0, 13)}:00:00`
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
        const [totalUsers, activeUsers, newUsers] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    lastOnlineAt: {
                        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // Active in last 30 days
                    }
                }
            }),
            prisma.user.count({
                where: {
                    createdAt: { gte: startTime }
                }
            })
        ])

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
            }
        })
    } catch (error) {
        return serverErrorResponse('Error fetching usage metrics', error)
    }
}

