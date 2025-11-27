import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { z } from 'zod'
import { normalizeAnswerForOverride } from '@/lib/answer-overrides'
import { getStatsPoints } from '@/lib/scoring'
import crypto from 'crypto'

interface RouteParams {
    params: Promise<{ id: string }>
}

const approveDisputeSchema = z.object({
    adminComment: z.string().optional(),
    overrideText: z.string().optional() // Optional: admin can tweak the normalized text
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/disputes/[id]/approve
 * Approve a dispute, create an answer override, and retroactively fix stats
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        // Check admin role
        if (appUser.role !== 'ADMIN') {
            return forbiddenResponse('Admin access required')
        }

        const { id } = await params

        const { data: body, error } = await parseBody(request, approveDisputeSchema)
        if (error) return error

        const { adminComment, overrideText } = body

        // Get the dispute
        const dispute = await prisma.answerDispute.findUnique({
            where: { id },
            include: {
                question: {
                    include: {
                        category: true
                    }
                },
                user: {
                    select: {
                        id: true
                    }
                }
            }
        })

        if (!dispute) {
            return notFoundResponse('Dispute not found')
        }

        if (dispute.status !== 'PENDING') {
            return badRequestResponse('Dispute has already been resolved')
        }

        // Normalize the override text (use provided text or dispute's userAnswer)
        const normalizedOverrideText = overrideText 
            ? normalizeAnswerForOverride(overrideText)
            : normalizeAnswerForOverride(dispute.userAnswer)

        // Process approval in a transaction
        await prisma.$transaction(async (tx) => {
            // Create or find existing override
            let override = await tx.answerOverride.findUnique({
                where: {
                    questionId_text: {
                        questionId: dispute.questionId,
                        text: normalizedOverrideText
                    }
                }
            })

            if (!override) {
                override = await tx.answerOverride.create({
                    data: {
                        questionId: dispute.questionId,
                        text: normalizedOverrideText,
                        createdByUserId: appUser.id,
                        source: 'DISPUTE',
                        notes: adminComment || null
                    }
                })
            }

            // Update dispute status
            await tx.answerDispute.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    adminId: appUser.id,
                    adminComment: adminComment || null,
                    overrideId: override.id,
                    resolvedAt: new Date()
                }
            })

            // Retroactively fix stats
            // Find all GameHistory entries for this user/question that were marked incorrect
            // but would now be correct with the override
            const incorrectHistories = await tx.gameHistory.findMany({
                where: {
                    userId: dispute.userId,
                    questionId: dispute.questionId,
                    correct: false
                },
                orderBy: { timestamp: 'asc' }
            })

            // Re-grade each incorrect history entry
            // We'll need to import checkAnswer with overrides support
            const { checkAnswer } = await import('@/app/lib/answer-checker')
            const { getQuestionOverrides } = await import('@/lib/answer-overrides')
            
            const allOverrides = await getQuestionOverrides(dispute.questionId)
            const overrideTexts = allOverrides.map(o => o.text)

            for (const history of incorrectHistories) {
                // Only re-grade if we have the userAnswer stored
                if (history.userAnswer) {
                    const wouldBeCorrect = checkAnswer(
                        history.userAnswer,
                        dispute.question.answer,
                        overrideTexts
                    )

                    if (wouldBeCorrect) {
                        // Calculate points based on round and question value
                        const questionValue = dispute.question.value || 200
                        const statsPoints = getStatsPoints({
                            round: dispute.question.round,
                            faceValue: questionValue,
                            correct: true
                        })

                        // Update GameHistory
                        await tx.gameHistory.update({
                            where: { id: history.id },
                            data: {
                                correct: true,
                                points: statsPoints
                            }
                        })
                    }
                }
            }

            // Also check if the dispute's specific userAnswer would now be correct
            // and update any matching GameHistory entries
            const wouldBeCorrectForDispute = checkAnswer(
                dispute.userAnswer,
                dispute.question.answer,
                overrideTexts
            )

            if (wouldBeCorrectForDispute) {
                // Find GameHistory entries that match this dispute's context
                // (same user, question, and approximate timestamp)
                const disputeHistories = await tx.gameHistory.findMany({
                    where: {
                        userId: dispute.userId,
                        questionId: dispute.questionId,
                        correct: false,
                        timestamp: {
                            gte: new Date(dispute.createdAt.getTime() - 60000), // 1 minute before
                            lte: new Date(dispute.createdAt.getTime() + 60000)  // 1 minute after
                        }
                    }
                })

                const questionValue = dispute.question.value || 200
                const statsPoints = getStatsPoints({
                    round: dispute.question.round,
                    faceValue: questionValue,
                    correct: true
                })

                for (const hist of disputeHistories) {
                    await tx.gameHistory.update({
                        where: { id: hist.id },
                        data: {
                            correct: true,
                            points: statsPoints,
                            userAnswer: hist.userAnswer || dispute.userAnswer
                        }
                    })
                }
            }

            // Recalculate UserProgress for the category
            // Get all GameHistory entries for this user/category
            const categoryHistories = await tx.gameHistory.findMany({
                where: {
                    userId: dispute.userId,
                    question: {
                        categoryId: dispute.question.categoryId
                    }
                },
                include: {
                    question: {
                        select: {
                            round: true,
                            value: true
                        }
                    }
                }
            })

            // Recalculate aggregates
            let correctCount = 0
            let totalCount = 0
            let totalPoints = 0

            for (const hist of categoryHistories) {
                totalCount++
                if (hist.correct) {
                    correctCount++
                    const points = getStatsPoints({
                        round: hist.question.round,
                        faceValue: hist.question.value,
                        correct: true
                    })
                    totalPoints += points
                }
            }

            // Update UserProgress
            await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId: dispute.userId,
                        categoryId: dispute.question.categoryId
                    }
                },
                update: {
                    correct: correctCount,
                    total: totalCount,
                    points: totalPoints
                },
                create: {
                    id: crypto.randomUUID(),
                    userId: dispute.userId,
                    categoryId: dispute.question.categoryId,
                    questionId: dispute.questionId,
                    correct: correctCount,
                    total: totalCount,
                    points: totalPoints
                }
            })

            // If this was a game mode dispute, also update GameQuestion and game score
            if (dispute.mode === 'GAME' && dispute.gameId) {
                const gameQuestion = await tx.gameQuestion.findFirst({
                    where: {
                        gameId: dispute.gameId,
                        questionId: dispute.questionId
                    }
                })

                if (gameQuestion && !gameQuestion.correct) {
                    const questionValue = dispute.question.value || 200
                    const statsPoints = getStatsPoints({
                        round: dispute.question.round,
                        faceValue: questionValue,
                        correct: true
                    })

                    await tx.gameQuestion.update({
                        where: { id: gameQuestion.id },
                        data: { correct: true }
                    })

                    // Update game score
                    await tx.game.update({
                        where: { id: dispute.gameId },
                        data: {
                            currentScore: { increment: statsPoints }
                        }
                    })
                }
            }
        })

        return jsonResponse({
            success: true,
            message: 'Dispute approved and stats updated'
        })
    } catch (error) {
        console.error('Error approving dispute:', error)
        return serverErrorResponse('Failed to approve dispute', error)
    }
}

