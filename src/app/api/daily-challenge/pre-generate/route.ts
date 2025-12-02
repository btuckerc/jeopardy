import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { setupDailyChallenge } from '../route'
import { z } from 'zod'
import { NextResponse } from 'next/server'

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

        for (let i = 0; i < days; i++) {
            const targetDate = new Date(today)
            targetDate.setDate(targetDate.getDate() + i)
            targetDate.setHours(0, 0, 0, 0)

            try {
                // Check if challenge already exists
                const existing = await prisma.dailyChallenge.findUnique({
                    where: { date: targetDate }
                })

                if (existing) {
                    skipped++
                    continue
                }

                // Create challenge
                const challenge = await setupDailyChallenge(targetDate)
                
                if (challenge) {
                    created++
                } else {
                    errors++
                }
            } catch (error: any) {
                if (error.code === 'P2002') {
                    // Unique constraint - challenge was created by another process
                    skipped++
                } else {
                    errors++
                    console.error(`Error creating challenge for ${targetDate.toISOString().split('T')[0]}:`, error)
                }
            }
        }

        return jsonResponse({
            success: true,
            created,
            skipped,
            errors,
            daysProcessed: days
        })
    } catch (error) {
        return serverErrorResponse('Error pre-generating daily challenges', error)
    }
}

