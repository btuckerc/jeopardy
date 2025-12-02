import { prisma } from './prisma'
import { KnowledgeCategory } from '@prisma/client'

/**
 * Event types that can trigger achievement checks
 */
export type AchievementEventType = 
    | 'game_completed' 
    | 'question_answered' 
    | 'daily_challenge_completed'
    | 'streak_updated'

/**
 * Achievement event data structure
 */
export interface AchievementEvent {
    type: AchievementEventType
    data?: {
        gameId?: string
        finalScore?: number
        questionId?: string
        correct?: boolean
        challengeId?: string
        userId?: string
        currentStreak?: number
    }
}

/**
 * Map of event types to achievement codes that should be checked
 * This allows us to only check relevant achievements per event, not all 67
 */
const EVENT_TO_ACHIEVEMENTS: Record<AchievementEventType, string[]> = {
    game_completed: [
        // Onboarding
        'FIRST_GAME',
        'FIRST_PERFECT_ROUND',
        'PERFECT_ROUND',
        'PERFECT_GAME',
        'PERFECT_ROUND_DOUBLE_JEOPARDY',
        // Score-based
        'SCORE_5000',
        'SCORE_10000',
        'SCORE_15000',
        'SCORE_20000',
        'SCORE_30000',
        'SCORE_1984',
        // Volume
        'GAMES_COMPLETED_10',
        'GAMES_COMPLETED_50',
        'GAMES_COMPLETED_100',
    ],
    question_answered: [
        // Onboarding
        'FIRST_CORRECT',
        'FIRST_TRIPLE_STUMPER',
        // Volume
        'QUESTIONS_50',
        'QUESTIONS_100',
        'QUESTIONS_500',
        'QUESTIONS_1000',
        'QUESTIONS_5000',
        'QUESTIONS_1337',
        'TRIPLE_STUMPER_10',
        'TRIPLE_STUMPER_50',
        'TRIPLE_STUMPER_100',
        // Skill
        'ACCURACY_80_PERCENT',
        'ACCURACY_90_PERCENT',
        'ACCURACY_95_PERCENT',
        'FINAL_JEOPARDY_CORRECT',
        'FINAL_JEOPARDY_STREAK_5',
        // Knowledge
        'CATEGORY_MASTER_GEOGRAPHY',
        'CATEGORY_MASTER_ENTERTAINMENT',
        'CATEGORY_MASTER_ARTS',
        'CATEGORY_MASTER_SCIENCE',
        'CATEGORY_MASTER_SPORTS',
        'CATEGORY_MASTER_GENERAL',
        'ALL_CATEGORIES_MASTER',
    ],
    daily_challenge_completed: [
        // Onboarding
        'FIRST_DAILY_CHALLENGE',
        // Streaks
        'DAILY_CHALLENGE_STREAK_3',
        'DAILY_CHALLENGE_STREAK_7',
        'DAILY_CHALLENGE_STREAK_30',
        // Hidden
        'DAILY_CHALLENGE_MIDNIGHT',
    ],
    streak_updated: [
        // Streaks
        'STREAK_3',
        'STREAK_7',
        'STREAK_14',
        'STREAK_30',
        'STREAK_100',
        'STREAK_69',
        'RETURNING_PLAYER',
    ],
}

/**
 * Check and unlock achievements for a user based on a specific event
 * Only checks achievements relevant to the event type for scalability
 */
export async function checkAndUnlockAchievements(
    userId: string, 
    event: AchievementEvent
): Promise<string[]> {
    try {
        // Get user with minimal data needed
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                currentStreak: true,
                longestStreak: true,
                lastGameDate: true,
            }
        })

        if (!user) return []

        // Get only achievements relevant to this event type
        const relevantCodes = EVENT_TO_ACHIEVEMENTS[event.type] || []
        if (relevantCodes.length === 0) return []

        // Get user's already unlocked achievements (only codes we care about)
        const unlockedAchievements = await prisma.userAchievement.findMany({
            where: { userId },
            include: {
                achievement: {
                    select: { code: true }
                }
            }
        })
        const unlockedCodes = new Set(unlockedAchievements.map(ua => ua.achievement.code))

        // Get only relevant achievements from database
        const relevantAchievements = await prisma.achievement.findMany({
            where: {
                code: { in: relevantCodes },
                id: { notIn: unlockedAchievements.map(ua => ua.achievementId) }
            }
        })

        if (relevantAchievements.length === 0) return []

        const newlyUnlocked: string[] = []

        // Batch fetch stats only if needed (lazy loading)
        let stats: any = null
        const needsStats = relevantAchievements.some(a => 
            a.code.startsWith('QUESTIONS_') || 
            a.code.startsWith('TRIPLE_STUMPER_') ||
            a.code.startsWith('CATEGORY_MASTER_') ||
            a.code.startsWith('ACCURACY_') ||
            a.code.startsWith('GAMES_COMPLETED_') ||
            a.code === 'ALL_CATEGORIES_MASTER' ||
            a.code === 'FINAL_JEOPARDY_CORRECT' ||
            a.code === 'FINAL_JEOPARDY_STREAK_5'
        )

        if (needsStats) {
            stats = await getAchievementStats(userId, event)
        }

        // Check each relevant achievement
        for (const achievement of relevantAchievements) {
            if (unlockedCodes.has(achievement.code)) continue

            const shouldUnlock = await checkAchievementUnlock(
                achievement.code,
                userId,
                user,
                stats,
                event
            )

            if (shouldUnlock) {
                try {
                    await prisma.userAchievement.create({
                        data: {
                            userId,
                            achievementId: achievement.id
                        }
                    })
                    newlyUnlocked.push(achievement.code)
                } catch (error: any) {
                    // Handle race condition - achievement might have been unlocked by another request
                    if (error.code !== 'P2002') {
                        console.error(`Error unlocking achievement ${achievement.code}:`, error)
                    }
                }
            }
        }

        return newlyUnlocked
    } catch (error) {
        console.error('Error checking achievements:', error)
        return []
    }
}

/**
 * Efficiently fetch only the stats needed for achievement checks
 * Uses batched queries to minimize database round trips
 */
async function getAchievementStats(userId: string, event: AchievementEvent) {
    // Batch all queries in parallel
    const [
        totalQuestions,
        totalTripleStumpers,
        totalGames,
        dailyChallengeStreak,
        categoryStats,
        finalJeopardyCorrect,
        accuracyStats
    ] = await Promise.all([
        prisma.gameHistory.count({ where: { userId } }),
        prisma.gameHistory.count({
            where: {
                userId,
                correct: true,
                question: { wasTripleStumper: true }
            }
        }),
        prisma.game.count({
            where: { userId, status: 'COMPLETED' }
        }),
        getDailyChallengeStreak(userId),
        getCategoryStats(userId),
        prisma.gameHistory.count({
            where: {
                userId,
                correct: true,
                question: { round: 'FINAL' }
            }
        }),
        getAccuracyStats(userId)
    ])

    return {
        totalQuestions,
        totalTripleStumpers,
        totalGames,
        dailyChallengeStreak,
        categoryStats,
        finalJeopardyCorrect,
        accuracyStats
    }
}

/**
 * Check if a specific achievement should be unlocked
 * Only called for achievements relevant to the current event
 */
async function checkAchievementUnlock(
    code: string,
    userId: string,
    user: { currentStreak: number; longestStreak: number; lastGameDate: Date | null },
    stats: any,
    event: AchievementEvent
): Promise<boolean> {
    switch (code) {
        // ============================================
        // ONBOARDING & EARLY WINS
        // ============================================
        case 'FIRST_GAME':
            return stats?.totalGames >= 1

        case 'FIRST_CORRECT':
            return stats?.totalQuestions > 0 && await hasCorrectAnswer(userId)

        case 'FIRST_DAILY_CHALLENGE':
            const dailyCount = await prisma.userDailyChallenge.count({ where: { userId } })
            return dailyCount >= 1

        case 'FIRST_TRIPLE_STUMPER':
            return stats?.totalTripleStumpers >= 1

        case 'FIRST_PERFECT_ROUND':
            if (event.type === 'game_completed' && event.data?.gameId) {
                return await checkPerfectRound(event.data.gameId)
            }
            return false

        // ============================================
        // STREAK ACHIEVEMENTS
        // ============================================
        case 'STREAK_3':
            return user.currentStreak >= 3

        case 'STREAK_7':
        case 'STREAK_MASTER_7':
            return user.currentStreak >= 7

        case 'STREAK_14':
            return user.currentStreak >= 14

        case 'STREAK_30':
        case 'STREAK_MASTER_30':
            return user.currentStreak >= 30

        case 'STREAK_100':
            return user.currentStreak >= 100

        case 'STREAK_69':
            return user.currentStreak >= 69

        case 'DAILY_CHALLENGE_STREAK_3':
            return stats?.dailyChallengeStreak >= 3

        case 'DAILY_CHALLENGE_STREAK_7':
            return stats?.dailyChallengeStreak >= 7

        case 'DAILY_CHALLENGE_STREAK_30':
            return stats?.dailyChallengeStreak >= 30

        case 'RETURNING_PLAYER':
            if (!user.lastGameDate) return false
            const daysSinceLastGame = Math.floor(
                (Date.now() - new Date(user.lastGameDate).getTime()) / (1000 * 60 * 60 * 24)
            )
            return daysSinceLastGame >= 7 && user.currentStreak === 1

        // ============================================
        // VOLUME & MASTERY ACHIEVEMENTS
        // ============================================
        case 'QUESTIONS_50':
            return (stats?.totalQuestions || 0) >= 50

        case 'QUESTIONS_100':
        case 'QUESTIONS_MASTER_100':
            return (stats?.totalQuestions || 0) >= 100

        case 'QUESTIONS_500':
            return (stats?.totalQuestions || 0) >= 500

        case 'QUESTIONS_1000':
        case 'QUESTIONS_MASTER_1000':
            return (stats?.totalQuestions || 0) >= 1000

        case 'QUESTIONS_5000':
            return (stats?.totalQuestions || 0) >= 5000

        case 'QUESTIONS_1337':
            return (stats?.totalQuestions || 0) >= 1337

        case 'TRIPLE_STUMPER_10':
        case 'TRIPLE_STUMPER_MASTER':
            return (stats?.totalTripleStumpers || 0) >= 10

        case 'TRIPLE_STUMPER_50':
            return (stats?.totalTripleStumpers || 0) >= 50

        case 'TRIPLE_STUMPER_100':
            return (stats?.totalTripleStumpers || 0) >= 100

        case 'GAMES_COMPLETED_10':
            return (stats?.totalGames || 0) >= 10

        case 'GAMES_COMPLETED_50':
            return (stats?.totalGames || 0) >= 50

        case 'GAMES_COMPLETED_100':
            return (stats?.totalGames || 0) >= 100

        // ============================================
        // SKILL-BASED ACHIEVEMENTS
        // ============================================
        case 'PERFECT_ROUND':
            if (event.type === 'game_completed' && event.data?.gameId) {
                return await checkPerfectRound(event.data.gameId)
            }
            return false

        case 'PERFECT_GAME':
            if (event.type === 'game_completed' && event.data?.gameId) {
                return await checkPerfectGame(event.data.gameId)
            }
            return false

        case 'PERFECT_ROUND_DOUBLE_JEOPARDY':
            if (event.type === 'game_completed' && event.data?.gameId) {
                return await checkPerfectRound(event.data.gameId, 'DOUBLE')
            }
            return false

        case 'SCORE_5000':
            return event.data?.finalScore !== undefined && event.data.finalScore >= 5000

        case 'SCORE_10000':
        case 'SCORE_MASTER_10000':
            return event.data?.finalScore !== undefined && event.data.finalScore >= 10000

        case 'SCORE_15000':
            return event.data?.finalScore !== undefined && event.data.finalScore >= 15000

        case 'SCORE_20000':
        case 'SCORE_MASTER_20000':
            return event.data?.finalScore !== undefined && event.data.finalScore >= 20000

        case 'SCORE_30000':
            return event.data?.finalScore !== undefined && event.data.finalScore >= 30000

        case 'SCORE_1984':
            return event.data?.finalScore !== undefined && event.data.finalScore === 1984

        case 'ACCURACY_80_PERCENT':
            return (stats?.accuracyStats?.accuracy80 || 0) >= 50

        case 'ACCURACY_90_PERCENT':
            return (stats?.accuracyStats?.accuracy90 || 0) >= 100

        case 'ACCURACY_95_PERCENT':
            return (stats?.accuracyStats?.accuracy95 || 0) >= 200

        case 'FINAL_JEOPARDY_CORRECT':
            return (stats?.finalJeopardyCorrect || 0) >= 1

        case 'FINAL_JEOPARDY_STREAK_5':
            return (stats?.finalJeopardyCorrect || 0) >= 5

        // ============================================
        // KNOWLEDGE & CATEGORY ACHIEVEMENTS
        // ============================================
        case 'CATEGORY_MASTER_GEOGRAPHY':
            return (stats?.categoryStats?.GEOGRAPHY_AND_HISTORY || 0) >= 50

        case 'CATEGORY_MASTER_ENTERTAINMENT':
            return (stats?.categoryStats?.ENTERTAINMENT || 0) >= 50

        case 'CATEGORY_MASTER_ARTS':
            return (stats?.categoryStats?.ARTS_AND_LITERATURE || 0) >= 50

        case 'CATEGORY_MASTER_SCIENCE':
            return (stats?.categoryStats?.SCIENCE_AND_NATURE || 0) >= 50

        case 'CATEGORY_MASTER_SPORTS':
            return (stats?.categoryStats?.SPORTS_AND_LEISURE || 0) >= 50

        case 'CATEGORY_MASTER_GENERAL':
            return (stats?.categoryStats?.GENERAL_KNOWLEDGE || 0) >= 50

        case 'ALL_CATEGORIES_MASTER':
            if (!stats?.categoryStats) return false
            return Object.values(stats.categoryStats).every((count: any) => count >= 50)

        // ============================================
        // HIDDEN & PLAYFUL ACHIEVEMENTS
        // ============================================
        case 'DAILY_CHALLENGE_MIDNIGHT':
            if (event.type === 'daily_challenge_completed') {
                const now = new Date()
                const hour = now.getHours()
                return hour >= 0 && hour < 3
            }
            return false

        case 'ALL_HIDDEN':
            // Check if user has unlocked all other hidden achievements
            const hiddenCodes = [
                'STREAK_69',
                'QUESTIONS_1337',
                'SCORE_1984',
                'DAILY_CHALLENGE_MIDNIGHT',
                'PERFECT_ROUND_DOUBLE_JEOPARDY'
            ]
            const unlockedCodes = await prisma.userAchievement.findMany({
                where: { userId },
                include: { achievement: { select: { code: true } } }
            })
            const unlockedSet = new Set(unlockedCodes.map(ua => ua.achievement.code))
            return hiddenCodes.every(code => unlockedSet.has(code))

        default:
            return false
    }
}

/**
 * Helper: Check if user has at least one correct answer
 */
async function hasCorrectAnswer(userId: string): Promise<boolean> {
    const count = await prisma.gameHistory.count({
        where: { userId, correct: true },
        take: 1
    })
    return count > 0
}

/**
 * Helper: Get daily challenge streak efficiently
 */
async function getDailyChallengeStreak(userId: string): Promise<number> {
    const recentChallenges = await prisma.userDailyChallenge.findMany({
        where: { userId },
        include: { challenge: { select: { date: true } } },
        orderBy: { completedAt: 'desc' },
        take: 30
    })

    if (recentChallenges.length === 0) return 0

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < recentChallenges.length; i++) {
        const challengeDate = new Date(recentChallenges[i].challenge.date)
        challengeDate.setHours(0, 0, 0, 0)

        const expectedDate = new Date(today)
        expectedDate.setDate(today.getDate() - i)

        if (challengeDate.getTime() === expectedDate.getTime()) {
            streak++
        } else {
            break
        }
    }

    return streak
}

/**
 * Helper: Get category mastery stats efficiently
 */
async function getCategoryStats(userId: string): Promise<Record<KnowledgeCategory, number>> {
    // Get all correct answers with their question categories in one query
    const correctAnswers = await prisma.gameHistory.findMany({
        where: {
            userId,
            correct: true
        },
        select: {
            questionId: true,
            question: {
                select: {
                    knowledgeCategory: true
                }
            }
        }
    })

    // Count unique questions per category
    const categoryQuestionSets = new Map<KnowledgeCategory, Set<string>>()
    const categoryCounts: Record<KnowledgeCategory, number> = {
        GEOGRAPHY_AND_HISTORY: 0,
        ENTERTAINMENT: 0,
        ARTS_AND_LITERATURE: 0,
        SCIENCE_AND_NATURE: 0,
        SPORTS_AND_LEISURE: 0,
        GENERAL_KNOWLEDGE: 0
    }

    // Initialize sets
    Object.keys(categoryCounts).forEach(cat => {
        categoryQuestionSets.set(cat as KnowledgeCategory, new Set())
    })

    // Count unique questions per category
    for (const answer of correctAnswers) {
        const category = answer.question.knowledgeCategory
        const questionSet = categoryQuestionSets.get(category)
        if (questionSet) {
            questionSet.add(answer.questionId)
        }
    }

    // Convert sets to counts
    categoryQuestionSets.forEach((questionSet, category) => {
        categoryCounts[category] = questionSet.size
    })

    return categoryCounts
}

/**
 * Helper: Check if a specific game has a perfect round
 */
async function checkPerfectRound(gameId: string, round?: 'SINGLE' | 'DOUBLE'): Promise<boolean> {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
            questions: {
                include: { question: { select: { round: true } } }
            }
        }
    })

    if (!game) return false

    const roundQuestions = round
        ? game.questions.filter(q => q.question.round === round)
        : game.questions

    const answered = roundQuestions.filter(q => q.answered)
    if (answered.length === 0) return false

    const correct = answered.filter(q => q.correct)
    return correct.length === answered.length
}

/**
 * Helper: Check if a game is perfect (all questions correct)
 */
async function checkPerfectGame(gameId: string): Promise<boolean> {
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
            questions: true
        }
    })

    if (!game) return false

    const answered = game.questions.filter(q => q.answered)
    if (answered.length === 0) return false

    const correct = answered.filter(q => q.correct)
    return correct.length === answered.length && answered.length === game.questions.length
}

/**
 * Helper: Get accuracy statistics efficiently
 */
async function getAccuracyStats(userId: string): Promise<{
    accuracy80: number
    accuracy90: number
    accuracy95: number
}> {
    // Get recent question history for accuracy calculations (limit to avoid huge queries)
    const recentHistory = await prisma.gameHistory.findMany({
        where: { userId },
        select: { correct: true },
        orderBy: { timestamp: 'desc' },
        take: 500
    })

    if (recentHistory.length === 0) {
        return { accuracy80: 0, accuracy90: 0, accuracy95: 0 }
    }

    // Calculate accuracy for different sample sizes
    const accuracy80 = calculateAccuracy(recentHistory.slice(0, 50))
    const accuracy90 = calculateAccuracy(recentHistory.slice(0, 100))
    const accuracy95 = calculateAccuracy(recentHistory.slice(0, 200))

    return {
        accuracy80: accuracy80 >= 0.8 ? recentHistory.slice(0, 50).length : 0,
        accuracy90: accuracy90 >= 0.9 ? recentHistory.slice(0, 100).length : 0,
        accuracy95: accuracy95 >= 0.95 ? recentHistory.slice(0, 200).length : 0
    }
}

/**
 * Helper: Calculate accuracy percentage
 */
function calculateAccuracy(history: { correct: boolean }[]): number {
    if (history.length === 0) return 0
    const correct = history.filter(h => h.correct).length
    return correct / history.length
}
