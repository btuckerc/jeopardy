import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/daily-challenge/stats
 * Get daily challenge statistics for the authenticated user
 * Returns totals, streaks (participation and correctness), and history
 */
export async function GET(_request: Request) {
    try {
        const user = await getAppUser()
        if (!user) {
            return unauthorizedResponse()
        }

        // Load all user's daily challenge completions with challenge and question data
        const userChallenges = await prisma.userDailyChallenge.findMany({
            where: { userId: user.id },
            include: {
                challenge: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                challenge: {
                    date: 'desc'
                }
            }
        })

        // Compute totals
        const totalCompleted = userChallenges.length
        const totalCorrect = userChallenges.filter(uc => uc.correct).length
        const totalIncorrect = totalCompleted - totalCorrect
        const accuracy = totalCompleted > 0 ? Math.round((totalCorrect / totalCompleted) * 100) : 0

        // Compute participation streaks (consecutive challenge dates, regardless of correctness)
        // This matches the DAILY_CHALLENGE_STREAK_7 achievement logic
        let currentParticipationStreak = 0
        let longestParticipationStreak = 0
        let tempParticipationStreak = 0
        let lastParticipationDate: Date | null = null

        // Compute correctness streaks (consecutive correct answers)
        let currentCorrectnessStreak = 0
        let longestCorrectnessStreak = 0
        let tempCorrectnessStreak = 0
        let lastCorrectnessDate: Date | null = null

        // Process challenges in chronological order (oldest first) for streak calculation
        const sortedChallenges = [...userChallenges].sort((a, b) => {
            const dateA = new Date(a.challenge.date)
            const dateB = new Date(b.challenge.date)
            return dateA.getTime() - dateB.getTime()
        })

        for (const userChallenge of sortedChallenges) {
            const challengeDate = new Date(userChallenge.challenge.date)
            challengeDate.setHours(0, 0, 0, 0)

            // Participation streak calculation
            if (lastParticipationDate === null) {
                // First challenge
                tempParticipationStreak = 1
                currentParticipationStreak = 1
            } else {
                const lastDate = new Date(lastParticipationDate)
                lastDate.setHours(0, 0, 0, 0)
                const daysDiff = Math.floor((challengeDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

                if (daysDiff === 1) {
                    // Consecutive day
                    tempParticipationStreak++
                } else {
                    // Gap in dates, reset streak
                    tempParticipationStreak = 1
                }
            }

            // Update current participation streak if this is the most recent challenge
            if (userChallenge === sortedChallenges[sortedChallenges.length - 1]) {
                currentParticipationStreak = tempParticipationStreak
            }

            // Update longest participation streak
            if (tempParticipationStreak > longestParticipationStreak) {
                longestParticipationStreak = tempParticipationStreak
            }

            lastParticipationDate = challengeDate

            // Correctness streak calculation
            if (userChallenge.correct) {
                if (lastCorrectnessDate === null) {
                    // First correct answer
                    tempCorrectnessStreak = 1
                    currentCorrectnessStreak = 1
                } else {
                    const lastDate = new Date(lastCorrectnessDate)
                    lastDate.setHours(0, 0, 0, 0)
                    const daysDiff = Math.floor((challengeDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

                    if (daysDiff === 1) {
                        // Consecutive day with correct answer
                        tempCorrectnessStreak++
                    } else {
                        // Gap in dates, reset streak
                        tempCorrectnessStreak = 1
                    }
                }

                // Update current correctness streak if this is the most recent challenge
                if (userChallenge === sortedChallenges[sortedChallenges.length - 1]) {
                    currentCorrectnessStreak = tempCorrectnessStreak
                }

                // Update longest correctness streak
                if (tempCorrectnessStreak > longestCorrectnessStreak) {
                    longestCorrectnessStreak = tempCorrectnessStreak
                }

                lastCorrectnessDate = challengeDate
            } else {
                // Incorrect answer resets correctness streak
                tempCorrectnessStreak = 0
                // Only reset current streak if this is the most recent challenge
                if (userChallenge === sortedChallenges[sortedChallenges.length - 1]) {
                    currentCorrectnessStreak = 0
                }
                // Don't update lastCorrectnessDate - we want to track gaps
            }
        }

        // Build history array (most recent first)
        const history = userChallenges.map(uc => ({
            challengeDate: uc.challenge.date.toISOString().split('T')[0],
            completedAt: uc.completedAt.toISOString(),
            correct: uc.correct,
            questionId: uc.challenge.question.id,
            categoryName: uc.challenge.question.category.name,
            question: uc.challenge.question.question,
            answer: uc.challenge.question.answer,
            airDate: uc.challenge.question.airDate?.toISOString() || null,
            userAnswer: uc.userAnswer || null
        }))

        return jsonResponse({
            totalCompleted,
            totalCorrect,
            totalIncorrect,
            accuracy,
            participationStreak: {
                current: currentParticipationStreak,
                longest: longestParticipationStreak
            },
            correctnessStreak: {
                current: currentCorrectnessStreak,
                longest: longestCorrectnessStreak
            },
            history
        })
    } catch (error) {
        return serverErrorResponse('Error fetching daily challenge stats', error)
    }
}

