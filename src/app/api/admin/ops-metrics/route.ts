import { jsonResponse, serverErrorResponse, requireAdmin, parseSearchParams } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { CRON_JOBS } from '@/lib/cron-jobs'
import { CronJobStatus } from '@prisma/client'
import { z } from 'zod'
import { getErrorCountsByBucket, getErrorCountsByStatus } from '@/lib/api-instrumentation'

export const dynamic = 'force-dynamic'

const opsMetricsParamsSchema = z.object({
    window: z.enum(['24h', '7d', '14d', '30d']).optional().default('24h')
})

/**
 * GET /api/admin/ops-metrics
 * Get operational metrics for admin dashboard (cron jobs, disputes, API errors, etc.)
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, opsMetricsParamsSchema)
        
        if (error) return error

        const { window } = params
        const now = new Date()
        
        // Calculate start time based on window
        let startTime: Date
        let bucketMs: number
        
        switch (window) {
            case '24h':
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                bucketMs = 60 * 60 * 1000 // 1 hour buckets
                break
            case '7d':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // 1 day buckets
                break
            case '14d':
                startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // 1 day buckets
                break
            case '30d':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                bucketMs = 24 * 60 * 60 * 1000 // 1 day buckets
                break
        }
        
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        // Get cron job executions
        const cronExecutions = await prisma.cronJobExecution.findMany({
            where: {
                startedAt: { gte: dayAgo }
            },
            orderBy: {
                startedAt: 'desc'
            }
        })

        // Get all cron job executions grouped by job name
        const allCronExecutions = await prisma.cronJobExecution.findMany({
            orderBy: {
                startedAt: 'desc'
            },
            take: 1000 // Limit to recent executions
        })

        // Group executions by job name
        const executionsByJob = new Map<string, typeof allCronExecutions>()
        allCronExecutions.forEach(exec => {
            if (!executionsByJob.has(exec.jobName)) {
                executionsByJob.set(exec.jobName, [])
            }
            executionsByJob.get(exec.jobName)!.push(exec)
        })

        // Calculate metrics for each cron job
        const cronJobMetrics = Object.keys(CRON_JOBS).map(jobName => {
            const config = CRON_JOBS[jobName as keyof typeof CRON_JOBS]
            const executions = executionsByJob.get(jobName) || []
            const recentExecutions = executions.filter(e => e.startedAt >= dayAgo)
            
            const successful = executions.filter(e => e.status === CronJobStatus.SUCCESS)
            const failed = executions.filter(e => e.status === CronJobStatus.FAILED)
            const running = executions.filter(e => e.status === CronJobStatus.RUNNING)
            
            const recentSuccessful = recentExecutions.filter(e => e.status === CronJobStatus.SUCCESS)
            const recentFailed = recentExecutions.filter(e => e.status === CronJobStatus.FAILED)
            
            const lastExecution = executions[0] || null
            const lastSuccess = successful[0] || null
            const lastFailure = failed[0] || null
            
            // Calculate average duration for successful jobs
            const successfulWithDuration = successful.filter(e => e.durationMs !== null)
            const avgDuration = successfulWithDuration.length > 0
                ? successfulWithDuration.reduce((sum, e) => sum + (e.durationMs || 0), 0) / successfulWithDuration.length
                : null

            return {
                jobName,
                displayName: config.name,
                description: config.description,
                schedule: config.schedule,
                lastExecution: lastExecution ? {
                    status: lastExecution.status,
                    startedAt: lastExecution.startedAt.toISOString(),
                    completedAt: lastExecution.completedAt?.toISOString() || null,
                    durationMs: lastExecution.durationMs,
                    error: lastExecution.error
                } : null,
                lastSuccess: lastSuccess ? {
                    startedAt: lastSuccess.startedAt.toISOString(),
                    completedAt: lastSuccess.completedAt?.toISOString() || null,
                    durationMs: lastSuccess.durationMs
                } : null,
                lastFailure: lastFailure ? {
                    startedAt: lastFailure.startedAt.toISOString(),
                    completedAt: lastFailure.completedAt?.toISOString() || null,
                    error: lastFailure.error
                } : null,
                stats: {
                    total: executions.length,
                    successful: successful.length,
                    failed: failed.length,
                    running: running.length,
                    recentSuccessful: recentSuccessful.length,
                    recentFailed: recentFailed.length,
                    avgDurationMs: avgDuration ? Math.round(avgDuration) : null
                },
                health: running.length > 0 ? 'running' : 
                       // Only unhealthy if last execution failed AND there's no recent success
                       (lastExecution?.status === CronJobStatus.FAILED && 
                        (!lastSuccess || lastFailure!.startedAt > lastSuccess.startedAt) &&
                        recentSuccessful.length === 0) ? 'unhealthy' :
                       'healthy'
            }
        })

        // Get pending disputes count
        const pendingDisputes = await prisma.answerDispute.count({
            where: {
                status: 'PENDING'
            }
        })

        // Get recent disputes (last 24h)
        const recentDisputes = await prisma.answerDispute.count({
            where: {
                createdAt: { gte: dayAgo }
            }
        })

        // Get API error metrics (now from database)
        const [errorCountsByStatus, errorCountsByBucket] = await Promise.all([
            getErrorCountsByStatus(startTime, now),
            getErrorCountsByBucket(startTime, now, bucketMs)
        ])
        
        // Build time-series for errors
        const errorTimeSeries: Array<{ timestamp: string; status404: number; status500: number; other4xx: number; other5xx: number }> = []
        const buckets: string[] = []
        let currentTime = new Date(startTime)
        while (currentTime <= now) {
            const bucketKey = bucketMs === 60 * 60 * 1000
                ? `${currentTime.toISOString().slice(0, 13)}:00:00`
                : currentTime.toISOString().slice(0, 10)
            buckets.push(bucketKey)
            currentTime = new Date(currentTime.getTime() + bucketMs)
        }
        
        buckets.forEach(bucketKey => {
            const bucketErrors = errorCountsByBucket.get(bucketKey) || new Map<number, number>()
            const status404 = bucketErrors.get(404) || 0
            const status500 = bucketErrors.get(500) || 0
            const other4xx = Array.from(bucketErrors.entries())
                .filter(([status]) => status >= 400 && status < 500 && status !== 404)
                .reduce((sum, [, count]) => sum + count, 0)
            const other5xx = Array.from(bucketErrors.entries())
                .filter(([status]) => status >= 500 && status !== 500)
                .reduce((sum, [, count]) => sum + count, 0)
            
            errorTimeSeries.push({
                timestamp: bucketKey,
                status404,
                status500,
                other4xx,
                other5xx
            })
        })
        
        // Calculate error totals
        const errorTotals = {
            status404: errorCountsByStatus.get(404) || 0,
            status500: errorCountsByStatus.get(500) || 0,
            other4xx: Array.from(errorCountsByStatus.entries())
                .filter(([status]) => status >= 400 && status < 500 && status !== 404)
                .reduce((sum, [, count]) => sum + count, 0),
            other5xx: Array.from(errorCountsByStatus.entries())
                .filter(([status]) => status >= 500 && status !== 500)
                .reduce((sum, [, count]) => sum + count, 0),
            total: Array.from(errorCountsByStatus.values()).reduce((sum, count) => sum + count, 0)
        }

        // Calculate overall health
        const unhealthyJobs = cronJobMetrics.filter(job => job.health === 'unhealthy')
        const runningJobs = cronJobMetrics.filter(job => job.health === 'running')
        const overallHealth = unhealthyJobs.length > 0 ? 'unhealthy' :
                             runningJobs.length > 0 ? 'running' :
                             errorTotals.status500 > 10 ? 'degraded' : // More than 10 500 errors
                             'healthy'

        return jsonResponse({
            cronJobs: cronJobMetrics,
            disputes: {
                pending: pendingDisputes,
                recent24h: recentDisputes
            },
            apiErrors: {
                timeSeries: errorTimeSeries,
                totals: errorTotals,
                window
            },
            overallHealth,
            timestamp: now.toISOString()
        })
    } catch (error) {
        return serverErrorResponse('Error fetching operational metrics', error)
    }
}

