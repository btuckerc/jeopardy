import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'

export interface ResumableGame {
    id: string
    seed: string | null
    label: string
    status: string
    currentRound: string
    currentScore: number
    roundBadges: string[]
            categories: Array<{
        id: string
        name: string
        answeredCount: number
    }>
    progress: {
        totalQuestions: number
        answeredQuestions: number
        correctQuestions: number
        percentComplete: number
    }
    createdAt: Date
    updatedAt: Date
}

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
    
    return total
}

/**
 * Server-side utility to fetch resumable games
 * Can be called directly from server components
 */
export async function getResumableGames(): Promise<ResumableGame[]> {
    const appUser = await getAppUser()

    if (!appUser) {
        return []
    }

    // Fetch in-progress games for this user
    const games = await prisma.game.findMany({
        where: {
            userId: appUser.id,
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
    const resumableGames: ResumableGame[] = games.map(game => {
        const config = game.config as any
        
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
            const customCatCount = config.categoryIds?.length || 0
            label = `Custom (${customCatCount} categories)`
        } else if (config?.mode === 'date' && config.date) {
            // Parse date string directly to avoid timezone issues
            // config.date is in format "YYYY-MM-DD"
            const [year, month, day] = config.date.split('-').map(Number)
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            label = `Episode: ${months[month - 1]} ${day}, ${year}`
        }

        // Calculate progress
        const answeredQuestions = game.questions.filter(q => q.answered).length
        const correctQuestions = game.questions.filter(q => q.correct === true).length
        const expectedTotalQuestions = calculateExpectedQuestions(config)

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

        // Build round badges
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

    return resumableGames
}

