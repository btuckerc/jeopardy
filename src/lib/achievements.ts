import { prisma } from './prisma'

/**
 * Check and unlock achievements for a user
 * Called after significant events (game completion, question answered, etc.)
 */
export async function checkAndUnlockAchievements(userId: string, event: {
    type: 'game_completed' | 'question_answered' | 'streak_milestone' | 'score_milestone' | 'daily_challenge_completed'
    data?: any
}) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                achievements: {
                    include: { achievement: true }
                },
                games: {
                    where: { status: 'COMPLETED' }
                },
                gameHistory: true
            }
        })

        if (!user) return []

        const unlockedAchievementIds = new Set(user.achievements.map(ua => ua.achievementId))
        const newlyUnlocked: string[] = []

        // Get all achievements
        const allAchievements = await prisma.achievement.findMany()

        for (const achievement of allAchievements) {
            // Skip if already unlocked
            if (unlockedAchievementIds.has(achievement.id)) continue

            let shouldUnlock = false

            switch (achievement.code) {
                case 'FIRST_GAME':
                    shouldUnlock = user.games.length >= 1
                    break

                case 'PERFECT_ROUND':
                    // Check if user has a game with 100% accuracy in a round
                    if (event.type === 'game_completed' && event.data?.gameId) {
                        const game = await prisma.game.findUnique({
                            where: { id: event.data.gameId },
                            include: {
                                questions: {
                                    include: { question: true }
                                }
                            }
                        })
                        if (game) {
                            const answered = game.questions.filter(q => q.answered)
                            const correct = answered.filter(q => q.correct)
                            if (answered.length > 0 && correct.length === answered.length) {
                                shouldUnlock = true
                            }
                        }
                    }
                    break

                case 'TRIPLE_STUMPER_MASTER':
                    // Check if user has answered 10+ triple stumpers correctly
                    const tripleStumpersCorrect = await prisma.gameHistory.count({
                        where: {
                            userId,
                            correct: true,
                            question: {
                                wasTripleStumper: true
                            }
                        }
                    })
                    shouldUnlock = tripleStumpersCorrect >= 10
                    break

                case 'STREAK_MASTER_7':
                    shouldUnlock = user.currentStreak >= 7
                    break

                case 'STREAK_MASTER_30':
                    shouldUnlock = user.currentStreak >= 30
                    break

                case 'SCORE_MASTER_10000':
                    if (event.type === 'game_completed' && event.data?.finalScore) {
                        shouldUnlock = event.data.finalScore >= 10000
                    }
                    break

                case 'SCORE_MASTER_20000':
                    if (event.type === 'game_completed' && event.data?.finalScore) {
                        shouldUnlock = event.data.finalScore >= 20000
                    }
                    break

                case 'DAILY_CHALLENGE_STREAK_7':
                    // Check if user has completed 7 daily challenges in a row
                    const recentChallenges = await prisma.userDailyChallenge.findMany({
                        where: { userId },
                        include: { challenge: true },
                        orderBy: { completedAt: 'desc' },
                        take: 7
                    })
                    if (recentChallenges.length === 7) {
                        // Check if they're consecutive days
                        let consecutive = true
                        for (let i = 0; i < recentChallenges.length - 1; i++) {
                            const date1 = new Date(recentChallenges[i].challenge.date)
                            const date2 = new Date(recentChallenges[i + 1].challenge.date)
                            const daysDiff = Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
                            if (daysDiff !== 1) {
                                consecutive = false
                                break
                            }
                        }
                        shouldUnlock = consecutive
                    }
                    break

                case 'QUESTIONS_MASTER_100':
                    const totalAnswered = await prisma.gameHistory.count({
                        where: { userId }
                    })
                    shouldUnlock = totalAnswered >= 100
                    break

                case 'QUESTIONS_MASTER_1000':
                    const totalAnswered1000 = await prisma.gameHistory.count({
                        where: { userId }
                    })
                    shouldUnlock = totalAnswered1000 >= 1000
                    break
            }

            if (shouldUnlock) {
                await prisma.userAchievement.create({
                    data: {
                        userId,
                        achievementId: achievement.id
                    }
                })
                newlyUnlocked.push(achievement.code)
            }
        }

        return newlyUnlocked
    } catch (error) {
        console.error('Error checking achievements:', error)
        return []
    }
}

