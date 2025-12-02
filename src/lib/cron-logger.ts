/**
 * Cron Job Execution Logger
 * 
 * Helper functions to log cron job executions to the database
 */

import { prisma } from './prisma'
import { CronJobStatus } from '@prisma/client'

export interface CronJobResult {
    success: boolean
    message?: string
    data?: any
    error?: string
}

/**
 * Create a new cron job execution record
 */
export async function createCronExecution(
    jobName: string,
    triggeredBy: string = 'scheduled'
): Promise<string> {
    const execution = await prisma.cronJobExecution.create({
        data: {
            jobName,
            status: CronJobStatus.RUNNING,
            triggeredBy,
        },
    })
    return execution.id
}

/**
 * Update a cron job execution with completion status
 */
export async function updateCronExecution(
    executionId: string,
    status: CronJobStatus,
    result?: CronJobResult,
    error?: string
): Promise<void> {
    const startedAt = await prisma.cronJobExecution.findUnique({
        where: { id: executionId },
        select: { startedAt: true },
    })

    const durationMs = startedAt
        ? Date.now() - startedAt.startedAt.getTime()
        : null

    await prisma.cronJobExecution.update({
        where: { id: executionId },
        data: {
            status,
            completedAt: new Date(),
            durationMs,
            result: result ? result : undefined,
            error: error || undefined,
        },
    })
}

/**
 * Helper to wrap a cron job function with logging
 */
export async function withCronLogging<T>(
    jobName: string,
    triggeredBy: string,
    jobFn: () => Promise<T>
): Promise<T> {
    const executionId = await createCronExecution(jobName, triggeredBy)
    
    try {
        const result = await jobFn()
        await updateCronExecution(executionId, CronJobStatus.SUCCESS, {
            success: true,
            data: result,
        })
        return result
    } catch (error: any) {
        await updateCronExecution(executionId, CronJobStatus.FAILED, undefined, error.message)
        throw error
    }
}

