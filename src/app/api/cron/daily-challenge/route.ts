/**
 * Cron Job: Generate Daily Challenges
 * 
 * Automatically generates daily challenges for today and the next 7 days.
 * Runs daily to ensure challenges are always available.
 * Uses CRON_SECRET for authentication (no admin required).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setupDailyChallenge } from '@/app/api/daily-challenge/route'
import { withCronLogging } from '@/lib/cron-logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for generating multiple challenges

export async function GET(request: Request) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        // Check if logging is already handled (from manual trigger)
        const skipLogging = request.headers.get('x-skip-cron-logging') === 'true'
        const triggeredBy = request.headers.get('x-triggered-by') || 'scheduled'

        const executeJob = async () => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Generate challenges for today + next 7 days (8 total)
            // This ensures we always have a buffer of challenges ready
            const daysToGenerate = 8
            let created = 0
            let skipped = 0
            let errors = 0
            const results: Array<{ 
                date: string; 
                status: string; 
                error?: string; 
                questionId?: string; 
                airDate?: string 
            }> = []

            // Generate challenges sequentially to ensure each sees the previous one's results
            for (let i = 0; i < daysToGenerate; i++) {
                const targetDate = new Date(today)
                targetDate.setDate(targetDate.getDate() + i)
                targetDate.setHours(0, 0, 0, 0)

                const dateStr = targetDate.toISOString().split('T')[0]

                try {
                    // Check if challenge already exists
                    const existing = await prisma.dailyChallenge.findUnique({
                        where: { date: targetDate },
                        include: {
                            question: {
                                select: {
                                    id: true,
                                    airDate: true
                                }
                            }
                        }
                    })

                    if (existing) {
                        skipped++
                        results.push({ 
                            date: dateStr, 
                            status: 'skipped',
                            questionId: existing.questionId,
                            airDate: existing.question?.airDate?.toISOString().split('T')[0]
                        })
                        console.log(`[Cron] Challenge already exists for ${dateStr}: questionId=${existing.questionId}`)
                        continue
                    }

                    // Create challenge (setupDailyChallenge handles retries internally and excludes used questions)
                    const challenge = await setupDailyChallenge(targetDate)

                    if (challenge) {
                        created++
                        results.push({ 
                            date: dateStr, 
                            status: 'created',
                            questionId: challenge.questionId,
                            airDate: challenge.question?.airDate?.toISOString().split('T')[0]
                        })
                        console.log(`[Cron] ✓ Created challenge for ${dateStr}: questionId=${challenge.questionId}, airDate=${challenge.question?.airDate?.toISOString().split('T')[0]}`)
                        
                        // Small delay to ensure database consistency between sequential calls
                        // This helps ensure the next iteration sees the question we just used
                        if (i < daysToGenerate - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100))
                        }
                    } else {
                        errors++
                        results.push({ date: dateStr, status: 'error', error: 'Failed to create challenge' })
                        console.error(`[Cron] ✗ Failed to create challenge for ${dateStr}`)
                    }
                } catch (error: unknown) {
                    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
                        // Unique constraint - challenge was created by another process (race condition)
                        // Try to fetch the existing challenge to log its details
                        try {
                            const existing = await prisma.dailyChallenge.findUnique({
                                where: { date: targetDate },
                                include: {
                                    question: {
                                        select: {
                                            id: true,
                                            airDate: true
                                        }
                                    }
                                }
                            })
                            skipped++
                            results.push({ 
                                date: dateStr, 
                                status: 'skipped', 
                                error: 'Race condition',
                                questionId: existing?.questionId,
                                airDate: existing?.question?.airDate?.toISOString().split('T')[0]
                            })
                            console.log(`[Cron] Race condition detected for ${dateStr}, challenge exists: questionId=${existing?.questionId}`)
                        } catch {
                            skipped++
                            results.push({ date: dateStr, status: 'skipped', error: 'Race condition' })
                        }
                    } else {
                        errors++
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
                        results.push({ date: dateStr, status: 'error', error: errorMsg })
                        console.error(`[Cron] Error creating challenge for ${dateStr}:`, error)
                    }
                }
            }

            return {
                success: true,
                message: `Generated daily challenges: ${created} created, ${skipped} skipped, ${errors} errors`,
                created,
                skipped,
                errors,
                results
            }
        }

        // Wrap with logging if not already handled
        if (skipLogging) {
            const result = await executeJob()
            return NextResponse.json(result)
        } else {
            const result = await withCronLogging('daily-challenge', triggeredBy, executeJob)
            return NextResponse.json(result)
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Cron job error:', error)
        return NextResponse.json(
            {
                success: false,
                error: message
            },
            { status: 500 }
        )
    }
}

