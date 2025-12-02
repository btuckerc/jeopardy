/**
 * Guest Session Utilities
 * 
 * Handles creation, management, and claiming of guest sessions for unauthenticated users
 */

import { prisma } from './prisma'
import { updateGameHistory } from './game-utils'
import { Prisma } from '@prisma/client'
import type { GuestSessionType } from '@prisma/client'
import { nanoid } from 'nanoid'

export interface GuestConfig {
    id: string
    randomGameMaxQuestionsBeforeAuth: number
    randomGameMaxCategoriesBeforeAuth: number | null
    randomGameMaxRoundsBeforeAuth: number | null
    randomGameMaxGamesBeforeAuth: number
    randomQuestionMaxQuestionsBeforeAuth: number
    randomQuestionMaxCategoriesBeforeAuth: number | null
    dailyChallengeGuestEnabled: boolean
    dailyChallengeGuestAppearsOnLeaderboard: boolean
    dailyChallengeMinLookbackDays: number
    dailyChallengeSeasons: number[] | null
    timeToAuthenticateMinutes: number
}

/**
 * Get the current guest configuration (singleton)
 */
export async function getGuestConfig(): Promise<GuestConfig> {
    let config = await prisma.guestConfig.findFirst()
    
    if (!config) {
        // Create default config if it doesn't exist
        config = await prisma.guestConfig.create({
            data: {
                id: 'default',
                randomGameMaxQuestionsBeforeAuth: 1,
                randomGameMaxCategoriesBeforeAuth: null,
                randomGameMaxRoundsBeforeAuth: null,
                randomGameMaxGamesBeforeAuth: 0,
                randomQuestionMaxQuestionsBeforeAuth: 1,
                randomQuestionMaxCategoriesBeforeAuth: null,
                dailyChallengeGuestEnabled: false,
                dailyChallengeGuestAppearsOnLeaderboard: false,
                dailyChallengeMinLookbackDays: 365, // Default 1 year
                dailyChallengeSeasons: Prisma.JsonNull, // Default: auto-calculate from 1-3 years ago
                timeToAuthenticateMinutes: 1440, // 24 hours
            }
        })
    }
    
    // Transform Prisma's JsonValue to our expected type
    return {
        ...config,
        dailyChallengeSeasons: config.dailyChallengeSeasons as number[] | null
    }
}

/**
 * Create a new guest session
 */
export async function createGuestSession(
    type: GuestSessionType,
    initialData?: Record<string, unknown>
): Promise<{ id: string; expiresAt: Date }> {
    const config = await getGuestConfig()
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + config.timeToAuthenticateMinutes)
    
    const session = await prisma.guestSession.create({
        data: {
            type,
            data: initialData ? (initialData as Prisma.InputJsonValue) : Prisma.JsonNull,
            expiresAt,
        }
    })
    
    return {
        id: session.id,
        expiresAt: session.expiresAt
    }
}

/**
 * Mark a guest session as claimed by a user
 */
export async function markGuestSessionClaimed(
    sessionId: string,
    userId: string
): Promise<void> {
    await prisma.guestSession.update({
        where: { id: sessionId },
        data: {
            claimedAt: new Date(),
            claimedByUserId: userId
        }
    })
}

/**
 * Get a guest session by ID (with validation)
 */
export async function getGuestSession(sessionId: string) {
    const session = await prisma.guestSession.findUnique({
        where: { id: sessionId },
        include: {
            guestGame: {
                include: {
                    questions: {
                        include: {
                            question: {
                                include: {
                                    category: true
                                }
                            }
                        }
                    }
                }
            }
        }
    })
    
    if (!session) {
        return null
    }
    
    // Check if expired
    if (new Date() > session.expiresAt) {
        return null
    }
    
    // Check if already claimed
    if (session.claimedAt || session.claimedByUserId) {
        return null
    }
    
    return session
}

/**
 * Claim a guest session and convert it to canonical records
 */
export async function claimGuestSession(
    sessionId: string,
    userId: string
): Promise<{
    success: boolean
    gameId?: string
    challengeId?: string
    redirectPath?: string
    error?: string
}> {
    const session = await getGuestSession(sessionId)
    
    if (!session) {
        return {
            success: false,
            error: 'Session not found, expired, or already claimed'
        }
    }
    
    try {
        switch (session.type) {
            case 'RANDOM_QUESTION': {
                const data = session.data as {
                    questionId?: string
                    correct?: boolean
                    points?: number
                    userAnswer?: string
                    categoryName?: string
                    knowledgeCategory?: string
                }
                
                let redirectPath: string | undefined
                
                if (data.questionId && typeof data.correct === 'boolean' && typeof data.points === 'number') {
                    // Get question details for redirect
                    const question = await prisma.question.findUnique({
                        where: { id: data.questionId },
                        include: { category: true }
                    })
                    
                    if (question) {
                        // Update game history
                        await updateGameHistory({
                            userId,
                            questionId: data.questionId,
                            correct: data.correct,
                            points: data.points
                        })
                        
                        // Build redirect path to practice category
                        // Use stored category info or fetch from question
                        const categoryName = data.categoryName || question.category.name
                        const knowledgeCategory = data.knowledgeCategory || question.knowledgeCategory
                        
                        // Fetch category ID for the redirect
                        try {
                            const category = await prisma.category.findUnique({
                                where: { name: categoryName }
                            })
                            
                            if (category) {
                                redirectPath = `/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&category=${encodeURIComponent(category.id)}&question=${data.questionId}`
                            } else {
                                // Fallback to knowledge category only
                                redirectPath = `/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&question=${data.questionId}`
                            }
                        } catch {
                            // Fallback to knowledge category only
                            redirectPath = `/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&question=${data.questionId}`
                        }
                    }
                }
                
                await markGuestSessionClaimed(sessionId, userId)
                return { success: true, redirectPath }
            }
            
            case 'DAILY_CHALLENGE': {
                const data = session.data as {
                    challengeId?: string
                    questionId?: string
                    correct?: boolean
                    userAnswer?: string
                }
                
                if (data.challengeId && typeof data.correct === 'boolean') {
                    // Check if user already has a completion for this challenge
                    const existing = await prisma.userDailyChallenge.findUnique({
                        where: {
                            userId_challengeId: {
                                userId,
                                challengeId: data.challengeId
                            }
                        }
                    })
                    
                    if (!existing) {
                        await prisma.userDailyChallenge.create({
                            data: {
                                userId,
                                challengeId: data.challengeId,
                                correct: data.correct,
                                userAnswer: data.userAnswer || null
                            }
                        })
                    }
                }
                
                await markGuestSessionClaimed(sessionId, userId)
                return { success: true, challengeId: data.challengeId, redirectPath: '/daily-challenge' }
            }
            
            case 'RANDOM_GAME': {
                if (!session.guestGame) {
                    return {
                        success: false,
                        error: 'Guest game not found'
                    }
                }
                
                const guestGame = session.guestGame
                
                /**
                 * Claim guest game: Convert guest game to a real game with full credit
                 * 
                 * This transaction:
                 * 1. Creates a Game record with the same seed, config, score, and status
                 * 2. Creates GameQuestion entries for all questions answered as guest
                 * 3. Creates GameHistory entries for answered questions (for stats tracking)
                 * 4. Updates UserProgress for each answered question (for category stats)
                 * 5. Marks the guest session as claimed
                 * 
                 * The game can be continued after claiming since:
                 * - The seed is preserved (same board will be generated)
                 * - The score is preserved
                 * - The status remains IN_PROGRESS (unless completed)
                 * - GameQuestion entries mark which questions were already answered
                 */
                // Use a transaction to ensure atomicity
                const result = await prisma.$transaction(async (tx) => {
                    // Create the actual game
                    const game = await tx.game.create({
                        data: {
                            userId,
                            seed: guestGame.seed || nanoid(10),
                            config: guestGame.config === null ? Prisma.JsonNull : guestGame.config as Prisma.InputJsonValue,
                            status: guestGame.status,
                            currentRound: guestGame.currentRound,
                            currentScore: guestGame.currentScore,
                            useKnowledgeCategories: false,
                            completed: guestGame.status === 'COMPLETED',
                            score: guestGame.currentScore
                        }
                    })
                    
                    // Create game questions and game history entries
                    for (const guestQuestion of guestGame.questions) {
                        // Create game question entry (includes both answered and unanswered questions for game continuity)
                        await tx.gameQuestion.create({
                            data: {
                                gameId: game.id,
                                questionId: guestQuestion.questionId,
                                answered: guestQuestion.answered,
                                correct: guestQuestion.correct
                            }
                        })
                        
                        // Create game history entries for answered questions only
                        if (guestQuestion.answered && typeof guestQuestion.correct === 'boolean') {
                            const question = await tx.question.findUnique({
                                where: { id: guestQuestion.questionId },
                                select: { value: true, categoryId: true }
                            })
                            
                            if (question) {
                                const points = guestQuestion.correct ? (question.value || 0) : -(question.value || 0)
                                
                                // Create game history entry
                                await tx.gameHistory.create({
                                    data: {
                                        userId,
                                        questionId: guestQuestion.questionId,
                                        correct: guestQuestion.correct,
                                        points
                                    }
                                })
                                
                                // Update or create user progress
                                await tx.userProgress.upsert({
                                    where: {
                                        userId_categoryId: {
                                            userId,
                                            categoryId: question.categoryId
                                        }
                                    },
                                    update: {
                                        correct: { increment: guestQuestion.correct ? 1 : 0 },
                                        total: { increment: 1 },
                                        points: { increment: points }
                                    },
                                    create: {
                                        userId,
                                        categoryId: question.categoryId,
                                        questionId: guestQuestion.questionId,
                                        correct: guestQuestion.correct ? 1 : 0,
                                        total: 1,
                                        points
                                    }
                                })
                            }
                        }
                    }
                    
                    // Mark session as claimed
                    await tx.guestSession.update({
                        where: { id: sessionId },
                        data: {
                            claimedAt: new Date(),
                            claimedByUserId: userId
                        }
                    })
                    
                    return game.id
                })
                
                return { success: true, gameId: result }
            }
            
            default:
                return {
                    success: false,
                    error: `Unknown session type: ${session.type}`
                }
        }
    } catch (error) {
        console.error('Error claiming guest session:', error)
        return {
            success: false,
            error: 'Failed to claim session'
        }
    }
}

/**
 * Check if a guest has reached their limit for a given type
 */
export async function checkGuestLimit(
    type: GuestSessionType,
    currentCount: number,
    categoryCount?: number,
    roundCount?: number
): Promise<{ allowed: boolean; reason?: string }> {
    const config = await getGuestConfig()
    
    switch (type) {
        case 'RANDOM_QUESTION': {
            if (currentCount >= config.randomQuestionMaxQuestionsBeforeAuth) {
                return {
                    allowed: false,
                    reason: `Maximum ${config.randomQuestionMaxQuestionsBeforeAuth} question(s) allowed before sign-in`
                }
            }
            if (config.randomQuestionMaxCategoriesBeforeAuth && categoryCount && categoryCount >= config.randomQuestionMaxCategoriesBeforeAuth) {
                return {
                    allowed: false,
                    reason: `Maximum ${config.randomQuestionMaxCategoriesBeforeAuth} categor(ies) allowed before sign-in`
                }
            }
            return { allowed: true }
        }
        
        case 'RANDOM_GAME': {
            if (currentCount >= config.randomGameMaxQuestionsBeforeAuth) {
                return {
                    allowed: false,
                    reason: `Maximum ${config.randomGameMaxQuestionsBeforeAuth} question(s) allowed before sign-in`
                }
            }
            if (config.randomGameMaxCategoriesBeforeAuth && categoryCount && categoryCount >= config.randomGameMaxCategoriesBeforeAuth) {
                return {
                    allowed: false,
                    reason: `Maximum ${config.randomGameMaxCategoriesBeforeAuth} categor(ies) allowed before sign-in`
                }
            }
            if (config.randomGameMaxRoundsBeforeAuth && roundCount && roundCount >= config.randomGameMaxRoundsBeforeAuth) {
                return {
                    allowed: false,
                    reason: `Maximum ${config.randomGameMaxRoundsBeforeAuth} round(s) allowed before sign-in`
                }
            }
            return { allowed: true }
        }
        
        case 'DAILY_CHALLENGE': {
            // Daily challenge is typically one per day, so we check if they've already completed one
            if (currentCount >= 1) {
                return {
                    allowed: false,
                    reason: 'Daily challenge requires sign-in'
                }
            }
            return { allowed: true }
        }
        
        default:
            return { allowed: false, reason: 'Unknown session type' }
    }
}

/**
 * Get guest session statistics for admin dashboard
 */
export async function getGuestSessionStats() {
    const now = new Date()
    
    const [active, unclaimed, claimed, expired] = await Promise.all([
        // Active sessions (not expired, not claimed)
        prisma.guestSession.count({
            where: {
                expiresAt: { gt: now },
                claimedAt: null,
                claimedByUserId: null
            }
        }),
        
        // Unclaimed sessions (active but not claimed)
        prisma.guestSession.count({
            where: {
                expiresAt: { gt: now },
                claimedAt: null,
                claimedByUserId: null
            }
        }),
        
        // Claimed sessions
        prisma.guestSession.count({
            where: {
                claimedAt: { not: null }
            }
        }),
        
        // Expired sessions
        prisma.guestSession.count({
            where: {
                expiresAt: { lte: now },
                claimedAt: null
            }
        })
    ])
    
    // Breakdown by type
    const byType = await prisma.guestSession.groupBy({
        by: ['type'],
        where: {
            expiresAt: { gt: now },
            claimedAt: null
        },
        _count: true
    })
    
    // Recent activity (last 24 hours)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recentUnclaimed = await prisma.guestSession.count({
        where: {
            createdAt: { gte: dayAgo },
            expiresAt: { gt: now },
            claimedAt: null
        }
    })
    
    const recentClaimed = await prisma.guestSession.count({
        where: {
            claimedAt: { gte: dayAgo }
        }
    })
    
    return {
        active,
        unclaimed,
        claimed,
        expired,
        byType: byType.reduce((acc, item) => {
            acc[item.type] = item._count
            return acc
        }, {} as Record<string, number>),
        recent: {
            unclaimed: recentUnclaimed,
            claimed: recentClaimed,
            conversionRate: recentUnclaimed + recentClaimed > 0
                ? (recentClaimed / (recentUnclaimed + recentClaimed)) * 100
                : 0
        }
    }
}

