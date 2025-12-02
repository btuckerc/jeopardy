import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'

export interface GameConfig {
    mode: 'random' | 'knowledge' | 'custom' | 'date'
    categories?: string[]
    categoryIds?: string[]
    date?: string
    rounds: {
        single: boolean
        double: boolean
        final: boolean
    }
    finalCategoryMode?: string
    finalCategoryId?: string
    finalJeopardyQuestionId?: string
    finalJeopardyStage?: 'category' | 'question' | 'result'
    finalJeopardyWager?: number
}

export interface GameData {
    id: string
    seed: string | null
    config: GameConfig
    status: string
    currentRound: 'SINGLE' | 'DOUBLE' | 'FINAL'
    currentScore: number
    visibility: string
    owner: {
        id: string
        displayName: string | null
        selectedIcon: string | null
        avatarBackground: string | null
    }
    isOwner: boolean
    questions: Record<string, {
        id: string
        answered: boolean
        correct: boolean | null
        questionId: string
        categoryId: string
        categoryName: string
    }>
    stats: {
        totalQuestions: number
        answeredQuestions: number
        correctQuestions: number
        percentComplete: number
    }
    createdAt: Date
    updatedAt: Date
}

/**
 * Server-side utility to fetch game data
 * Reuses logic from the API route but can be called directly from server components
 */
export async function getGameData(gameId: string): Promise<GameData> {
    const appUser = await getAppUser()
    if (!appUser) {
        throw new Error('Unauthorized')
    }

    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
            questions: {
                include: {
                    question: {
                        include: {
                            category: true
                        }
                    }
                }
            },
            user: {
                select: {
                    id: true,
                    displayName: true,
                    selectedIcon: true,
                    avatarBackground: true
                }
            }
        }
    })

    if (!game) {
        throw new Error('Game not found')
    }

    // Check authorization: must be owner or opponent
    const isOwner = game.userId === appUser.id
    const isOpponent = game.opponentUserId === appUser.id
    
    if (!isOwner && !isOpponent) {
        // Check visibility for public/unlisted games
        if (game.visibility === 'PRIVATE') {
            throw new Error('You do not have access to this game')
        }
    }

    // Transform questions into a more usable format
    const questionsMap: Record<string, {
        id: string
        answered: boolean
        correct: boolean | null
        questionId: string
        categoryId: string
        categoryName: string
    }> = {}

    game.questions.forEach(gq => {
        questionsMap[gq.questionId] = {
            id: gq.id,
            answered: gq.answered,
            correct: gq.correct,
            questionId: gq.questionId,
            categoryId: gq.question.categoryId,
            categoryName: gq.question.category.name
        }
    })

    // Calculate stats
    const totalQuestions = game.questions.length
    const answeredQuestions = game.questions.filter(q => q.answered).length
    const correctQuestions = game.questions.filter(q => q.correct === true).length

    // Validate and cast config
    if (!game.config || typeof game.config !== 'object' || Array.isArray(game.config)) {
        throw new Error('Invalid game configuration')
    }

    return {
        id: game.id,
        seed: game.seed,
        config: game.config as unknown as GameConfig,
        status: game.status,
        currentRound: game.currentRound,
        currentScore: game.currentScore,
        visibility: game.visibility,
        owner: game.user,
        isOwner,
        questions: questionsMap,
        stats: {
            totalQuestions,
            answeredQuestions,
            correctQuestions,
            percentComplete: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
        },
        createdAt: game.createdAt,
        updatedAt: game.updatedAt
    }
}

