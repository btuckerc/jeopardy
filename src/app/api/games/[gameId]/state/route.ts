import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, serverErrorResponse, badRequestResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { z } from 'zod'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import type { Prisma } from '@prisma/client'
import { FriendActivityType, FriendChallengeMode, FriendChallengeStatus } from '@prisma/client'
import {
    finalizeReconciledGameChallengeState,
    findChallengeGameStateForUser,
    hasConflictingActiveChallengeForPair,
    reconcileGameChallengeState,
} from '@/lib/friend-challenge-state'

interface GameConfig {
    finalJeopardyQuestionId?: string
    rounds?: {
        single?: boolean
        double?: boolean
        final?: boolean
    }
    mode?: string
    spoilerProtection?: {
        enabled?: boolean
        cutoffDate?: string | null
    }
    [key: string]: unknown
}

interface FriendChallengeContext {
    friendChallengeId?: string
    friendChallengeRole?: 'CHALLENGER' | 'OPPONENT'
}

function parseFriendChallengeContext(config: unknown): FriendChallengeContext {
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

async function syncFriendChallengeCompletion(params: {
    userId: string
    finalScore: number
    config: unknown
    completedAt: Date
}) {
    const challengeContext = parseFriendChallengeContext(params.config)
    if (!challengeContext.friendChallengeId) {
        return
    }

    await prisma.$transaction(async (tx) => {
        const challenge = await tx.friendChallenge.findUnique({
            where: { id: challengeContext.friendChallengeId },
        })

        if (!challenge || challenge.mode !== FriendChallengeMode.GAME) {
            return
        }

        const isChallenger = challenge.challengerUserId === params.userId
        const isOpponent = challenge.opponentUserId === params.userId
        if (!isChallenger && !isOpponent) {
            return
        }

        if (
            challenge.status === FriendChallengeStatus.CANCELLED
            || challenge.status === FriendChallengeStatus.DECLINED
            || challenge.status === FriendChallengeStatus.EXPIRED
        ) {
            return
        }

        const challengerGame = await findChallengeGameStateForUser(tx, {
            userId: challenge.challengerUserId,
            challengeId: challenge.id,
        })
        const opponentGame = await findChallengeGameStateForUser(tx, {
            userId: challenge.opponentUserId,
            challengeId: challenge.id,
        })
        const reconciled = reconcileGameChallengeState(challenge, challengerGame, opponentGame)
        const needsConflictCheck = (
            challenge.status === FriendChallengeStatus.COMPLETED
            && reconciled.status === FriendChallengeStatus.ACCEPTED
        )
        const finalized = finalizeReconciledGameChallengeState({
            challenge,
            reconciled,
            hasConflictingActiveChallenge: needsConflictCheck
                ? await hasConflictingActiveChallengeForPair(tx, {
                    challengeId: challenge.id,
                    challengerUserId: challenge.challengerUserId,
                    opponentUserId: challenge.opponentUserId,
                })
                : false,
        })

        await tx.friendChallenge.update({
            where: { id: challenge.id },
            data: {
                challengerScore: finalized.challengerScore,
                opponentScore: finalized.opponentScore,
                status: finalized.status,
                winnerUserId: finalized.winnerUserId,
                completedAt: finalized.status === FriendChallengeStatus.COMPLETED
                    ? (challenge.completedAt ?? params.completedAt)
                    : null,
            },
        })

        if (
            challenge.status !== FriendChallengeStatus.COMPLETED
            && finalized.status === FriendChallengeStatus.COMPLETED
        ) {
            await tx.friendActivity.create({
                data: {
                    actorUserId: params.userId,
                    relatedUserId: isChallenger ? challenge.opponentUserId : challenge.challengerUserId,
                    challengeId: challenge.id,
                    activityType: FriendActivityType.CHALLENGE_COMPLETED,
                    metadata: {
                        challengeId: challenge.id,
                        challengerScore: finalized.challengerScore,
                        opponentScore: finalized.opponentScore,
                        challengeChallengerUserId: challenge.challengerUserId,
                        challengeOpponentUserId: challenge.opponentUserId,
                    },
                },
            })
        }
    })
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
async function patchHandler(request: NextRequest, context?: { params?: Record<string, string | string[]> }) {
    try {
        const appUser = await getAppUser()
        if (!appUser) {
            return unauthorizedResponse()
        }

        const gameId = context?.params?.gameId as string
        if (!gameId) {
            return badRequestResponse('Missing gameId parameter')
        }

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
        let body: Record<string, unknown>
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

                const { questionId, correct } = parsed.data

                // Find or create the GameQuestion record
                const gameQuestion = game.questions.find(gq => gq.questionId === questionId)

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

                // Note: Game score is already updated by /api/answers/grade
                // This endpoint should only update GameQuestion state
                // GameHistory is also created by /api/answers/grade for consistency

                return jsonResponse({
                    success: true,
                    currentScore: game.currentScore,
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
                const updateData: Prisma.GameUpdateInput = { currentRound: newRound }
                
                if (newRound === 'FINAL' && finalJeopardyQuestionId) {
                    // Merge the FJ question ID into the existing config
                    const existingConfig = (game.config as GameConfig) || {}
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

                try {
                    await syncFriendChallengeCompletion({
                        userId: appUser.id,
                        finalScore,
                        config: game.config,
                        completedAt: new Date(),
                    })
                } catch (challengeSyncError) {
                    console.error('Failed to sync friend challenge completion:', challengeSyncError)
                }

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

                    // Check streak-based achievements
                    const _streakAchievements = await checkAndUnlockAchievements(appUser.id, {
                        type: 'streak_updated',
                        data: { 
                            userId: appUser.id,
                            currentStreak: newStreak
                        }
                    })
                }

                // Check for game completion achievements
                const newlyUnlocked = await checkAndUnlockAchievements(appUser.id, {
                    type: 'game_completed',
                    data: { gameId, finalScore }
                })

                return jsonResponse({
                    unlockedAchievements: newlyUnlocked.length > 0 ? newlyUnlocked : undefined,
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
                const existingConfig = (game.config as GameConfig) || {}
                
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

export const PATCH = withInstrumentation(patchHandler)
