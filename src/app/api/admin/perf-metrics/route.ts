import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/perf-metrics
 * Get API performance metrics from the database for admin dashboard
 * 
 * Query params:
 * - window: '1h' | '24h' | '7d' | '30d' (default: '24h')
 * - route: filter by route prefix (optional)
 * - minDuration: filter requests slower than this (optional)
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const window = searchParams.get('window') || '24h'
        const routeFilter = searchParams.get('route')
        const minDuration = searchParams.get('minDuration')

        // Calculate time window
        const now = new Date()
        let startTime: Date
        switch (window) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000)
                break
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
            case '24h':
            default:
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }

        // Build where clause
        const where: Prisma.ApiRequestEventWhereInput = {
            timestamp: { gte: startTime },
        }
        if (routeFilter) {
            where.route = { startsWith: routeFilter }
        }
        if (minDuration) {
            where.durationMs = { gte: parseInt(minDuration) }
        }

        // Get all requests in window
        const requests = await prisma.apiRequestEvent.findMany({
            where,
            select: {
                route: true,
                method: true,
                statusCode: true,
                durationMs: true,
                timestamp: true,
                errorCode: true,
                errorMessage: true,
            },
            orderBy: { timestamp: 'desc' },
            take: 10000, // Limit to prevent memory issues
        })

        if (requests.length === 0) {
            return jsonResponse({
                window,
                timestamp: now.toISOString(),
                totalRequests: 0,
                avgResponseTime: 0,
                errorRate: 0,
                slowestRoutes: [],
                mostFrequentRoutes: [],
                recentSlowRequests: [],
                routeStats: [],
                recentErrors: [],
            })
        }

        // Calculate overall stats
        const totalRequests = requests.length
        const totalDuration = requests.reduce((sum, r) => sum + r.durationMs, 0)
        const avgResponseTime = Math.round(totalDuration / totalRequests)
        const errors = requests.filter(r => r.statusCode >= 400)
        const errorRate = Math.round((errors.length / totalRequests) * 100)

        // Group by route+method for per-route stats
        const routeGroups = new Map<string, typeof requests>()
        for (const req of requests) {
            const key = `${req.method}:${req.route}`
            if (!routeGroups.has(key)) {
                routeGroups.set(key, [])
            }
            routeGroups.get(key)!.push(req)
        }

        // Calculate per-route stats
        const routeStats = Array.from(routeGroups.entries()).map(([key, reqs]) => {
            const [method, route] = key.split(':')
            const durations = reqs.map(r => r.durationMs).sort((a, b) => a - b)
            const routeErrors = reqs.filter(r => r.statusCode >= 400)
            
            return {
                route,
                method,
                count: reqs.length,
                avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
                minMs: durations[0],
                maxMs: durations[durations.length - 1],
                p50Ms: percentile(durations, 50),
                p95Ms: percentile(durations, 95),
                p99Ms: percentile(durations, 99),
                errorRate: Math.round((routeErrors.length / reqs.length) * 100),
                lastHourCount: reqs.filter(r => r.timestamp.getTime() > now.getTime() - 60 * 60 * 1000).length,
                recentRequests: reqs.slice(0, 10).map(r => ({
                    route: r.route,
                    method: r.method,
                    statusCode: r.statusCode,
                    durationMs: r.durationMs,
                    timestamp: r.timestamp.toISOString(),
                })),
            }
        })

        // Sort for different views
        const slowestRoutes = [...routeStats]
            .filter(r => r.count >= 3) // Only routes with enough data
            .sort((a, b) => b.p95Ms - a.p95Ms)
            .slice(0, 10)

        const mostFrequentRoutes = [...routeStats]
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

        // Recent slow requests (>200ms)
        const recentSlowRequests = requests
            .filter(r => r.durationMs > 200)
            .slice(0, 20)
            .map(r => ({
                route: r.route,
                method: r.method,
                statusCode: r.statusCode,
                durationMs: r.durationMs,
                timestamp: r.timestamp.toISOString(),
            }))

        // Recent errors
        const recentErrors = errors
            .slice(0, 20)
            .map(r => ({
                route: r.route,
                method: r.method,
                statusCode: r.statusCode,
                durationMs: r.durationMs,
                timestamp: r.timestamp.toISOString(),
                errorCode: r.errorCode,
                errorMessage: r.errorMessage?.slice(0, 200),
            }))

        return jsonResponse({
            window,
            timestamp: now.toISOString(),
            totalRequests,
            avgResponseTime,
            errorRate,
            slowestRoutes,
            mostFrequentRoutes,
            recentSlowRequests,
            routeStats: routeStats.sort((a, b) => b.lastHourCount - a.lastHourCount),
            recentErrors,
        })
    } catch (error) {
        return serverErrorResponse('Error fetching performance metrics', error)
    }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
}
