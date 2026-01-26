import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { z } from 'zod'
import { getQuestionOverrides, isAnswerAcceptedWithOverrides } from '@/lib/answer-overrides'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import crypto from 'crypto'

const gradeAnswerSchema = z.object({
    questionId: z.string().uuid(),
    mode: z.enum(['GAME', 'PRACTICE']),
    round: z.enum(['SINGLE', 'DOUBLE', 'FINAL']),
    userAnswer: z.string().min(1),
    gameId: z.string().uuid().optional(),
    pointsEarned: z.number().optional(), // For game mode, the display value
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/answers/grade
 * Centralized grading endpoint that checks answers against canonical answer and overrides,
 * persists results to GameHistory/UserProgress, and returns dispute context.
 */
export const POST = withInstrumentation(async (request: NextRequest) => {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const { data: body, error } = await parseBody(request, gradeAnswerSchema)
        if (error) return error

        const { questionId, mode, round, userAnswer, gameId, pointsEarned } = body

        // Load question and overrides
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                category: true
            }
        })

        if (!question) {
            return notFoundResponse('Question not found')
        }

        // Get all overrides for this question
        const overrides = await getQuestionOverrides(questionId)
        const _overrideTexts = overrides.map(o => o.text)

        // Grade the answer using canonical answer + overrides
        const correct = isAnswerAcceptedWithOverrides(
            userAnswer,
            question.answer,
            overrides
        )

        // Calculate points based on mode and round
        let storedPoints = 0
        if (correct) {
            if (mode === 'GAME' && pointsEarned !== undefined) {
                // In game mode, use the provided pointsEarned (display value)
                storedPoints = pointsEarned
            } else {
                // In study mode or if pointsEarned not provided, use question value
                storedPoints = question.value || 200
            }
        }

        // Persist results in a transaction
        await prisma.$transaction(async (tx) => {
            // For game mode, update GameQuestion if gameId provided
            if (mode === 'GAME' && gameId) {
                // Verify game ownership
                const game = await tx.game.findUnique({
                    where: { id: gameId },
                    select: { userId: true }
                })

                if (!game) {
                    throw new Error('Game not found')
                }

                if (game.userId !== appUser.id) {
                    throw new Error('Unauthorized')
                }

                // Find or create GameQuestion
                const existingGameQuestion = await tx.gameQuestion.findUnique({
                    where: {
                        gameId_questionId: {
                            gameId,
                            questionId
                        }
                    }
                })

                if (existingGameQuestion) {
                    await tx.gameQuestion.update({
                        where: { id: existingGameQuestion.id },
                        data: {
                            answered: true,
                            correct
                        }
                    })
                } else {
                    await tx.gameQuestion.create({
                        data: {
                            gameId,
                            questionId,
                            answered: true,
                            correct
                        }
                    })
                }

                // Update game score if correct
                if (correct && storedPoints > 0) {
                    await tx.game.update({
                        where: { id: gameId },
                        data: {
                            currentScore: { increment: storedPoints }
                        }
                    })
                }
            }

            // Create GameHistory entry
            // Check if this question has been answered correctly before (for study mode)
            const existingCorrectHistory = mode === 'PRACTICE' 
                ? await tx.gameHistory.findFirst({
                    where: {
                        userId: appUser.id,
                        questionId,
                        correct: true
                    }
                })
                : null

            // Only award points if this is the first correct answer (for practice)
            const shouldAwardPoints = correct && (!existingCorrectHistory || mode === 'GAME')

            await tx.gameHistory.create({
                data: {
                    userId: appUser.id,
                    questionId,
                    correct,
                    points: shouldAwardPoints ? storedPoints : 0,
                    userAnswer: userAnswer // Store raw user answer for retroactive re-grading
                }
            })

            // Update UserProgress (for study mode or if category tracking needed)
            if (mode === 'PRACTICE' || !gameId) {
                await tx.userProgress.upsert({
                    where: {
                        userId_categoryId: {
                            userId: appUser.id,
                            categoryId: question.categoryId
                        }
                    },
                    update: {
                        correct: { increment: shouldAwardPoints ? 1 : 0 },
                        total: { increment: existingCorrectHistory ? 0 : 1 },
                        points: { increment: shouldAwardPoints ? storedPoints : 0 }
                    },
                    create: {
                        id: crypto.randomUUID(),
                        userId: appUser.id,
                        categoryId: question.categoryId,
                        questionId,
                        correct: shouldAwardPoints ? 1 : 0,
                        total: 1,
                        points: shouldAwardPoints ? storedPoints : 0
                    }
                })
            }
        })

        // Check if user can dispute (only if answer was marked incorrect)
        const canDispute = !correct

        // Build dispute context
        const disputeContext = canDispute ? {
            questionId,
            gameId: gameId || null,
            round,
            userAnswer,
            mode
        } : null

        // Check for achievements asynchronously (don't block the response)
        // This allows real-time achievement tracking for both game and study mode
        const achievementPromise = checkAndUnlockAchievements(appUser.id, {
            type: 'question_answered',
            data: {
                questionId,
                correct,
                gameId: gameId || undefined
            }
        }).catch(error => {
            console.error('Error checking achievements after grading answer:', error)
            return []
        })

        // Wait for achievements to check (but don't block response)
        const unlockedAchievements = await achievementPromise

        return jsonResponse({
            correct,
            storedPoints,
            canDispute,
            disputeContext,
            unlockedAchievements: unlockedAchievements.length > 0 ? unlockedAchievements : undefined
        })
    } catch (error) {
        console.error('Error grading answer:', error)
        return serverErrorResponse('Failed to grade answer', error)
    }
})

