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
function calculateExpectedQuestions(config: unknown): number {
    const cfg = config as { rounds?: { single?: boolean; double?: boolean; final?: boolean } } | null
    const rounds = cfg?.rounds || { single: true, double: true, final: false }
    let total = 0
    
    // Each regular round has 6 categories × 5 questions = 30 questions
    // (or fewer if custom mode with fewer categories)
    const questionsPerRound = 30 // Standard Jeopardy board
    
    if (rounds.single) total += questionsPerRound
    if (rounds.double) total += questionsPerRound
    
    return total
}

/**
 * Generate a human-readable label for a game based on its config
 */
function generateGameLabel(config: unknown): string {
    const cfg = config as { 
        mode?: string
        categories?: string[]
        categoryIds?: string[]
        date?: string 
    } | null

    if (!cfg?.mode) return 'Game'

    switch (cfg.mode) {
        case 'random':
            return 'Random Categories'
        case 'knowledge': {
            const areas = cfg.categories || []
            if (areas.length === 1) {
                return areas[0].replace(/_/g, ' ')
            } else if (areas.length > 1) {
                return `${areas.length} Knowledge Areas`
            }
            return 'Knowledge Game'
        }
        case 'custom': {
            const customCatCount = cfg.categoryIds?.length || 0
            return `Custom (${customCatCount} categories)`
        }
        case 'date': {
            if (cfg.date) {
                const [year, month, day] = cfg.date.split('-').map(Number)
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                return `Episode: ${months[month - 1]} ${day}, ${year}`
            }
            return 'Date Game'
        }
        default:
            return 'Game'
    }
}

/**
 * Get round badges from game config
 */
function getRoundBadges(config: unknown): string[] {
    const cfg = config as { rounds?: { single?: boolean; double?: boolean; final?: boolean } } | null
    const rounds = cfg?.rounds || { single: true, double: true, final: false }
    const badges: string[] = []
    if (rounds.single) badges.push('Single')
    if (rounds.double) badges.push('Double')
    if (rounds.final) badges.push('Final')
    return badges
}

/**
 * Server-side utility to fetch resumable games
 * OPTIMIZED: Uses lighter queries to avoid loading full question/category data
 */
export async function getResumableGames(): Promise<ResumableGame[]> {
    const appUser = await getAppUser()

    if (!appUser) {
        return []
    }

    // OPTIMIZED: Fetch games with minimal data
    // Don't include full questions - just get counts
    const games = await prisma.game.findMany({
        where: {
            userId: appUser.id,
            status: 'IN_PROGRESS'
        },
        orderBy: {
            updatedAt: 'desc'
        },
        select: {
            id: true,
            seed: true,
            config: true,
            status: true,
            currentRound: true,
            currentScore: true,
            createdAt: true,
            updatedAt: true,
            // Use _count for efficient aggregation
            _count: {
                select: {
                    questions: true
                }
            }
        }
    })

    if (games.length === 0) {
        return []
    }

    // OPTIMIZED: Get question stats for all games in a single batch query
    // Group by gameId to get answered and correct counts
    const gameIds = games.map(g => g.id)
    
    // Get answered/correct counts per game using groupBy
    // We use separate queries for answered/correct counts since groupBy doesn't support conditional sums
    const questionStats = await prisma.gameQuestion.groupBy({
        by: ['gameId'],
        where: {
            gameId: { in: gameIds }
        },
        _count: {
            id: true
        }
    })

    // Get correct counts per game
    const correctCounts = await prisma.gameQuestion.groupBy({
        by: ['gameId'],
        where: {
            gameId: { in: gameIds },
            correct: true
        },
        _count: {
            id: true
        }
    })

    // Get answered counts per game
    const answeredCounts = await prisma.gameQuestion.groupBy({
        by: ['gameId'],
        where: {
            gameId: { in: gameIds },
            answered: true
        },
        _count: {
            id: true
        }
    })

    // OPTIMIZED: Get category info for all games in batch
    // This uses a raw query to efficiently get category names and counts per game
    const categoryInfo = await prisma.$queryRaw<Array<{
        gameId: string
        categoryId: string
        categoryName: string
        answeredCount: bigint
    }>>`
        SELECT 
            gq."gameId",
            q."categoryId",
            c."name" as "categoryName",
            COUNT(CASE WHEN gq."answered" = true THEN 1 END) as "answeredCount"
        FROM "GameQuestion" gq
        JOIN "Question" q ON gq."questionId" = q."id"
        JOIN "Category" c ON q."categoryId" = c."id"
        WHERE gq."gameId" = ANY(${gameIds})
        GROUP BY gq."gameId", q."categoryId", c."name"
    `

    // Build lookup maps for efficient access
    const statsMap = new Map(questionStats.map(s => [s.gameId, s._count.id]))
    const correctMap = new Map(correctCounts.map(s => [s.gameId, s._count.id]))
    const answeredMap = new Map(answeredCounts.map(s => [s.gameId, s._count.id]))
    
    // Group category info by gameId
    const categoryByGame = new Map<string, Array<{ id: string; name: string; answeredCount: number }>>()
    for (const cat of categoryInfo) {
        if (!categoryByGame.has(cat.gameId)) {
            categoryByGame.set(cat.gameId, [])
        }
        categoryByGame.get(cat.gameId)!.push({
            id: cat.categoryId,
            name: cat.categoryName,
            answeredCount: Number(cat.answeredCount)
        })
    }

    // Transform games to ResumableGame format
    const resumableGames: ResumableGame[] = games.map(game => {
        const answeredQuestions: number = answeredMap.get(game.id) || 0
        const correctQuestions: number = correctMap.get(game.id) || 0
        const expectedTotalQuestions: number = calculateExpectedQuestions(game.config)

        return {
            id: game.id,
            seed: game.seed,
            label: generateGameLabel(game.config),
            status: game.status,
            currentRound: game.currentRound,
            currentScore: game.currentScore,
            roundBadges: getRoundBadges(game.config),
            categories: categoryByGame.get(game.id) || [],
            progress: {
                totalQuestions: expectedTotalQuestions,
                answeredQuestions,
                correctQuestions,
                percentComplete: expectedTotalQuestions > 0 
                    ? Math.round((answeredQuestions / expectedTotalQuestions) * 100) 
                    : 0
            },
            createdAt: game.createdAt,
            updatedAt: game.updatedAt
        }
    })

    return resumableGames
}
