/**
 * Admin API: Cron Jobs Management
 * 
 * List cron job executions and get status
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/clerk-auth'
import { CRON_JOBS, cleanupTimedOutJobs } from '@/lib/cron-jobs'
import { Prisma, CronJobStatus, CronJobExecution } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/cron-jobs
 * List cron job executions
 */
export async function GET(request: Request) {
    try {
        // Verify admin access
        const user = await isAdmin()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Clean up any timed out jobs before fetching status
        const timedOutCount = await cleanupTimedOutJobs()

        const { searchParams } = new URL(request.url)
        const jobName = searchParams.get('jobName')
        const limit = parseInt(searchParams.get('limit') || '50')
        const status = searchParams.get('status')

        const where: Prisma.CronJobExecutionWhereInput = {}
        if (jobName) {
            where.jobName = jobName
        }
        if (status && Object.values(CronJobStatus).includes(status as CronJobStatus)) {
            where.status = status as CronJobStatus
        }

        const executions = await prisma.cronJobExecution.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            take: limit,
        })

        // Get summary stats
        const stats = await prisma.cronJobExecution.groupBy({
            by: ['jobName', 'status'],
            _count: true,
        })

        // Get latest execution for each job
        const latestExecutions = await Promise.all(
            Object.keys(CRON_JOBS).map(async (jobName) => {
                const latest = await prisma.cronJobExecution.findFirst({
                    where: { jobName },
                    orderBy: { startedAt: 'desc' },
                })
                return { jobName, latest }
            })
        )

        return NextResponse.json({
            executions,
            stats: stats.reduce((acc, stat) => {
                const key = `${stat.jobName}:${stat.status}`
                acc[key] = stat._count
                return acc
            }, {} as Record<string, number>),
            latestExecutions: latestExecutions.reduce((acc, { jobName, latest }) => {
                acc[jobName] = latest
                return acc
            }, {} as Record<string, CronJobExecution | null>),
            jobs: CRON_JOBS,
            timedOutCount, // Include count of jobs that were just cleaned up
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch cron jobs'
        console.error('Error fetching cron jobs:', error)
        return NextResponse.json(
            { error: message },
            { status: 500 }
        )
    }
}

