import { prisma } from './prisma'
import { getActiveChallengeDate } from './daily-challenge-utils'

export interface AchievementProgress {
    current: number
    target: number
    percent: number
    displayText: string
}

/**
 * Calculate progress toward an achievement
 * Returns null if progress cannot be calculated or achievement is already unlocked
 */
export async function calculateAchievementProgress(
    achievementCode: string,
    userId: string,
    isUnlocked: boolean
): Promise<AchievementProgress | null> {
    if (isUnlocked) {
        return null // No progress needed if already unlocked
    }

    // Get user stats
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            currentStreak: true,
            longestStreak: true
        }
    })

    if (!user) return null

    // Calculate progress based on achievement code
    switch (achievementCode) {
        // Streak achievements
        case 'STREAK_3':
            return {
                current: user.currentStreak,
                target: 3,
                percent: Math.min(100, (user.currentStreak / 3) * 100),
                displayText: `${user.currentStreak}/3 days`
            }
        case 'STREAK_7':
        case 'STREAK_MASTER_7':
            return {
                current: user.currentStreak,
                target: 7,
                percent: Math.min(100, (user.currentStreak / 7) * 100),
                displayText: `${user.currentStreak}/7 days`
            }
        case 'STREAK_14':
            return {
                current: user.currentStreak,
                target: 14,
                percent: Math.min(100, (user.currentStreak / 14) * 100),
                displayText: `${user.currentStreak}/14 days`
            }
        case 'STREAK_30':
        case 'STREAK_MASTER_30':
            return {
                current: user.currentStreak,
                target: 30,
                percent: Math.min(100, (user.currentStreak / 30) * 100),
                displayText: `${user.currentStreak}/30 days`
            }
        case 'STREAK_100':
            return {
                current: user.currentStreak,
                target: 100,
                percent: Math.min(100, (user.currentStreak / 100) * 100),
                displayText: `${user.currentStreak}/100 days`
            }
        case 'STREAK_69':
            return {
                current: user.currentStreak,
                target: 69,
                percent: Math.min(100, (user.currentStreak / 69) * 100),
                displayText: `${user.currentStreak}/69 days`
            }

        // Volume achievements - questions answered
        case 'QUESTIONS_50': {
            const count = await prisma.gameHistory.count({
                where: { userId }
            })
            return {
                current: count,
                target: 50,
                percent: Math.min(100, (count / 50) * 100),
                displayText: `${count}/50 questions`
            }
        }
        case 'QUESTIONS_100': {
            const count = await prisma.gameHistory.count({
                where: { userId }
            })
            return {
                current: count,
                target: 100,
                percent: Math.min(100, (count / 100) * 100),
                displayText: `${count}/100 questions`
            }
        }
        case 'QUESTIONS_500': {
            const count = await prisma.gameHistory.count({
                where: { userId }
            })
            return {
                current: count,
                target: 500,
                percent: Math.min(100, (count / 500) * 100),
                displayText: `${count}/500 questions`
            }
        }
        case 'QUESTIONS_1000': {
            const count = await prisma.gameHistory.count({
                where: { userId }
            })
            return {
                current: count,
                target: 1000,
                percent: Math.min(100, (count / 1000) * 100),
                displayText: `${count}/1000 questions`
            }
        }
        case 'QUESTIONS_5000': {
            const count = await prisma.gameHistory.count({
                where: { userId }
            })
            return {
                current: count,
                target: 5000,
                percent: Math.min(100, (count / 5000) * 100),
                displayText: `${count}/5000 questions`
            }
        }
        case 'QUESTIONS_1337': {
            const count = await prisma.gameHistory.count({
                where: { userId }
            })
            return {
                current: count,
                target: 1337,
                percent: Math.min(100, (count / 1337) * 100),
                displayText: `${count}/1337 questions`
            }
        }

        // Games completed
        case 'GAMES_COMPLETED_10': {
            const count = await prisma.game.count({
                where: {
                    userId,
                    status: 'COMPLETED'
                }
            })
            return {
                current: count,
                target: 10,
                percent: Math.min(100, (count / 10) * 100),
                displayText: `${count}/10 games`
            }
        }
        case 'GAMES_COMPLETED_50': {
            const count = await prisma.game.count({
                where: {
                    userId,
                    status: 'COMPLETED'
                }
            })
            return {
                current: count,
                target: 50,
                percent: Math.min(100, (count / 50) * 100),
                displayText: `${count}/50 games`
            }
        }
        case 'GAMES_COMPLETED_100': {
            const count = await prisma.game.count({
                where: {
                    userId,
                    status: 'COMPLETED'
                }
            })
            return {
                current: count,
                target: 100,
                percent: Math.min(100, (count / 100) * 100),
                displayText: `${count}/100 games`
            }
        }

        // Triple stumpers
        case 'TRIPLE_STUMPER_10': {
            const count = await prisma.gameHistory.count({
                where: {
                    userId,
                    correct: true,
                    question: {
                        wasTripleStumper: true
                    }
                }
            })
            return {
                current: count,
                target: 10,
                percent: Math.min(100, (count / 10) * 100),
                displayText: `${count}/10 triple stumpers`
            }
        }
        case 'TRIPLE_STUMPER_50': {
            const count = await prisma.gameHistory.count({
                where: {
                    userId,
                    correct: true,
                    question: {
                        wasTripleStumper: true
                    }
                }
            })
            return {
                current: count,
                target: 50,
                percent: Math.min(100, (count / 50) * 100),
                displayText: `${count}/50 triple stumpers`
            }
        }
        case 'TRIPLE_STUMPER_100': {
            const count = await prisma.gameHistory.count({
                where: {
                    userId,
                    correct: true,
                    question: {
                        wasTripleStumper: true
                    }
                }
            })
            return {
                current: count,
                target: 100,
                percent: Math.min(100, (count / 100) * 100),
                displayText: `${count}/100 triple stumpers`
            }
        }

        // Daily challenge streaks
        case 'DAILY_CHALLENGE_STREAK_3': {
            const stats = await getDailyChallengeStreak(userId)
            return {
                current: stats,
                target: 3,
                percent: Math.min(100, (stats / 3) * 100),
                displayText: `${stats}/3 days`
            }
        }
        case 'DAILY_CHALLENGE_STREAK_7': {
            const stats = await getDailyChallengeStreak(userId)
            return {
                current: stats,
                target: 7,
                percent: Math.min(100, (stats / 7) * 100),
                displayText: `${stats}/7 days`
            }
        }
        case 'DAILY_CHALLENGE_STREAK_30': {
            const stats = await getDailyChallengeStreak(userId)
            return {
                current: stats,
                target: 30,
                percent: Math.min(100, (stats / 30) * 100),
                displayText: `${stats}/30 days`
            }
        }

        default:
            return null // No progress tracking for this achievement type
    }
}

async function getDailyChallengeStreak(userId: string): Promise<number> {
    const challenges = await prisma.userDailyChallenge.findMany({
        where: { userId },
        include: {
            challenge: {
                select: { date: true }
            }
        },
        orderBy: {
            challenge: {
                date: 'desc'
            }
        }
    })

    if (challenges.length === 0) return 0

    let streak = 0
    const today = getActiveChallengeDate()

    for (let i = 0; i < challenges.length; i++) {
        const challengeDate = new Date(challenges[i].challenge.date)
        challengeDate.setUTCHours(0, 0, 0, 0)
        
        const expectedDate = new Date(today)
        expectedDate.setUTCDate(today.getUTCDate() - i)
        expectedDate.setUTCHours(0, 0, 0, 0)

        if (challengeDate.getTime() === expectedDate.getTime()) {
            streak++
        } else {
            break
        }
    }

    return streak
}
