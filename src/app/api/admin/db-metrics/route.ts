import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const dbMetricsParamsSchema = z.object({
    window: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
    model: z.string().optional(), // Filter by specific model
    slowOnly: z.enum(['true', 'false']).optional().default('false'),
})

/**
 * GET /api/admin/db-metrics
 * Get database query performance metrics from DbQueryEvent table
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, dbMetricsParamsSchema)
        if (error) return error

        const { window, model, slowOnly } = params
        const now = new Date()
        
        // Calculate time range
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
        const where: Prisma.DbQueryEventWhereInput = {
            timestamp: { gte: startTime, lte: now },
        }
        if (model) {
            where.model = model
        }
        if (slowOnly === 'true') {
            where.isSlow = true
        }

        // Fetch events
        const events = await prisma.dbQueryEvent.findMany({
            where,
            select: {
                timestamp: true,
                model: true,
                action: true,
                durationMs: true,
                success: true,
                isSlow: true,
                recordCount: true,
            },
            orderBy: { timestamp: 'asc' },
            take: 10000, // Limit for performance
        })

        // Generate time buckets
        const buckets: Map<string, {
            timestamp: string
            queries: number
            slowQueries: number
            errors: number
            durations: number[]
        }> = new Map()

        let currentTime = new Date(startTime)
        while (currentTime <= now) {
            const bucketKey = currentTime.toISOString()
            buckets.set(bucketKey, {
                timestamp: bucketKey,
                queries: 0,
                slowQueries: 0,
                errors: 0,
                durations: [],
            })
            currentTime = new Date(currentTime.getTime() + bucketMs)
        }

        // Aggregate by model+action
        const operationStats: Map<string, {
            model: string
            action: string
            queries: number
            slowQueries: number
            errors: number
            durations: number[]
        }> = new Map()

        // Process events
        events.forEach(event => {
            // Find bucket
            const eventBucketTime = new Date(
                Math.floor(event.timestamp.getTime() / bucketMs) * bucketMs
            )
            const bucketKey = eventBucketTime.toISOString()
            
            if (buckets.has(bucketKey)) {
                const bucket = buckets.get(bucketKey)!
                bucket.queries++
                if (event.isSlow) bucket.slowQueries++
                if (!event.success) bucket.errors++
                bucket.durations.push(event.durationMs)
            }

            // Aggregate by model+action
            const opKey = `${event.model}:${event.action}`
            if (!operationStats.has(opKey)) {
                operationStats.set(opKey, {
                    model: event.model,
                    action: event.action,
                    queries: 0,
                    slowQueries: 0,
                    errors: 0,
                    durations: [],
                })
            }
            const opStat = operationStats.get(opKey)!
            opStat.queries++
            if (event.isSlow) opStat.slowQueries++
            if (!event.success) opStat.errors++
            opStat.durations.push(event.durationMs)
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
            queries: bucket.queries,
            slowQueries: bucket.slowQueries,
            errors: bucket.errors,
            p50: percentile(bucket.durations, 50),
            p95: percentile(bucket.durations, 95),
            avgDuration: bucket.durations.length > 0 
                ? Math.round(bucket.durations.reduce((a, b) => a + b, 0) / bucket.durations.length)
                : 0,
        }))

        // Build operation stats (sorted by query count)
        const topOperations = Array.from(operationStats.values())
            .map(stat => ({
                model: stat.model,
                action: stat.action,
                queries: stat.queries,
                slowQueries: stat.slowQueries,
                errors: stat.errors,
                slowRate: stat.queries > 0 ? (stat.slowQueries / stat.queries) * 100 : 0,
                p50: percentile(stat.durations, 50),
                p95: percentile(stat.durations, 95),
                p99: percentile(stat.durations, 99),
                avgDuration: stat.durations.length > 0
                    ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length)
                    : 0,
            }))
            .sort((a, b) => b.queries - a.queries)
            .slice(0, 20)

        // Build slowest operations (sorted by p95)
        const slowestOperations = Array.from(operationStats.values())
            .filter(stat => stat.queries >= 3) // Need at least 3 queries
            .map(stat => ({
                model: stat.model,
                action: stat.action,
                queries: stat.queries,
                p95: percentile(stat.durations, 95),
                p99: percentile(stat.durations, 99),
                maxDuration: Math.max(...stat.durations),
                slowRate: stat.queries > 0 ? (stat.slowQueries / stat.queries) * 100 : 0,
            }))
            .sort((a, b) => b.p95 - a.p95)
            .slice(0, 10)

        // Get recent slow queries (last 50)
        const recentSlowQueries = await prisma.dbQueryEvent.findMany({
            where: {
                timestamp: { gte: startTime, lte: now },
                isSlow: true,
            },
            orderBy: { timestamp: 'desc' },
            take: 50,
            select: {
                id: true,
                timestamp: true,
                model: true,
                action: true,
                durationMs: true,
                success: true,
                recordCount: true,
                error: true,
            },
        })

        // Calculate totals
        const allDurations = events.map(e => e.durationMs)
        const totalSlowQueries = events.filter(e => e.isSlow).length
        const totalErrors = events.filter(e => !e.success).length
        
        const totals = {
            queries: events.length,
            slowQueries: totalSlowQueries,
            errors: totalErrors,
            slowRate: events.length > 0 ? (totalSlowQueries / events.length) * 100 : 0,
            errorRate: events.length > 0 ? (totalErrors / events.length) * 100 : 0,
            p50: percentile(allDurations, 50),
            p95: percentile(allDurations, 95),
            p99: percentile(allDurations, 99),
            avgDuration: allDurations.length > 0
                ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
                : 0,
        }

        // Get unique models for filtering UI
        const models = await prisma.dbQueryEvent.findMany({
            where: { timestamp: { gte: startTime } },
            select: { model: true },
            distinct: ['model'],
        })

        return jsonResponse({
            window,
            timeSeries,
            topOperations,
            slowestOperations,
            recentSlowQueries,
            totals,
            availableModels: models.map(m => m.model).sort(),
            timestamp: now.toISOString(),
        })
    } catch (error) {
        return serverErrorResponse('Error fetching DB metrics', error)
    }
}

