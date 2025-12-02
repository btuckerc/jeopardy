/**
 * Cron Jobs Configuration
 * 
 * Shared configuration for cron jobs used by admin APIs
 */

import { prisma } from './prisma'
import { CronJobStatus } from '@prisma/client'

// Default timeout for cron jobs (5 minutes)
export const DEFAULT_CRON_TIMEOUT_MS = 5 * 60 * 1000

// Known cron jobs configuration
export const CRON_JOBS = {
    'daily-challenge': {
        name: 'Daily Challenge Generation',
        description: 'Generates daily challenges for today and next 7 days',
        schedule: '0 2 * * *',
        endpoint: '/api/cron/daily-challenge',
        timeoutMs: 5 * 60 * 1000, // 5 minutes
    },
    'fetch-questions': {
        name: 'Fetch Questions',
        description: 'Fetches yesterday\'s Jeopardy questions from J-Archive',
        schedule: '0 9 * * *',
        endpoint: '/api/cron/fetch-questions',
        timeoutMs: 5 * 60 * 1000, // 5 minutes
    },
    'fetch-games': {
        name: 'Fetch Games',
        description: 'Fetches games for the last 7 days (internal cron)',
        schedule: '0 3 * * *',
        endpoint: null, // Internal cron job, no API endpoint
        timeoutMs: 10 * 60 * 1000, // 10 minutes (fetches multiple games)
    },
} as const

export type CronJobName = keyof typeof CRON_JOBS

/**
 * Clean up stuck/timed out cron job executions
 * Marks any RUNNING jobs that have exceeded their timeout as FAILED
 * 
 * @returns Number of jobs that were marked as timed out
 */
export async function cleanupTimedOutJobs(): Promise<number> {
    const now = new Date()
    let timedOutCount = 0

    // Check each job type for stuck executions
    for (const [jobName, config] of Object.entries(CRON_JOBS)) {
        const timeoutMs = config.timeoutMs || DEFAULT_CRON_TIMEOUT_MS
        const cutoffTime = new Date(now.getTime() - timeoutMs)

        // Find and update stuck jobs
        const result = await prisma.cronJobExecution.updateMany({
            where: {
                jobName,
                status: CronJobStatus.RUNNING,
                startedAt: {
                    lt: cutoffTime,
                },
            },
            data: {
                status: CronJobStatus.FAILED,
                completedAt: now,
                error: `Job timed out after ${Math.round(timeoutMs / 1000 / 60)} minutes`,
            },
        })

        if (result.count > 0) {
            console.log(`[Cron Cleanup] Marked ${result.count} stuck "${jobName}" job(s) as timed out`)
            timedOutCount += result.count
        }
    }

    return timedOutCount
}

