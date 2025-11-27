import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    serverErrorResponse,
    errorResponse,
    parseSearchParams,
    getAuthenticatedUser
} from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// Request validation schema - userId can be UUID or CUID
const statsParamsSchema = z.object({
    userId: z.string().optional()
})

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, statsParamsSchema)
        
        if (error) return error

        // Get userId from params or authenticated user
        let userId = params.userId
        
        if (!userId) {
            const user = await getAuthenticatedUser()
            if (user) {
                userId = user.id
            }
        }

        if (!userId) {
            // For public stats, return general statistics without user-specific data
            const totalQuestions = await prisma.question.count()
            const totalCategories = await prisma.category.count()
            
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
        // Get knowledge category totals
        const knowledgeCategoryTotals = await prisma.$queryRaw`
            SELECT 
                "knowledgeCategory",
                COUNT(DISTINCT id) as total_questions
            FROM "Question"
            GROUP BY "knowledgeCategory"
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
                q."categoryId",
                q."knowledgeCategory",
                c.name as "categoryName"
            FROM LatestAnswers la
            JOIN "Question" q ON q.id = la."questionId"
            JOIN "Category" c ON c.id = q."categoryId"
        ` as Array<{
            questionId: string
            correct: boolean
            points: number
            wasTripleStumper: boolean
            categoryId: string
            categoryName: string
            knowledgeCategory: string
        }>

        // Calculate total statistics
        const totalPoints = latestAnswers
            .filter(record => record.correct)
            .reduce((sum, record) => sum + record.points, 0)

        const totalAnswered = latestAnswers.length
        const correctAnswers = latestAnswers.filter(record => record.correct).length
        const tripleStumpersAnswered = latestAnswers
            .filter(record => record.correct && record.wasTripleStumper)
            .length

        // Calculate knowledge category stats
        const knowledgeCategoryStats = knowledgeCategoryTotals.map(kc => {
            const answersInCategory = latestAnswers.filter(
                a => a.knowledgeCategory === kc.knowledgeCategory
            )
            const correctAnswersInCategory = answersInCategory.filter(a => a.correct)

            return {
                categoryName: kc.knowledgeCategory.replace(/_/g, ' '),
                correct: correctAnswersInCategory.length,
                total: Number(kc.total_questions),
                points: correctAnswersInCategory.reduce((sum, a) => sum + a.points, 0)
            }
        })

        // Calculate category stats
        const categories = await prisma.category.findMany({
            include: {
                _count: {
                    select: { questions: true }
                },
                questions: {
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
                categoryName: category.name,
                correct: 0,
                total: category._count.questions,
                points: 0,
                mostRecentAirDate: category.questions[0]?.airDate
            }
            return acc
        }, {} as Record<string, {
            categoryName: string
            correct: number
            total: number
            points: number
            mostRecentAirDate: Date | null
        }>)

        latestAnswers.forEach(record => {
            if (record.correct) {
                categoryStatsMap[record.categoryId].correct++
                categoryStatsMap[record.categoryId].points += record.points
            }
        })

        const categoryStats = Object.values(categoryStatsMap)
        const totalQuestions = categories.reduce((sum, cat) => sum + cat._count.questions, 0)

        // Calculate round-based stats (Single, Double, Final Jeopardy)
        const roundTotals = await prisma.$queryRaw`
            SELECT 
                round,
                COUNT(DISTINCT id) as total_questions
            FROM "Question"
            GROUP BY round
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
                SUM(CASE WHEN la.correct THEN la.points ELSE 0 END) as total_points
            FROM LatestAnswers la
            JOIN "Question" q ON q.id = la."questionId"
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
            tripleStumpersAnswered,
            accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
            knowledgeCategoryStats,
            categoryStats,
            roundStats
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch statistics', error)
    }
} 