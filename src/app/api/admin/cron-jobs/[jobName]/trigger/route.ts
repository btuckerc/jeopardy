/**
 * Admin API: Trigger Cron Job Manually
 * 
 * Manually trigger a cron job execution
 */

import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/clerk-auth'
import { CRON_JOBS, CronJobName } from '@/lib/cron-jobs'
import { withCronLogging } from '@/lib/cron-logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/cron-jobs/[jobName]/trigger
 * Manually trigger a cron job
 */
export async function POST(
    request: Request,
    { params }: { params: { jobName: string } }
) {
    try {
        // Verify admin access
        const user = await getAppUser()
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { jobName } = params

        // Validate job name
        if (!(jobName in CRON_JOBS)) {
            return NextResponse.json(
                { error: `Unknown cron job: ${jobName}` },
                { status: 400 }
            )
        }

        const job = CRON_JOBS[jobName as CronJobName]

        // Check if job has an API endpoint
        if (!job.endpoint) {
            return NextResponse.json(
                { error: `Job ${jobName} cannot be triggered manually (internal cron only)` },
                { status: 400 }
            )
        }

        // Trigger the cron job
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret) {
            return NextResponse.json(
                { error: 'CRON_SECRET not configured' },
                { status: 500 }
            )
        }

        const result = await withCronLogging(
            jobName,
            user.id, // Store admin user ID as triggeredBy
            async () => {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
                
                const response = await fetch(`${baseUrl}${job.endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cronSecret}`,
                        'x-skip-cron-logging': 'true', // Prevent double logging
                        'x-triggered-by': user.id,
                    },
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`Cron job failed: ${response.status} ${errorText}`)
                }

                return await response.json()
            }
        )

        return NextResponse.json({
            success: true,
            message: `Cron job ${jobName} triggered successfully`,
            result,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to trigger cron job'
        console.error(`Error triggering cron job ${params.jobName}:`, error)
        return NextResponse.json(
            {
                success: false,
                error: message,
            },
            { status: 500 }
        )
    }
}

