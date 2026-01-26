import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const apiMetricsParamsSchema = z.object({
    window: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    route: z.string().optional(), // Filter by specific route
})

/**
 * GET /api/admin/api-metrics
 * Get API performance metrics from persistent ApiRequestEvent table
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, apiMetricsParamsSchema)
        if (error) return error

        const { window, route } = params
        const now = new Date()
        
        // Calculate time range and bucket size
        let startTime: Date
        let bucketMs: number
        
        switch (window) {
            case '1h':
                startTime = new Date(now.getTime() - 60 * 60 * 1000)
                bucketMs = 5 * 60 * 1000 // 5-minute buckets
                break
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // 1-day buckets
                break
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // 1-day buckets
                break
            case '24h':
            default:
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                bucketMs = 60 * 60 * 1000 // 1-hour buckets
                break
        }

        // Build where clause
        const where: Prisma.ApiRequestEventWhereInput = {
            timestamp: { gte: startTime, lte: now },
        }
        if (route) {
            where.route = route
        }

        // Fetch all events in window for aggregation
        const events = await prisma.apiRequestEvent.findMany({
            where,
            select: {
                timestamp: true,
                route: true,
                method: true,
                statusCode: true,
                durationMs: true,
                isAdminRoute: true,
            },
            orderBy: { timestamp: 'asc' },
        })

        // Generate time buckets
        const buckets: Map<string, {
            timestamp: string
            requests: number
            errors: number
            durations: number[]
        }> = new Map()

        let currentTime = new Date(startTime)
        while (currentTime <= now) {
            const bucketKey = currentTime.toISOString()
            buckets.set(bucketKey, {
                timestamp: bucketKey,
                requests: 0,
                errors: 0,
                durations: [],
            })
            currentTime = new Date(currentTime.getTime() + bucketMs)
        }

        // Aggregate by route for "top routes" analysis
        const routeStats: Map<string, {
            route: string
            requests: number
            errors: number
            durations: number[]
            methods: Set<string>
        }> = new Map()

        // Process events
        events.forEach(event => {
            // Find the bucket this event belongs to
            const eventBucketTime = new Date(
                Math.floor(event.timestamp.getTime() / bucketMs) * bucketMs
            )
            const bucketKey = eventBucketTime.toISOString()
            
            if (buckets.has(bucketKey)) {
                const bucket = buckets.get(bucketKey)!
                bucket.requests++
                if (event.statusCode >= 400) bucket.errors++
                bucket.durations.push(event.durationMs)
            }

            // Aggregate by route
            if (!routeStats.has(event.route)) {
                routeStats.set(event.route, {
                    route: event.route,
                    requests: 0,
                    errors: 0,
                    durations: [],
                    methods: new Set(),
                })
            }
            const routeStat = routeStats.get(event.route)!
            routeStat.requests++
            if (event.statusCode >= 400) routeStat.errors++
            routeStat.durations.push(event.durationMs)
            routeStat.methods.add(event.method)
        })

        // Helper to calculate percentiles
        const percentile = (arr: number[], p: number): number => {
            if (arr.length === 0) return 0
            const sorted = [...arr].sort((a, b) => a - b)
            const index = Math.ceil((p / 100) * sorted.length) - 1
            return sorted[Math.max(0, index)]
        }

        // Build time series
        const timeSeries = Array.from(buckets.values()).map(bucket => ({
            timestamp: bucket.timestamp,
            requests: bucket.requests,
            errors: bucket.errors,
            errorRate: bucket.requests > 0 ? (bucket.errors / bucket.requests) * 100 : 0,
            p50: percentile(bucket.durations, 50),
            p95: percentile(bucket.durations, 95),
            p99: percentile(bucket.durations, 99),
            avgDuration: bucket.durations.length > 0 
                ? Math.round(bucket.durations.reduce((a, b) => a + b, 0) / bucket.durations.length)
                : 0,
        }))

        // Build route stats (sorted by request count)
        const topRoutes = Array.from(routeStats.values())
            .map(stat => ({
                route: stat.route,
                requests: stat.requests,
                errors: stat.errors,
                errorRate: stat.requests > 0 ? (stat.errors / stat.requests) * 100 : 0,
                p50: percentile(stat.durations, 50),
                p95: percentile(stat.durations, 95),
                p99: percentile(stat.durations, 99),
                avgDuration: stat.durations.length > 0
                    ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length)
                    : 0,
                methods: Array.from(stat.methods),
            }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 20)

        // Build slowest routes (sorted by p95)
        const slowestRoutes = Array.from(routeStats.values())
            .filter(stat => stat.requests >= 5) // Need at least 5 requests
            .map(stat => ({
                route: stat.route,
                requests: stat.requests,
                p95: percentile(stat.durations, 95),
                p99: percentile(stat.durations, 99),
                maxDuration: Math.max(...stat.durations),
            }))
            .sort((a, b) => b.p95 - a.p95)
            .slice(0, 10)

        // Calculate totals
        const allDurations = events.map(e => e.durationMs)
        const totalErrors = events.filter(e => e.statusCode >= 400).length
        
        const totals = {
            requests: events.length,
            errors: totalErrors,
            errorRate: events.length > 0 ? (totalErrors / events.length) * 100 : 0,
            p50: percentile(allDurations, 50),
            p95: percentile(allDurations, 95),
            p99: percentile(allDurations, 99),
            avgDuration: allDurations.length > 0
                ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
                : 0,
        }

        return jsonResponse({
            window,
            timeSeries,
            topRoutes,
            slowestRoutes,
            totals,
            timestamp: now.toISOString(),
        })
    } catch (error) {
        return serverErrorResponse('Error fetching API metrics', error)
    }
}

