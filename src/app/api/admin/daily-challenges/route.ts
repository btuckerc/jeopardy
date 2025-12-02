import { prisma } from '@/lib/prisma'
import { jsonResponse, serverErrorResponse, requireAdmin } from '@/lib/api-utils'

/**
 * GET /api/admin/daily-challenges
 * Get daily challenge status and statistics
 * Includes pool size, duplicate detection, and usage statistics
 * Admin only
 */
export async function GET(request: Request) {
    try {
        const { error: authError } = await requireAdmin()
        if (authError) return authError

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Get challenges for the next 30 days
        const futureDate = new Date(today)
        futureDate.setDate(futureDate.getDate() + 30)

        const challenges = await prisma.dailyChallenge.findMany({
            where: {
                date: {
                    gte: today,
                    lte: futureDate
                }
            },
            include: {
                question: {
                    include: {
                        category: true
                    }
                },
                completions: {
                    select: {
                        id: true
                    }
                }
            },
            orderBy: {
                date: 'asc'
            }
        })

        // Count total completions
        const totalCompletions = await prisma.userDailyChallenge.count({
            where: {
                challenge: {
                    date: {
                        gte: today,
                        lte: futureDate
                    }
                }
            }
        })

        // Get today's challenge
        const todayChallenge = challenges.find(c => {
            const challengeDate = new Date(c.date)
            challengeDate.setHours(0, 0, 0, 0)
            return challengeDate.getTime() === today.getTime()
        })

        // Count how many days are covered
        const daysCovered = challenges.length
        const daysNeeded = 30

        // Get all used question IDs (for duplicate detection)
        const allUsedQuestionIds = await prisma.dailyChallenge.findMany({
            select: { questionId: true }
        })

        // Check for duplicate questionIds (should be impossible with unique constraint, but useful for sanity check)
        const questionIdCounts = new Map<string, number>()
        allUsedQuestionIds.forEach(c => {
            questionIdCounts.set(c.questionId, (questionIdCounts.get(c.questionId) || 0) + 1)
        })
        const duplicates = Array.from(questionIdCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([questionId, count]) => ({ questionId, count }))

        // Calculate pool statistics
        const MIN_DAYS_AGO = 730  // 2 years
        const MAX_DAYS_AGO = 1825 // 5 years
        
        const preferredMinDate = new Date(today)
        preferredMinDate.setDate(preferredMinDate.getDate() - MAX_DAYS_AGO)
        preferredMinDate.setHours(0, 0, 0, 0)
        
        const preferredMaxDate = new Date(today)
        preferredMaxDate.setDate(preferredMaxDate.getDate() - MIN_DAYS_AGO)
        preferredMaxDate.setHours(23, 59, 59, 999)

        // Get date range of available Final Jeopardy questions
        const dateRange = await prisma.question.aggregate({
            where: {
                round: 'FINAL',
                airDate: { not: null }
            },
            _min: { airDate: true },
            _max: { airDate: true }
        })

        // Count total Final Jeopardy questions
        const totalFinalQuestions = await prisma.question.count({
            where: {
                round: 'FINAL',
                airDate: { not: null }
            }
        })

        // Count unused Final Jeopardy questions (globally)
        const usedQuestionIdsSet = new Set(allUsedQuestionIds.map(c => c.questionId))
        const unusedFinalQuestions = await prisma.question.count({
            where: {
                round: 'FINAL',
                airDate: { not: null },
                id: {
                    notIn: Array.from(usedQuestionIdsSet)
                }
            }
        })

        // Count unused questions in preferred window
        let unusedInPreferredWindow = 0
        if (dateRange._min.airDate && dateRange._max.airDate) {
            const dbMinDate = new Date(dateRange._min.airDate)
            const dbMaxDate = new Date(dateRange._max.airDate)
            
            // Intersect preferred range with available range
            const minDate = preferredMinDate > dbMinDate ? preferredMinDate : dbMinDate
            const maxDate = preferredMaxDate < dbMaxDate ? preferredMaxDate : dbMaxDate
            
            if (minDate <= maxDate) {
                unusedInPreferredWindow = await prisma.question.count({
                    where: {
                        round: 'FINAL',
                        airDate: {
                            gte: minDate,
                            lte: maxDate
                        },
                        id: {
                            notIn: Array.from(usedQuestionIdsSet)
                        }
                    }
                })
            }
        }

        // Get all challenges (not just future) for calendar view
        const allChallenges = await prisma.dailyChallenge.findMany({
            select: {
                id: true,
                date: true,
                questionId: true,
                airDate: true
            },
            orderBy: {
                date: 'desc'
            },
            take: 100 // Last 100 challenges
        })

        return jsonResponse({
            challenges: challenges.map(c => ({
                id: c.id,
                date: c.date,
                questionId: c.questionId,
                airDate: c.airDate,
                completionCount: c.completions.length
            })),
            stats: {
                daysCovered,
                daysNeeded,
                coverage: daysCovered >= daysNeeded ? 100 : Math.round((daysCovered / daysNeeded) * 100),
                totalCompletions,
                todayChallenge: todayChallenge ? {
                    id: todayChallenge.id,
                    date: todayChallenge.date,
                    questionId: todayChallenge.questionId,
                    airDate: todayChallenge.airDate,
                    completionCount: todayChallenge.completions.length
                } : null
            },
            poolStats: {
                totalFinalQuestions,
                usedQuestions: usedQuestionIdsSet.size,
                unusedQuestions: unusedFinalQuestions,
                unusedInPreferredWindow,
                preferredWindow: {
                    minDate: preferredMinDate.toISOString(),
                    maxDate: preferredMaxDate.toISOString()
                },
                availableDateRange: dateRange._min.airDate && dateRange._max.airDate ? {
                    minDate: dateRange._min.airDate.toISOString(),
                    maxDate: dateRange._max.airDate.toISOString()
                } : null
            },
            duplicates: duplicates.length > 0 ? {
                found: true,
                count: duplicates.length,
                details: duplicates
            } : {
                found: false,
                count: 0
            },
            recentChallenges: allChallenges.map(c => ({
                id: c.id,
                date: c.date,
                questionId: c.questionId,
                airDate: c.airDate
            }))
        })
    } catch (error) {
        return serverErrorResponse('Error fetching daily challenge status', error)
    }
}

