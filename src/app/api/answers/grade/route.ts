import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, badRequestResponse, serverErrorResponse, parseBody } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { z } from 'zod'
import { evaluateAnswerWithOverridesAsync, getQuestionOverrides } from '@/lib/answer-overrides'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { canPlayGameContentSource } from '@/lib/question-policy'
import { FriendChallengeMode, FriendChallengeStatus } from '@prisma/client'
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

type ChallengeRole = 'CHALLENGER' | 'OPPONENT'

function parseChallengeConfig(config: unknown): {
    friendChallengeId?: string
    friendChallengeRole?: ChallengeRole
} {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return {}
    }

    const typed = config as Record<string, unknown>
    return {
        friendChallengeId: typeof typed.friendChallengeId === 'string' ? typed.friendChallengeId : undefined,
        friendChallengeRole: typed.friendChallengeRole === 'CHALLENGER' || typed.friendChallengeRole === 'OPPONENT'
            ? typed.friendChallengeRole
            : undefined,
    }
}

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

        const isAdmin = appUser.role === 'ADMIN'
        if (mode === 'PRACTICE') {
            if (!isAdmin && (question.source !== 'ORIGINAL_ENGINE' || question.publishStatus !== 'PUBLISHED')) {
                return forbiddenResponse('This question is not available in the active practice pool')
            }
        } else if (mode === 'GAME' && gameId) {
            const targetGame = await prisma.game.findUnique({
                where: { id: gameId },
                select: { userId: true, status: true, contentSource: true }
            })
            if (!targetGame) {
                return notFoundResponse('Game not found')
            }
            if (targetGame.userId !== appUser.id) {
                return forbiddenResponse('You do not have access to this game')
            }
            if (targetGame.status !== 'IN_PROGRESS') {
                return badRequestResponse('Cannot grade answers for a completed or abandoned game')
            }
            const playPolicy = canPlayGameContentSource(targetGame.contentSource, targetGame.status, isAdmin)
            if (!playPolicy.allowed) {
                return jsonResponse(
                    {
                        error: 'This legacy game has been retired. Your score, history, and stats remain preserved—start a new game from the Original question bank.',
                        legacyRetired: true
                    },
                    410
                )
            }
            if (question.source !== targetGame.contentSource || (!isAdmin && question.publishStatus !== 'PUBLISHED')) {
                return forbiddenResponse('Question does not belong to this game content pool')
            }
        } else if (!isAdmin && (question.source !== 'ORIGINAL_ENGINE' || question.publishStatus !== 'PUBLISHED')) {
            return forbiddenResponse('This question is not available in the active pool')
        }

        // Get all overrides for this question
        const overrides = await getQuestionOverrides(questionId)
        const _overrideTexts = overrides.map(o => o.text)

        // Grade the answer using canonical answer + acceptableAnswers + overrides
        const grading = await evaluateAnswerWithOverridesAsync(
            userAnswer,
            question.answer,
            overrides,
            question.acceptableAnswers
        )
        const correct = grading.accepted

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
                // Verify game ownership and IN_PROGRESS status inside the transaction write boundary
                const game = await tx.game.findUnique({
                    where: { id: gameId },
                    select: { userId: true, status: true, currentScore: true, config: true }
                })

                if (!game) {
                    throw new Error('Game not found')
                }

                if (game.userId !== appUser.id) {
                    throw new Error('Unauthorized')
                }

                if (game.status !== 'IN_PROGRESS') {
                    throw new Error('GAME_NOT_IN_PROGRESS')
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

                const wasAlreadyAnswered = Boolean(existingGameQuestion?.answered)

                if (existingGameQuestion) {
                    await tx.gameQuestion.update({
                        where: { id: existingGameQuestion.id },
                        data: {
                            answered: true,
                            correct,
                            userAnswer: userAnswer.trim()
                        }
                    })
                } else {
                    await tx.gameQuestion.create({
                        data: {
                            gameId,
                            questionId,
                            answered: true,
                            correct,
                            userAnswer: userAnswer.trim()
                        }
                    })
                }

                // Update game score atomically only when first answered and still IN_PROGRESS
                let updatedCurrentScore = game.currentScore
                if (correct && storedPoints > 0 && !wasAlreadyAnswered) {
                    const scoreUpdated = await tx.game.updateMany({
                        where: { id: gameId, status: 'IN_PROGRESS' },
                        data: {
                            currentScore: { increment: storedPoints }
                        },
                    })
                    if (scoreUpdated.count === 0) {
                        throw new Error('GAME_NOT_IN_PROGRESS')
                    }
                    updatedCurrentScore = game.currentScore + storedPoints
                }

                const challengeContext = parseChallengeConfig(game.config)
                if (challengeContext.friendChallengeId) {
                    const challenge = await tx.friendChallenge.findUnique({
                        where: { id: challengeContext.friendChallengeId },
                        select: {
                            id: true,
                            mode: true,
                            status: true,
                            challengerUserId: true,
                            opponentUserId: true,
                        },
                    })

                    if (
                        challenge
                        && challenge.mode === FriendChallengeMode.GAME
                        && (
                            challenge.status === FriendChallengeStatus.ACCEPTED
                            || challenge.status === FriendChallengeStatus.COMPLETED
                        )
                    ) {
                        const isChallenger = challenge.challengerUserId === appUser.id
                        const isOpponent = challenge.opponentUserId === appUser.id
                        if (isChallenger || isOpponent) {
                            await tx.friendChallenge.update({
                                where: { id: challenge.id },
                                data: isChallenger
                                    ? { challengerScore: updatedCurrentScore }
                                    : { opponentScore: updatedCurrentScore },
                            })
                        }
                    }
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
            grading,
            canDispute,
            disputeContext,
            unlockedAchievements: unlockedAchievements.length > 0 ? unlockedAchievements : undefined
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'GAME_NOT_IN_PROGRESS') {
            return badRequestResponse('Cannot grade answers for a completed or abandoned game')
        }
        console.error('Error grading answer:', error)
        return serverErrorResponse('Failed to grade answer', error)
    }
})
