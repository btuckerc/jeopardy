/**
 * Cron Job Execution Logger
 * 
 * Helper functions to log cron job executions to the database
 */

import { prisma } from './prisma'
import { CronJobStatus, Prisma } from '@prisma/client'
import { cleanupTimedOutJobs } from './cron-jobs'

export interface CronJobResult {
    success: boolean
    message?: string
    data?: unknown
    error?: string
}

export interface CronJobLoggingOptions {
    timeoutMs?: number
    maxResultBytes?: number
}

function clampResultBytes(value: number): number {
    return Math.max(256, Math.min(value, 20_000))
}

function truncateResult(result: unknown, maxBytes: number): Prisma.InputJsonValue | null {
    if (result == null) {
        return null as unknown as Prisma.InputJsonValue
    }

    const serialized = JSON.stringify(result)
    if (!serialized || serialized.length <= maxBytes) {
        return result as Prisma.InputJsonValue
    }

    return {
        ...(typeof result === 'object' && result !== null
            ? { ...(result as Record<string, unknown>) }
            : {}),
        success: false,
        _truncated: true,
        _resultBytes: serialized.length,
        _maxResultBytes: maxBytes,
        message: 'Cron result truncated to fit storage budget',
    } as Prisma.InputJsonValue
}

function executeWithTimeout<T>(jobFn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
        return jobFn()
    }

    return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Cron job timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        jobFn().then(
            value => {
                clearTimeout(timeoutId)
                resolve(value)
            },
            error => {
                clearTimeout(timeoutId)
                reject(error)
            }
        )
    })
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
            result: result ? (result as unknown as Prisma.InputJsonValue) : undefined,
            error: error || undefined,
        },
    })
}

/**
 * Helper to wrap a cron job function with logging
 * Automatically cleans up any timed out jobs before starting
 */
export async function withCronLogging<T>(
    jobName: string,
    triggeredBy: string,
    jobFn: () => Promise<T>,
    options: CronJobLoggingOptions = {}
): Promise<T> {
    const timeoutMs = options.timeoutMs
    const maxResultBytes = clampResultBytes(options.maxResultBytes ?? 2048)

    // Clean up any timed out jobs before starting a new execution
    try {
        await cleanupTimedOutJobs()
    } catch (e) {
        // Don't fail the job if cleanup fails
        console.error('[Cron] Error cleaning up timed out jobs:', e)
    }

    const executionId = await createCronExecution(jobName, triggeredBy)
    
    try {
        const result = await executeWithTimeout(jobFn, timeoutMs)
        await updateCronExecution(executionId, CronJobStatus.SUCCESS, {
            success: true,
            data: truncateResult(result, maxResultBytes),
        })
        return result
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await updateCronExecution(executionId, CronJobStatus.FAILED, undefined, message)
        throw error
    }
}
