import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    serverErrorResponse,
    requireAuth,
    parseSearchParams
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import type { GameConfig } from '@/types/game'

export const dynamic = 'force-dynamic'

// Cache high scores for 5 minutes
export const revalidate = 300

// Request validation schema
const highScoresParamsSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    timeframe: z.enum(['all', 'week', 'month', 'year']).default('all')
})

interface HighScoreEntry {
    id: string
    rank: number
    userId: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    score: number
    gameMode: string
    roundsPlayed: string[]
    questionsCorrect: number
    questionsTotal: number
    accuracy: number
    completedAt: string
    seed: string | null
}

/**
 * Get a human-readable game mode label
 */
function getGameModeLabel(config: GameConfig | null): string {
    if (!config?.mode) return 'Classic'
    
    switch (config.mode) {
        case 'random':
            return 'Random'
        case 'knowledge':
            const areas = config.categories || []
            if (areas.length === 1) {
                return areas[0].replace(/_/g, ' ').split(' ').map(
                    (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
                ).join(' ')
            }
            return `${areas.length} Knowledge Areas`
        case 'custom':
            return 'Custom Categories'
        case 'date':
            if (config.date) {
                const [year, month, day] = config.date.split('-').map(Number)
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                return `${months[month - 1]} ${day}, ${year}`
            }
            return 'Date Mode'
        default:
            return 'Classic'
    }
}

/**
 * Get rounds played from config
 */
function getRoundsPlayed(config: GameConfig | null): string[] {
    const rounds: string[] = []
    if (!config?.rounds) {
        // Default rounds
        rounds.push('Single', 'Double')
    } else {
        if (config.rounds.single) rounds.push('Single')
        if (config.rounds.double) rounds.push('Double')
        if (config.rounds.final) rounds.push('Final')
    }
    return rounds
}

/**
 * GET /api/high-scores
 * Get the highest scoring completed games.
 */
export const GET = withInstrumentation(async (request: NextRequest) => {
    // Require authentication
    const { error: authError } = await requireAuth()
    if (authError) return authError

    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, highScoresParamsSchema)
        
        if (error) return error

        // Build date filter based on timeframe
        let dateFilter: Date | undefined
        const now = new Date()
        switch (params.timeframe) {
            case 'week':
                dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                break
            case 'month':
                dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
            case 'year':
                dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
                break
        }

        // Fetch top completed games with highest scores
        const games = await prisma.game.findMany({
            where: {
                status: 'COMPLETED',
                currentScore: { gt: 0 }, // Only positive scores
                ...(dateFilter && {
                    updatedAt: { gte: dateFilter }
                })
            },
            orderBy: {
                currentScore: 'desc'
            },
            take: params.limit,
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        selectedIcon: true,
                        avatarBackground: true
                    }
                },
                questions: {
                    select: {
                        answered: true,
                        correct: true
                    }
                }
            }
        })

        // Transform to high score entries
        const highScores: HighScoreEntry[] = games.map((game, index) => {
            const config = game.config as GameConfig | null
            const questionsTotal = game.questions.filter(q => q.answered).length
            const questionsCorrect = game.questions.filter(q => q.correct === true).length
            const accuracy = questionsTotal > 0 
                ? Math.round((questionsCorrect / questionsTotal) * 100)
                : 0

            return {
                id: game.id,
                rank: index + 1,
                userId: game.userId,
                displayName: game.user.displayName || 'Anonymous Player',
                selectedIcon: game.user.selectedIcon,
                avatarBackground: game.user.avatarBackground,
                score: game.currentScore,
                gameMode: getGameModeLabel(config),
                roundsPlayed: getRoundsPlayed(config),
                questionsCorrect,
                questionsTotal,
                accuracy,
                completedAt: game.updatedAt.toISOString(),
                seed: game.seed
            }
        })

        return jsonResponse({
            highScores,
            timeframe: params.timeframe,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch high scores', error)
    }
})
