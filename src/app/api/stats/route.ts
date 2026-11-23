import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    forbiddenResponse,
    serverErrorResponse,
    parseSearchParams,
    getAuthenticatedUser
} from '@/lib/api-utils'
import { withInstrumentation } from '@/lib/api-instrumentation'
import { NextRequest } from 'next/server'
import { getStatsPoints, FINAL_STATS_CLUE_VALUE, DEFAULT_STATS_CLUE_VALUE } from '@/lib/scoring'
import { getPlayableQuestionSql, getPlayableQuestionWhere } from '@/lib/question-policy'

export const dynamic = 'force-dynamic'

// Request validation schema - userId can be UUID or CUID
const statsParamsSchema = z.object({
    userId: z.string().optional()
})

export const GET = withInstrumentation(async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, statsParamsSchema)
        
        if (error) return error

        // Get requesting user if authenticated
        const requestingUser = await getAuthenticatedUser()

        // Get userId from params or authenticated user
        let userId = params.userId
        if (!userId) {
            userId = requestingUser?.id
        } else if (requestingUser && userId !== requestingUser.id && requestingUser.role !== 'ADMIN') {
            return forbiddenResponse('Cannot access statistics for another user')
        } else if (!requestingUser) {
            return forbiddenResponse('Sign in to access another user\'s statistics')
        }

        const playableWhere = getPlayableQuestionWhere('ORIGINAL_ENGINE')
        const playableSql = getPlayableQuestionSql('q', 'ORIGINAL_ENGINE')

        if (!userId) {
            // For public stats, return general statistics for the active ORIGINAL_ENGINE pool
            const totalQuestions = await prisma.question.count({ where: playableWhere })
            const totalCategories = await prisma.category.count({ where: { source: 'ORIGINAL_ENGINE' } })
            
            return jsonResponse({
                totalQuestions,
                totalCategories,
                totalAnswered: 0,
                correctAnswers: 0,
                totalPoints: 0,
                tripleStumpersAnswered: 0,
                categoryStats: [],
                knowledgeCategoryStats: []
            })
        }
        // Get knowledge category totals (active ORIGINAL_ENGINE pool)
        const knowledgeCategoryTotals = await prisma.$queryRaw`
            SELECT 
                q."knowledgeCategory",
                COUNT(DISTINCT q.id) as total_questions
            FROM "Question" q
            WHERE ${playableSql}
            GROUP BY q."knowledgeCategory"
        ` as Array<{ knowledgeCategory: string; total_questions: number }>

        // Get latest answers for each question with knowledge categories
        const latestAnswers = await prisma.$queryRaw`
            WITH LatestAnswers AS (
                SELECT DISTINCT ON ("questionId") 
                    "questionId",
                    correct,
                    points,
                    timestamp
                FROM "GameHistory"
                WHERE "userId" = ${userId}
                ORDER BY "questionId", timestamp DESC
            )
            SELECT 
                la.*,
                q."wasTripleStumper",
                q.difficulty,
                q."categoryId",
                q."knowledgeCategory",
                q.round,
                q.value,
                q.source,
                q."publishStatus",
                c.name as "categoryName"
            FROM LatestAnswers la
            JOIN "Question" q ON q.id = la."questionId"
            JOIN "Category" c ON c.id = q."categoryId"
        ` as Array<{
            questionId: string
            correct: boolean
            points: number
            wasTripleStumper: boolean
            difficulty: string
            categoryId: string
            categoryName: string
            knowledgeCategory: string
            round: string
            value: number | null
            source: string
            publishStatus: string
        }>

        // Get round breakdown for active ORIGINAL_ENGINE questions
        const allQuestionsRoundBreakdown = await prisma.$queryRaw`
            SELECT 
                q."categoryId",
                q.round,
                COUNT(*) as question_count
            FROM "Question" q
            WHERE ${playableSql}
            GROUP BY q."categoryId", q.round
        ` as Array<{
            categoryId: string
            round: string
            question_count: number
        }>

        // Get total triple stumper / hard-tier challenge count per category (active ORIGINAL_ENGINE pool)
        const tripleStumpersTotal = await prisma.$queryRaw`
            SELECT 
                q."categoryId",
                COUNT(*) as triple_stumper_count
            FROM "Question" q
            WHERE (q."wasTripleStumper" = true OR q.difficulty = 'HARD') AND ${playableSql}
            GROUP BY q."categoryId"
        ` as Array<{
            categoryId: string
            triple_stumper_count: number
        }>

        // Calculate lifetime total statistics across ALL historical + original answers
        const totalPoints = latestAnswers
            .filter(record => record.correct)
            .reduce((sum, record) => {
                return sum + getStatsPoints({
                    round: record.round,
                    faceValue: record.value,
                    correct: record.correct,
                    storedPoints: record.points
                })
            }, 0)

        const totalAnswered = latestAnswers.length
        const correctAnswers = latestAnswers.filter(record => record.correct).length
        const tripleStumpersAnswered = latestAnswers
            .filter(record => record.correct && (record.wasTripleStumper || (record.source === 'ORIGINAL_ENGINE' && record.difficulty === 'HARD')))
            .length

        // Scope progress ratios strictly to published ORIGINAL_ENGINE so numerators and denominators match
        const originalLatestAnswers = latestAnswers.filter(
            a => a.source === 'ORIGINAL_ENGINE' && a.publishStatus === 'PUBLISHED'
        )
        const originalTotalAnswered = originalLatestAnswers.length
        const originalCorrectAnswers = originalLatestAnswers.filter(a => a.correct).length

        // Calculate knowledge category stats (numerator & denominator both scoped to ORIGINAL_ENGINE)
        const knowledgeCategoryStats = knowledgeCategoryTotals.map(kc => {
            const answersInCategory = originalLatestAnswers.filter(
                a => a.knowledgeCategory === kc.knowledgeCategory
            )
            const correctAnswersInCategory = answersInCategory.filter(a => a.correct)

            return {
                categoryName: kc.knowledgeCategory.replace(/_/g, ' '),
                correct: correctAnswersInCategory.length,
                total: Number(kc.total_questions),
                points: correctAnswersInCategory.reduce((sum, a) => {
                    return sum + getStatsPoints({
                        round: a.round,
                        faceValue: a.value,
                        correct: a.correct,
                        storedPoints: a.points
                    })
                }, 0)
            }
        })

        // Include all ORIGINAL_ENGINE categories + only legacy categories where the user has recorded answers
        const answeredCategoryIds = Array.from(new Set(latestAnswers.map(a => a.categoryId)))
        const categories = await prisma.category.findMany({
            where: {
                OR: [
                    { source: 'ORIGINAL_ENGINE' },
                    ...(answeredCategoryIds.length > 0 ? [{ id: { in: answeredCategoryIds } }] : [])
                ]
            },
            include: {
                _count: {
                    select: {
                        questions: {
                            where: { publishStatus: 'PUBLISHED' }
                        }
                    }
                },
                questions: {
                    where: { publishStatus: 'PUBLISHED' },
                    orderBy: {
                        airDate: 'desc'
                    },
                    take: 1,
                    select: {
                        airDate: true
                    }
                }
            }
        })

        const categoryStatsMap = categories.reduce((acc, category) => {
            acc[category.id] = {
                categoryId: category.id,
                categoryName: category.name,
                source: category.source,
                correct: 0,
                total: category._count.questions,
                points: 0,
                mostRecentAirDate: category.questions[0]?.airDate,
                roundBreakdown: {
                    SINGLE: 0,
                    DOUBLE: 0,
                    FINAL: 0
                },
                roundBreakdownTotal: {
                    SINGLE: 0,
                    DOUBLE: 0,
                    FINAL: 0
                },
                tripleStumpersCorrect: 0,
                tripleStumpersTotal: 0
            }
            return acc
        }, {} as Record<string, {
            categoryId: string
            categoryName: string
            source: string
            correct: number
            total: number
            points: number
            mostRecentAirDate: Date | null
            roundBreakdown: {
                SINGLE: number
                DOUBLE: number
                FINAL: number
            }
            roundBreakdownTotal: {
                SINGLE: number
                DOUBLE: number
                FINAL: number
            }
            tripleStumpersCorrect: number
            tripleStumpersTotal: number
        }>)

        // Populate round breakdown for all questions
        allQuestionsRoundBreakdown.forEach(record => {
            if (categoryStatsMap[record.categoryId] && (record.round === 'SINGLE' || record.round === 'DOUBLE' || record.round === 'FINAL')) {
                categoryStatsMap[record.categoryId].roundBreakdownTotal[record.round as 'SINGLE' | 'DOUBLE' | 'FINAL'] = Number(record.question_count)
            }
        })

        // Populate total triple stumper count per category
        tripleStumpersTotal.forEach(record => {
            if (categoryStatsMap[record.categoryId]) {
                categoryStatsMap[record.categoryId].tripleStumpersTotal = Number(record.triple_stumper_count)
            }
        })

        latestAnswers.forEach(record => {
            if (record.correct) {
                const categoryStat = categoryStatsMap[record.categoryId]
                if (!categoryStat) return
                // For active ORIGINAL_ENGINE categories, keep category progress numerator aligned with published denominator
                if (categoryStat.source === 'ORIGINAL_ENGINE' && record.publishStatus !== 'PUBLISHED') {
                    return
                }
                categoryStat.correct++
                categoryStat.points += getStatsPoints({
                    round: record.round,
                    faceValue: record.value,
                    correct: record.correct,
                    storedPoints: record.points
                })
                
                // Track round breakdown
                if (record.round === 'SINGLE' || record.round === 'DOUBLE' || record.round === 'FINAL') {
                    categoryStat.roundBreakdown[record.round as 'SINGLE' | 'DOUBLE' | 'FINAL']++
                }
                
                // Track triple stumpers / hard-tier originals
                if (record.wasTripleStumper || (record.source === 'ORIGINAL_ENGINE' && record.difficulty === 'HARD')) {
                    categoryStat.tripleStumpersCorrect++
                }
            }
        })

        const categoryStats = Object.values(categoryStatsMap)
        const totalQuestions = await prisma.question.count({ where: playableWhere })

        // Calculate round-based stats (Single, Double, Final) for the active ORIGINAL_ENGINE pool
        const roundTotals = await prisma.$queryRaw`
            SELECT 
                q.round,
                COUNT(DISTINCT q.id) as total_questions
            FROM "Question" q
            WHERE ${playableSql}
            GROUP BY q.round
        ` as Array<{ round: string; total_questions: number }>

        const roundAnswers = await prisma.$queryRaw`
            WITH LatestAnswers AS (
                SELECT DISTINCT ON (gh."questionId") 
                    gh."questionId",
                    gh.correct,
                    gh.points
                FROM "GameHistory" gh
                WHERE gh."userId" = ${userId}
                ORDER BY gh."questionId", gh.timestamp DESC
            )
            SELECT 
                q.round,
                COUNT(*) as total_answered,
                SUM(CASE WHEN la.correct THEN 1 ELSE 0 END) as correct_count,
                SUM(CASE 
                    WHEN la.correct AND q.round = 'FINAL' THEN ${FINAL_STATS_CLUE_VALUE}
                    WHEN la.correct THEN COALESCE(q.value, ${DEFAULT_STATS_CLUE_VALUE})
                    ELSE 0 
                END) as total_points
            FROM LatestAnswers la
            JOIN "Question" q ON q.id = la."questionId"
            WHERE ${playableSql}
            GROUP BY q.round
        ` as Array<{ 
            round: string
            total_answered: number
            correct_count: number
            total_points: number 
        }>

        const roundStats = ['SINGLE', 'DOUBLE', 'FINAL'].map(round => {
            const roundTotal = roundTotals.find(r => r.round === round)
            const roundAnswer = roundAnswers.find(r => r.round === round)
            
            return {
                round,
                roundName: round === 'SINGLE' ? 'Single Jeopardy' : 
                           round === 'DOUBLE' ? 'Double Jeopardy' : 'Final Jeopardy',
                totalQuestions: Number(roundTotal?.total_questions || 0),
                totalAnswered: Number(roundAnswer?.total_answered || 0),
                correctAnswers: Number(roundAnswer?.correct_count || 0),
                totalPoints: Number(roundAnswer?.total_points || 0),
                accuracy: roundAnswer && Number(roundAnswer.total_answered) > 0 
                    ? Math.round((Number(roundAnswer.correct_count) / Number(roundAnswer.total_answered)) * 100) 
                    : 0
            }
        })

        return jsonResponse({
            totalPoints,
            totalQuestions,
            totalAnswered,
            correctAnswers,
            originalTotalAnswered,
            originalCorrectAnswers,
            tripleStumpersAnswered,
            accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
            knowledgeCategoryStats,
            categoryStats,
            roundStats
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch statistics', error)
    }
})
