import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

/**
 * Calculate expected total questions based on game config and rounds
 * Standard Jeopardy: 6 categories × 5 questions = 30 per round
 * Final Jeopardy: 1 question
 */
function calculateExpectedQuestions(config: any): number {
    const rounds = config?.rounds || { single: true, double: true, final: false }
    let total = 0
    
    // Each regular round has 6 categories × 5 questions = 30 questions
    // (or fewer if custom mode with fewer categories)
    const questionsPerRound = 30 // Standard Jeopardy board
    
    if (rounds.single) total += questionsPerRound
    if (rounds.double) total += questionsPerRound
    if (rounds.final) total += 1
    
    return total
}

/**
 * GET /api/games/resumable
 * Get all in-progress games for the current user.
 * Returns games with their configuration, current state, and category summaries.
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return unauthorizedResponse()
        }

        // Fetch in-progress games for this user
        const games = await prisma.game.findMany({
            where: {
                userId: session.user.id,
                status: 'IN_PROGRESS'
            },
            orderBy: {
                updatedAt: 'desc'
            },
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
        const resumableGames = games.map(game => {
            const config = game.config as any
            
            // Extract unique categories from answered game questions
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
            
            // Calculate progress based on expected questions, not just answered ones
            const expectedTotalQuestions = calculateExpectedQuestions(config)
            const answeredQuestions = game.questions.filter(q => q.answered).length
            const correctQuestions = game.questions.filter(q => q.correct === true).length

            // Generate a human-readable label for the game
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
                // Parse date string directly to avoid timezone issues
                // config.date is in format "YYYY-MM-DD"
                const [year, month, day] = config.date.split('-').map(Number)
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                label = `Episode: ${months[month - 1]} ${day}, ${year}`
            }

            // Determine which rounds are included
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

        return jsonResponse({ games: resumableGames })
    } catch (error) {
        return serverErrorResponse('Failed to fetch resumable games', error)
    }
}

