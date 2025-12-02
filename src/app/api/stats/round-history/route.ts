import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    serverErrorResponse,
    errorResponse,
    parseSearchParams,
    getAuthenticatedUser
} from '@/lib/api-utils'
import { getStatsPoints } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

const roundHistoryParamsSchema = z.object({
    round: z.enum(['SINGLE', 'DOUBLE', 'FINAL'])
})

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, roundHistoryParamsSchema)
        
        if (error) return error

        const user = await getAuthenticatedUser()
        if (!user) {
            return errorResponse('Authentication required', 401)
        }

        const userId = user.id
        const { round } = params

        // Get all answered questions for this round, ordered by when they were answered (timestamp)
        const answeredQuestions = await prisma.$queryRaw`
            WITH LatestAnswers AS (
                SELECT DISTINCT ON ("questionId") 
                    "questionId",
                    correct,
                    points,
                    timestamp
                FROM "GameHistory"
                WHERE "userId" = ${userId}
                ORDER BY "questionId", timestamp DESC
            ),
            LastIncorrectAnswers AS (
                SELECT DISTINCT ON ("questionId")
                    "questionId",
                    "userAnswer"
                FROM "GameHistory"
                WHERE "userId" = ${userId}
                    AND correct = false
                    AND "userAnswer" IS NOT NULL
                ORDER BY "questionId", timestamp DESC
            )
            SELECT 
                la."questionId" as id,
                la.correct,
                la.points,
                la.timestamp,
                q.question,
                q.answer,
                q.value,
                q."airDate",
                q."wasTripleStumper",
                q.round::text as round,
                q."categoryId",
                c.name as "categoryName",
                lia."userAnswer" as "lastIncorrectUserAnswer"
            FROM LatestAnswers la
            JOIN "Question" q ON q.id = la."questionId"
            JOIN "Category" c ON c.id = q."categoryId"
            LEFT JOIN LastIncorrectAnswers lia ON lia."questionId" = la."questionId"
            WHERE q.round::text = ${round}
            ORDER BY la.timestamp DESC
        ` as Array<{
            id: string
            correct: boolean
            points: number
            timestamp: Date
            question: string
            answer: string
            value: number
            airDate: Date | null
            wasTripleStumper: boolean
            round: string
            categoryId: string
            categoryName: string
            lastIncorrectUserAnswer: string | null
        }>

        // Compute normalized points for each question
        const questionsWithNormalizedPoints = answeredQuestions.map(q => {
            const normalizedPoints = getStatsPoints({
                round: q.round,
                faceValue: q.value,
                correct: q.correct,
                storedPoints: q.points
            })
            return {
                ...q,
                points: normalizedPoints
            }
        })

        // Calculate summary stats using normalized points
        const totalCorrect = questionsWithNormalizedPoints.filter(q => q.correct).length
        const totalIncorrect = questionsWithNormalizedPoints.filter(q => !q.correct).length
        const totalPoints = questionsWithNormalizedPoints
            .filter(q => q.correct)
            .reduce((sum, q) => sum + q.points, 0)

        // Group questions by category for the category breakdown
        const categoryMap = new Map<string, {
            categoryId: string
            categoryName: string
            questions: typeof questionsWithNormalizedPoints
            correct: number
            incorrect: number
        }>()

        questionsWithNormalizedPoints.forEach(q => {
            const existing = categoryMap.get(q.categoryId)
            if (existing) {
                existing.questions.push(q)
                if (q.correct) existing.correct++
                else existing.incorrect++
            } else {
                categoryMap.set(q.categoryId, {
                    categoryId: q.categoryId,
                    categoryName: q.categoryName,
                    questions: [q],
                    correct: q.correct ? 1 : 0,
                    incorrect: q.correct ? 0 : 1
                })
            }
        })

        const categories = Array.from(categoryMap.values())
            .sort((a, b) => {
                // Sort by most recently answered (first question's timestamp)
                const aTime = a.questions[0]?.timestamp ? new Date(a.questions[0].timestamp).getTime() : 0
                const bTime = b.questions[0]?.timestamp ? new Date(b.questions[0].timestamp).getTime() : 0
                return bTime - aTime
            })

        return jsonResponse({
            questions: questionsWithNormalizedPoints,
            categories,
            summary: {
                totalCorrect,
                totalIncorrect,
                totalAttempted: questionsWithNormalizedPoints.length,
                totalPoints
            }
        })
    } catch (err) {
        console.error('Error fetching round history:', err)
        return serverErrorResponse('Failed to fetch round history', err)
    }
}

