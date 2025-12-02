import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, serverErrorResponse, parseBody, badRequestResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { checkAndUnlockAchievements } from '@/lib/achievements'

interface RouteParams {
    params: Promise<{ gameId: string }>
}

// Schema for answering a question
const answerQuestionSchema = z.object({
    questionId: z.string(),
    correct: z.boolean(),
    pointsEarned: z.number()
})

// Schema for advancing round
const advanceRoundSchema = z.object({
    newRound: z.enum(['SINGLE', 'DOUBLE', 'FINAL']),
    finalJeopardyQuestionId: z.string().optional() // Store the FJ question ID when advancing to FINAL
})

// Schema for updating Final Jeopardy state
const updateFinalJeopardySchema = z.object({
    stage: z.enum(['category', 'question', 'result']).optional(),
    wager: z.number().optional()
})

// Schema for completing game
const completeGameSchema = z.object({
    finalScore: z.number()
})

/**
 * PATCH /api/games/[gameId]/state
 * Update game state after answering a question, advancing rounds, or completing the game.
 * Supports multiple action types via the 'action' field.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const { gameId } = await params

        // Verify ownership and get current game state
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                questions: true
            }
        })

        if (!game) {
            return notFoundResponse('Game not found')
        }

        if (game.userId !== appUser.id) {
            return forbiddenResponse('You can only update your own games')
        }

        if (game.status !== 'IN_PROGRESS') {
            return badRequestResponse('Cannot update a completed or abandoned game')
        }

        // Parse the request body to determine the action
        let body: any
        try {
            body = await request.json()
        } catch {
            return badRequestResponse('Invalid JSON body')
        }

        const action = body.action as string

        switch (action) {
            case 'answer': {
                // Answer a question
                const parsed = answerQuestionSchema.safeParse(body)
                if (!parsed.success) {
                    return badRequestResponse('Invalid answer data')
                }

                const { questionId, correct, pointsEarned } = parsed.data

                // Find or create the GameQuestion record
                let gameQuestion = game.questions.find(gq => gq.questionId === questionId)

                if (gameQuestion) {
                    // Update existing record
                    await prisma.gameQuestion.update({
                        where: { id: gameQuestion.id },
                        data: {
                            answered: true,
                            correct
                        }
                    })
                } else {
                    // Create new record
                    await prisma.gameQuestion.create({
                        data: {
                            gameId,
                            questionId,
                            answered: true,
                            correct
                        }
                    })
                }

                // Update game score
                const newScore = game.currentScore + (correct ? pointsEarned : 0)
                await prisma.game.update({
                    where: { id: gameId },
                    data: { currentScore: newScore }
                })

                // Also save to GameHistory for stats tracking
                await prisma.gameHistory.create({
                    data: {
                        userId: appUser.id,
                        questionId,
                        correct,
                        points: correct ? pointsEarned : 0
                    }
                })

                return jsonResponse({
                    success: true,
                    currentScore: newScore,
                    questionAnswered: questionId
                })
            }

            case 'advance_round': {
                // Advance to next round
                const parsed = advanceRoundSchema.safeParse(body)
                if (!parsed.success) {
                    return badRequestResponse('Invalid round data')
                }

                const { newRound, finalJeopardyQuestionId } = parsed.data

                // If advancing to FINAL round and we have a question ID, store it in config
                const updateData: any = { currentRound: newRound }
                
                if (newRound === 'FINAL' && finalJeopardyQuestionId) {
                    // Merge the FJ question ID into the existing config
                    const existingConfig = game.config as any || {}
                    updateData.config = {
                        ...existingConfig,
                        finalJeopardyQuestionId
                    }
                }

                await prisma.game.update({
                    where: { id: gameId },
                    data: updateData
                })

                return jsonResponse({
                    success: true,
                    currentRound: newRound
                })
            }

            case 'complete': {
                // Complete the game
                const parsed = completeGameSchema.safeParse(body)
                if (!parsed.success) {
                    return badRequestResponse('Invalid completion data')
                }

                const { finalScore } = parsed.data

                // Update game status
                await prisma.game.update({
                    where: { id: gameId },
                    data: {
                        status: 'COMPLETED',
                        completed: true,
                        score: finalScore,
                        currentScore: finalScore
                    }
                })

                // Update user streak
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                const user = await prisma.user.findUnique({
                    where: { id: appUser.id },
                    select: {
                        currentStreak: true,
                        longestStreak: true,
                        lastGameDate: true
                    }
                })

                if (user) {
                    let newStreak = user.currentStreak
                    const lastGameDate = user.lastGameDate ? new Date(user.lastGameDate) : null
                    
                    if (lastGameDate) {
                        lastGameDate.setHours(0, 0, 0, 0)
                        const daysDiff = Math.floor((today.getTime() - lastGameDate.getTime()) / (1000 * 60 * 60 * 24))
                        
                        if (daysDiff === 0) {
                            // Already played today, don't increment
                            newStreak = user.currentStreak
                        } else if (daysDiff === 1) {
                            // Played yesterday, continue streak
                            newStreak = user.currentStreak + 1
                        } else {
                            // More than 1 day ago, reset streak
                            newStreak = 1
                        }
                    } else {
                        // First game ever
                        newStreak = 1
                    }

                    const newLongestStreak = Math.max(user.longestStreak, newStreak)

                    await prisma.user.update({
                        where: { id: appUser.id },
                        data: {
                            currentStreak: newStreak,
                            longestStreak: newLongestStreak,
                            lastGameDate: today
                        }
                    })
                }

                // Check for achievements
                const newlyUnlocked = await checkAndUnlockAchievements(appUser.id, {
                    type: 'game_completed',
                    data: { gameId, finalScore }
                })

                return jsonResponse({
                    success: true,
                    status: 'COMPLETED',
                    finalScore,
                    newlyUnlockedAchievements: newlyUnlocked
                })
            }

            case 'update_final_jeopardy': {
                // Update Final Jeopardy state (stage, wager)
                const parsed = updateFinalJeopardySchema.safeParse(body)
                if (!parsed.success) {
                    return badRequestResponse('Invalid Final Jeopardy data')
                }

                const { stage, wager } = parsed.data
                const existingConfig = game.config as any || {}
                
                const updatedConfig = {
                    ...existingConfig,
                    ...(stage !== undefined && { finalJeopardyStage: stage }),
                    ...(wager !== undefined && { finalJeopardyWager: wager })
                }

                await prisma.game.update({
                    where: { id: gameId },
                    data: { config: updatedConfig }
                })

                return jsonResponse({
                    success: true,
                    stage,
                    wager
                })
            }

            default:
                return badRequestResponse(`Unknown action: ${action}. Valid actions are: answer, advance_round, complete, update_final_jeopardy`)
        }
    } catch (error) {
        return serverErrorResponse('Failed to update game state', error)
    }
}

