import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCronLogging } from '@/lib/cron-logger'
import { CRON_JOBS } from '@/lib/cron-jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const API_RETENTION_DAYS = 30
const DB_RETENTION_DAYS = 14

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const skipLogging = request.headers.get('x-skip-cron-logging') === 'true'
        const triggeredBy = request.headers.get('x-triggered-by') || 'scheduled'

        const executeJob = async () => {
            const now = new Date()
            const apiCutoff = new Date(now.getTime() - API_RETENTION_DAYS * 24 * 60 * 60 * 1000)
            const dbCutoff = new Date(now.getTime() - DB_RETENTION_DAYS * 24 * 60 * 60 * 1000)

            const [apiDeleted, dbDeleted] = await Promise.all([
                prisma.apiRequestEvent.deleteMany({
                    where: {
                        timestamp: {
                            lt: apiCutoff,
                        },
                    },
                }),
                prisma.dbQueryEvent.deleteMany({
                    where: {
                        timestamp: {
                            lt: dbCutoff,
                        },
                    },
                }),
            ])

            return {
                success: true,
                deleted: {
                    apiRequestEvents: apiDeleted.count,
                    dbQueryEvents: dbDeleted.count,
                },
                retentionDays: {
                    apiRequestEvents: API_RETENTION_DAYS,
                    dbQueryEvents: DB_RETENTION_DAYS,
                },
            }
        }

        if (skipLogging) {
            const result = await executeJob()
            return NextResponse.json(result)
        }

        const result = await withCronLogging(
            'observability-retention',
            triggeredBy,
            executeJob,
            {
                timeoutMs: CRON_JOBS['observability-retention'].timeoutMs,
                maxResultBytes: CRON_JOBS['observability-retention'].maxResultBytes,
            }
        )

        return NextResponse.json(result)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Observability retention cron job error:', error)
        return NextResponse.json(
            {
                success: false,
                error: message,
            },
            { status: 500 }
        )
    }
}
