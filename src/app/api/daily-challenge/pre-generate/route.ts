import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { ensureOriginalDailyChallenge } from '../route'
import { z } from 'zod'

const preGenerateSchema = z.object({
    days: z.number().int().min(1).max(365).optional().default(90)
})

/**
 * POST /api/daily-challenge/pre-generate
 * Pre-generate daily challenges for the next N days
 * Can be called by admin users or cron jobs with CRON_SECRET
 */
export async function POST(request: Request) {
    try {
        // Check for cron secret first (for automated jobs)
        const authHeader = request.headers.get('authorization')
        const isCronRequest = authHeader === `Bearer ${process.env.CRON_SECRET}`

        // If not a cron request, require admin
        if (!isCronRequest) {
            const { requireAdmin } = await import('@/lib/api-utils')
            const { error: authError } = await requireAdmin()
            if (authError) return authError
        }

        const { data: body, error: parseError } = await parseBody(request, preGenerateSchema)
        if (parseError) return parseError

        const days = body?.days || 90
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let created = 0
        let skipped = 0
        let errors = 0
        const unfilledDates: string[] = []

        for (let i = 0; i < days; i++) {
            const targetDate = new Date(today)
            targetDate.setDate(targetDate.getDate() + i)
            targetDate.setHours(0, 0, 0, 0)
            const dateKey = targetDate.toISOString().split('T')[0]

            try {
                // Check if an ORIGINAL_ENGINE challenge already exists; rotate unplayed legacy rows
                const existing = await prisma.dailyChallenge.findUnique({
                    where: { date: targetDate },
                    include: {
                        question: { select: { source: true, publishStatus: true } },
                        _count: { select: { completions: true } },
                    },
                })

                if (
                    existing &&
                    (
                        (existing.question.source === 'ORIGINAL_ENGINE' && existing.question.publishStatus === 'PUBLISHED') ||
                        existing._count.completions > 0
                    )
                ) {
                    skipped++
                    continue
                }

                // Create or rotate challenge into published ORIGINAL_ENGINE pool
                const challenge = await ensureOriginalDailyChallenge(targetDate)
                
                if (
                    challenge &&
                    challenge.question.source === 'ORIGINAL_ENGINE' &&
                    challenge.question.publishStatus === 'PUBLISHED'
                ) {
                    created++
                } else {
                    errors++
                    unfilledDates.push(dateKey)
                }
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
                    // Unique constraint - challenge was created by another process
                    skipped++
                } else {
                    errors++
                    unfilledDates.push(dateKey)
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
                    console.error(`Error creating challenge for ${dateKey}:`, errorMsg)
                }
            }
        }

        return jsonResponse({
            success: errors === 0,
            created,
            skipped,
            errors,
            unfilledDates,
            daysProcessed: days
        })
    } catch (error) {
        return serverErrorResponse('Error pre-generating daily challenges', error)
    }
}

