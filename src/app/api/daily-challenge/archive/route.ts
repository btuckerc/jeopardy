import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse } from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { getActiveChallengeDate } from '@/lib/daily-challenge-utils'

/**
 * GET /api/daily-challenge/archive
 * Get the last 7 days of daily challenges with user participation status
 */
export const GET = withInstrumentation(async (_request: NextRequest) => {
    try {
        const user = await getAppUser()
        const activeDate = getActiveChallengeDate()
        
        // Calculate the date 6 days ago (to get 7 days total including today)
        const sevenDaysAgo = new Date(activeDate)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
        
        // Fetch all daily challenges in the 7-day window
        const challenges = await prisma.dailyChallenge.findMany({
            where: {
                date: {
                    gte: sevenDaysAgo,
                    lte: activeDate
                }
            },
            include: {
                question: {
                    include: {
                        category: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            }
        })
        
        // Get user participation data if authenticated
        let userParticipations: Record<string, {
            correct: boolean
            completedAt: string
            userAnswerText: string | null
        }> = {}
        
        if (user) {
            const challengeIds = challenges.map(c => c.id)
            const participations = await prisma.userDailyChallenge.findMany({
                where: {
                    userId: user.id,
                    challengeId: {
                        in: challengeIds
                    }
                }
            })
            
            participations.forEach(p => {
                userParticipations[p.challengeId] = {
                    correct: p.correct,
                    completedAt: p.completedAt.toISOString(),
                    userAnswerText: p.userAnswer
                }
            })
        }
        
        // Format the response
        const archiveData = challenges.map(challenge => {
            const participation = userParticipations[challenge.id]
            return {
                id: challenge.id,
                date: challenge.date.toISOString(),
                question: {
                    id: challenge.question.id,
                    question: challenge.question.question,
                    answer: challenge.question.answer,
                    category: challenge.question.category.name,
                    airDate: challenge.question.airDate
                },
                participation: participation ? {
                    correct: participation.correct,
                    completedAt: participation.completedAt,
                    userAnswerText: participation.userAnswerText
                } : null
            }
        })
        
        return jsonResponse({
            challenges: archiveData,
            activeDate: activeDate.toISOString()
        })
    } catch (error) {
        console.error('Error fetching daily challenge archive:', error)
        return jsonResponse({ error: 'Failed to fetch archive' }, 500)
    }
})
