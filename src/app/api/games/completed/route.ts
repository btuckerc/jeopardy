import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import type { GameConfig } from '@/types/game'

/**
 * Calculate expected total questions based on game config and rounds
 */
function calculateExpectedQuestions(config: GameConfig): number {
    const rounds = config?.rounds || { single: true, double: true, final: false }
    let total = 0
    
    const questionsPerRound = 30
    
    if (rounds.single) total += questionsPerRound
    if (rounds.double) total += questionsPerRound
    if (rounds.final) total += 1
    
    return total
}

/**
 * GET /api/games/completed
 * Get completed games for the current user (limited to most recent 10).
 */
export const GET = withInstrumentation(async () => {
    try {
        const appUser = await getAppUser()

        if (!appUser) {
            return unauthorizedResponse()
        }

        // Fetch completed games for this user (limited to 10)
        const games = await prisma.game.findMany({
            where: {
                userId: appUser.id,
                status: 'COMPLETED'
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 10,
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
        })

        // Transform games to include useful summary info
        const completedGames = games.map(game => {
            const config = game.config as GameConfig
            
            // Extract unique categories
            const categoryMap = new Map<string, { id: string; name: string; answeredCount: number }>()
            
            game.questions.forEach(gq => {
                const cat = gq.question.category
                if (!categoryMap.has(cat.id)) {
                    categoryMap.set(cat.id, {
                        id: cat.id,
                        name: cat.name,
                        answeredCount: 0
                    })
                }
                const catInfo = categoryMap.get(cat.id)!
                if (gq.answered) {
                    catInfo.answeredCount++
                }
            })

            const categories = Array.from(categoryMap.values())
            
            const expectedTotalQuestions = calculateExpectedQuestions(config)
            const answeredQuestions = game.questions.filter(q => q.answered).length
            const correctQuestions = game.questions.filter(q => q.correct === true).length

            // Generate label
            let label = 'Game'
            if (config?.mode === 'random') {
                label = 'Random Categories'
            } else if (config?.mode === 'knowledge') {
                const areas = config.categories || []
                if (areas.length === 1) {
                    label = areas[0].replace(/_/g, ' ')
                } else if (areas.length > 1) {
                    label = `${areas.length} Knowledge Areas`
                }
            } else if (config?.mode === 'custom') {
                const customCatCount = config.categoryIds?.length || categories.length
                label = `Custom (${customCatCount} categories)`
            } else if (config?.mode === 'date' && config.date) {
                const [year, month, day] = config.date.split('-').map(Number)
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                label = `Episode: ${months[month - 1]} ${day}, ${year}`
            }

            const rounds = config?.rounds || { single: true, double: true, final: false }
            const roundBadges: string[] = []
            if (rounds.single) roundBadges.push('Single')
            if (rounds.double) roundBadges.push('Double')
            if (rounds.final) roundBadges.push('Final')

            return {
                id: game.id,
                seed: game.seed,
                label,
                status: game.status,
                currentRound: game.currentRound,
                currentScore: game.currentScore,
                roundBadges,
                categories,
                progress: {
                    totalQuestions: expectedTotalQuestions,
                    answeredQuestions,
                    correctQuestions,
                    percentComplete: expectedTotalQuestions > 0 ? Math.round((answeredQuestions / expectedTotalQuestions) * 100) : 0
                },
                createdAt: game.createdAt,
                updatedAt: game.updatedAt
            }
        })

        return jsonResponse({ games: completedGames })
    } catch (error) {
        return serverErrorResponse('Failed to fetch completed games', error)
    }
})
