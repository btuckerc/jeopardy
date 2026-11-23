import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { getGuestConfig, createGuestSession } from '@/lib/guest-sessions'
import { evaluateAnswerWithOverridesAsync, getQuestionOverrides } from '@/lib/answer-overrides'
import { getActiveChallengeDate, getDailyChallengeDateKey } from '@/lib/daily-challenge-utils'
import { getPlayableQuestionWhere } from '@/lib/question-policy'

/**
 * GET /api/daily-challenge
 * Get today's daily challenge (Final Jeopardy question from historical games)
 */
export const GET = withInstrumentation(async (_request: NextRequest) => {
    try {
        // Get the active challenge date (based on 9AM ET boundary)
        const challengeDate = getActiveChallengeDate()
        const user = await getAppUser()
        const isAdmin = user?.role === 'ADMIN'

        // Resolve or rotate today's challenge so pre-generated unplayed legacy rows are replaced
        const challenge = await ensureOriginalDailyChallenge(challengeDate)

        if (!challenge) {
            return jsonResponse({ error: 'Failed to setup daily challenge' }, 500)
        }

        // Get user's answer if authenticated
        let userAnswer = null
        if (user) {
            const userChallenge = await prisma.userDailyChallenge.findUnique({
                where: {
                    userId_challengeId: {
                        userId: user.id,
                        challengeId: challenge.id
                    }
                }
            })
            if (userChallenge) {
                userAnswer = {
                    correct: userChallenge.correct,
                    completedAt: userChallenge.completedAt,
                    userAnswerText: userChallenge.userAnswer || null
                }
            }
        }

        // If a mid-day legacy challenge had prior completions and therefore stayed anchored for those
        // participants, do not expose the legacy clue to new non-admin participants without completions.
        if (
            !isAdmin &&
            !userAnswer &&
            (challenge.question.source !== 'ORIGINAL_ENGINE' || challenge.question.publishStatus !== 'PUBLISHED')
        ) {
            return jsonResponse(
                {
                    error: 'Today\'s daily challenge is transitioning to the Original question bank. Please check back at the next daily reset.',
                    legacyTransition: true,
                },
                503
            )
        }

        // Get guest config to include in response
        const guestConfig = await getGuestConfig()

        return jsonResponse({
            id: challenge.id,
            date: getDailyChallengeDateKey(challenge.date),
            question: {
                id: challenge.question.id,
                question: challenge.question.question,
                answer: challenge.question.answer,
                category: challenge.question.category.name,
                airDate: challenge.question.airDate,
                source: challenge.question.source,
            },
            userAnswer,
            guestConfig: {
                guestEnabled: guestConfig.dailyChallengeGuestEnabled,
                guestAppearsOnLeaderboard: guestConfig.dailyChallengeGuestAppearsOnLeaderboard
            }
        })
    } catch (error) {
        return serverErrorResponse('Error fetching daily challenge', error)
    }
})

/**
 * POST /api/daily-challenge
 * Submit answer for today's daily challenge
 */
const submitAnswerSchema = z.object({
    answer: z.string().min(1)
})

export const POST = withInstrumentation(async (request: NextRequest) => {
    try {
        const user = await getAppUser()
        const guestConfig = await getGuestConfig()
        
        // Check if guest participation is enabled
        const isGuest = !user
        if (isGuest && !guestConfig.dailyChallengeGuestEnabled) {
            return jsonResponse({
                error: 'Authentication required for daily challenge',
                requiresAuth: true
            }, 401)
        }

        const { data: body, error } = await parseBody(request, submitAnswerSchema)
        if (error) return error

        // Get the active challenge date (based on 9AM ET boundary)
        const challengeDate = getActiveChallengeDate()

        // Ensure today's challenge is an active ORIGINAL_ENGINE challenge (rotating unplayed pre-generated legacy rows)
        const challenge = await ensureOriginalDailyChallenge(challengeDate)

        if (!challenge) {
            return jsonResponse({ error: 'Daily challenge not available' }, 404)
        }

        if (
            user?.role !== 'ADMIN' &&
            (challenge.question.source !== 'ORIGINAL_ENGINE' || challenge.question.publishStatus !== 'PUBLISHED')
        ) {
            return jsonResponse(
                { error: 'Today\'s legacy daily challenge is closed to new submissions.' },
                410
            )
        }

        // Check answer using override-aware checking (including engine-verified acceptableAnswers)
        const overrides = await getQuestionOverrides(challenge.questionId)
        const grading = await evaluateAnswerWithOverridesAsync(
            body.answer,
            challenge.question.answer,
            overrides,
            challenge.question.acceptableAnswers
        )
        const correct = grading.accepted

        // Handle guest vs authenticated user differently
        if (isGuest) {
            // Create guest session for later claim
            const session = await createGuestSession('DAILY_CHALLENGE', {
                challengeId: challenge.id,
                questionId: challenge.questionId,
                correct,
                userAnswer: body.answer,
                timestamp: new Date().toISOString()
            })

            return jsonResponse({
                correct,
                grading,
                answer: challenge.question.answer,
                guestSessionId: session.id,
                expiresAt: session.expiresAt.toISOString(),
                requiresAuth: true,
                message: 'Sign in to save your answer and appear on the leaderboard'
            })
        }

        // Authenticated user flow
        // Check if user already answered
        const existingAnswer = await prisma.userDailyChallenge.findUnique({
            where: {
                userId_challengeId: {
                    userId: user!.id,
                    challengeId: challenge.id
                }
            }
        })

        if (existingAnswer) {
            return jsonResponse({
                correct: existingAnswer.correct,
                alreadyAnswered: true
            })
        }

        // Save answer
        await prisma.userDailyChallenge.create({
            data: {
                userId: user!.id,
                challengeId: challenge.id,
                correct,
                userAnswer: body.answer
            }
        })

        // Check for achievements
        const newlyUnlocked = await checkAndUnlockAchievements(user!.id, {
            type: 'daily_challenge_completed',
            data: { challengeId: challenge.id, correct }
        })

        return jsonResponse({
            correct,
            grading,
            answer: challenge.question.answer,
            unlockedAchievements: newlyUnlocked.length > 0 ? newlyUnlocked : undefined
        })
    } catch (error) {
        return serverErrorResponse('Error submitting daily challenge answer', error)
    }
})

/**
 * Ensure the DailyChallenge for `challengeDate` points to a published ORIGINAL_ENGINE clue.
 * If a pre-generated LEGACY_JEOPARDY row exists with zero user completions, rotate it in place.
 */
export async function ensureOriginalDailyChallenge(challengeDate: Date) {
    const existing = await prisma.dailyChallenge.findUnique({
        where: { date: challengeDate },
        include: {
            question: { include: { category: true } },
            _count: { select: { completions: true } },
        },
    })

    if (existing) {
        if (existing.question.source === 'ORIGINAL_ENGINE' && existing.question.publishStatus === 'PUBLISHED') {
            return existing
        }
        if (existing._count.completions === 0) {
            const rotated = await setupDailyChallenge(challengeDate, 5, existing.id)
            if (rotated) return rotated
        }
        return existing
    }

    try {
        const created = await setupDailyChallenge(challengeDate)
        if (created) return created
    } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) {
            console.error('Error setting up daily challenge:', error)
        }
    }

    return prisma.dailyChallenge.findUnique({
        where: { date: challengeDate },
        include: { question: { include: { category: true } } },
    })
}

/**
 * Setup daily challenge for a given date.
 * Selects an unused published ORIGINAL_ENGINE FINAL question deterministically by date
 * (gracefully falling back to unused HARD ORIGINAL_ENGINE clues if FINAL inventory runs low).
 * Never scrapes J-Archive.
 */
export async function setupDailyChallenge(date: Date, maxRetries: number = 5, replaceChallengeId?: string) {
    const dateString = date.toISOString().split('T')[0]

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Step 1: Collect globally used daily challenge question IDs
            const usedQuestionIds = await prisma.dailyChallenge.findMany({
                select: { questionId: true },
                distinct: ['questionId']
            })
            const usedIds = usedQuestionIds.map(c => c.questionId)

            const finalWhere = {
                ...getPlayableQuestionWhere('ORIGINAL_ENGINE'),
                round: 'FINAL' as const,
                ...(usedIds.length > 0 ? { id: { notIn: usedIds } } : {})
            }

            let eligibleWhere: Record<string, unknown> = finalWhere
            let eligibleCount = await prisma.question.count({ where: finalWhere })

            if (eligibleCount === 0) {
                console.warn(`[Daily Challenge ${dateString}] Unused ORIGINAL_ENGINE FINAL pool exhausted; falling back to unused HARD ORIGINAL_ENGINE clues`)
                const hardWhere = {
                    ...getPlayableQuestionWhere('ORIGINAL_ENGINE'),
                    difficulty: 'HARD' as const,
                    ...(usedIds.length > 0 ? { id: { notIn: usedIds } } : {})
                }
                eligibleCount = await prisma.question.count({ where: hardWhere })
                eligibleWhere = hardWhere
            }

            if (eligibleCount === 0) {
                console.warn(`[Daily Challenge ${dateString}] Unused ORIGINAL_ENGINE FINAL+HARD pool exhausted; falling back to unused MEDIUM/EASY ORIGINAL_ENGINE clues`)
                for (const fallbackDiff of ['MEDIUM', 'EASY'] as const) {
                    const fallbackWhere = {
                        ...getPlayableQuestionWhere('ORIGINAL_ENGINE'),
                        difficulty: fallbackDiff,
                        ...(usedIds.length > 0 ? { id: { notIn: usedIds } } : {})
                    }
                    eligibleCount = await prisma.question.count({ where: fallbackWhere })
                    if (eligibleCount > 0) {
                        eligibleWhere = fallbackWhere
                        break
                    }
                }
            }

            if (eligibleCount === 0) {
                console.error(`[Daily Challenge ${dateString}] No unused published ORIGINAL_ENGINE questions available`)
                return null
            }

            // Step 2: Deterministic offset from date string + attempt
            const seed = dateString.split('-').reduce((acc, val) => acc * 31 + parseInt(val, 10), 7)
            const skipIndex = Math.abs(seed + attempt) % eligibleCount

            const finalQuestion = await prisma.question.findFirst({
                where: eligibleWhere,
                orderBy: { id: 'asc' },
                skip: skipIndex,
                include: {
                    category: true
                }
            })

            if (!finalQuestion) {
                continue
            }

            // Step 3: Persist or atomically rotate daily challenge
            let challenge
            if (replaceChallengeId) {
                challenge = await prisma.$transaction(async (tx) => {
                    const current = await tx.dailyChallenge.findUnique({
                        where: { id: replaceChallengeId },
                        include: {
                            question: { include: { category: true } },
                            _count: { select: { completions: true } },
                        },
                    })
                    if (!current) return null
                    if (
                        current.question.source === 'ORIGINAL_ENGINE' &&
                        current.question.publishStatus === 'PUBLISHED'
                    ) {
                        return current
                    }
                    // Never rotate in place if any authenticated completion OR unclaimed guest attempt exists
                    const pendingGuestSessions = await tx.$queryRaw<Array<{ cnt: bigint }>>`
                        SELECT COUNT(*)::bigint as cnt
                        FROM "GuestSession"
                        WHERE "type" = 'DAILY_CHALLENGE'
                          AND "claimedAt" IS NULL
                          AND "expiresAt" > NOW()
                          AND "data"->>'challengeId' = ${replaceChallengeId}
                    `
                    if (current._count.completions > 0 || Number(pendingGuestSessions[0]?.cnt || 0) > 0) {
                        return current
                    }

                    const updatedRows = await tx.$executeRaw`
                        UPDATE "DailyChallenge" dc
                        SET "questionId" = ${finalQuestion.id},
                            "airDate" = ${finalQuestion.airDate},
                            "episodeGameId" = ${finalQuestion.episodeId}
                        WHERE dc."id" = ${replaceChallengeId}
                          AND NOT EXISTS (
                              SELECT 1 FROM "UserDailyChallenge" udc WHERE udc."challengeId" = dc."id"
                          )
                    `
                    if (Number(updatedRows) === 0) {
                        return tx.dailyChallenge.findUnique({
                            where: { id: replaceChallengeId },
                            include: { question: { include: { category: true } } },
                        })
                    }
                    return tx.dailyChallenge.findUnique({
                        where: { id: replaceChallengeId },
                        include: { question: { include: { category: true } } },
                    })
                })
                if (!challenge) return null
            } else {
                challenge = await prisma.dailyChallenge.create({
                    data: {
                        date,
                        questionId: finalQuestion.id,
                        airDate: finalQuestion.airDate,
                        episodeGameId: finalQuestion.episodeId
                    },
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                })
            }

            console.log(`[Daily Challenge ${dateString}] ✓ ${replaceChallengeId ? 'Rotated' : 'Created'} original challenge: questionId=${challenge.questionId}`)
            return challenge
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
                const prismaError = error as { code: string; meta?: { target?: string[] } }
                const constraint = prismaError.meta?.target
                const conflictingField = prismaError.meta?.target?.[0]

                if (constraint?.includes('questionId') || conflictingField === 'questionId') {
                    console.warn(`[Daily Challenge ${dateString}] Attempt ${attempt + 1} hit used questionId; retrying...`)
                    if (attempt < maxRetries - 1) {
                        continue
                    }
                    return null
                } else if (constraint?.includes('date') || conflictingField === 'date') {
                    return await prisma.dailyChallenge.findUnique({
                        where: { date },
                        include: {
                            question: {
                                include: {
                                    category: true
                                }
                            }
                        }
                    })
                }
            }

            console.error(`[Daily Challenge ${dateString}] Error on attempt ${attempt + 1}:`, error)
            if (attempt === maxRetries - 1) {
                return null
            }
        }
    }

    return null
}
