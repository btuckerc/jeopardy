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

const historyParamsSchema = z.object({
    type: z.enum(['points', 'attempted', 'correct', 'tripleStumpers']),
    tab: z.enum(['correct', 'incorrect']).optional()
})

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, historyParamsSchema)
        
        if (error) return error

        const user = await getAuthenticatedUser()
        if (!user) {
            return errorResponse('Authentication required', 401)
        }

        const userId = user.id
        const { type, tab } = params

        // Get all answered questions with details
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
                q.round,
                c.name as "categoryName",
                lia."userAnswer" as "lastIncorrectUserAnswer"
            FROM LatestAnswers la
            JOIN "Question" q ON q.id = la."questionId"
            JOIN "Category" c ON c.id = q."categoryId"
            LEFT JOIN LastIncorrectAnswers lia ON lia."questionId" = la."questionId"
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

        let filteredQuestions = questionsWithNormalizedPoints

        // Filter and sort based on type
        switch (type) {
            case 'points':
                // Sort by normalized points earned (descending), only correct answers have points
                filteredQuestions = questionsWithNormalizedPoints
                    .filter(q => q.correct)
                    .sort((a, b) => b.points - a.points)
                break
            
            case 'attempted':
                // Show all attempted, with tab filter
                if (tab === 'correct') {
                    filteredQuestions = questionsWithNormalizedPoints.filter(q => q.correct)
                } else {
                    // Default to incorrect
                    filteredQuestions = questionsWithNormalizedPoints.filter(q => !q.correct)
                }
                // Sort by timestamp descending (most recent first)
                filteredQuestions.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )
                break
            
            case 'correct':
                // Show all with correct prioritized
                if (tab === 'incorrect') {
                    filteredQuestions = questionsWithNormalizedPoints.filter(q => !q.correct)
                } else {
                    // Default to correct
                    filteredQuestions = questionsWithNormalizedPoints.filter(q => q.correct)
                }
                // Sort by timestamp descending
                filteredQuestions.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )
                break
            
            case 'tripleStumpers':
                // Only triple stumpers that user got correct
                filteredQuestions = questionsWithNormalizedPoints
                    .filter(q => q.wasTripleStumper && q.correct)
                    .sort((a, b) => b.points - a.points)
                break
        }

        // Calculate summary stats
        // For triple stumpers modal, only count triple stumper questions in summary
        // For other modals, count all answered questions
        const summaryQuestions = type === 'tripleStumpers' 
            ? questionsWithNormalizedPoints.filter(q => q.wasTripleStumper)
            : questionsWithNormalizedPoints

        const totalCorrect = summaryQuestions.filter(q => q.correct).length
        const totalIncorrect = summaryQuestions.filter(q => !q.correct).length
        const totalTripleStumpers = summaryQuestions.filter(q => q.wasTripleStumper && q.correct).length

        return jsonResponse({
            questions: filteredQuestions,
            summary: {
                totalCorrect,
                totalIncorrect,
                totalTripleStumpers,
                totalAttempted: summaryQuestions.length
            }
        })
    } catch (err) {
        console.error('Error fetching stats history:', err)
        return serverErrorResponse('Failed to fetch stats history', err)
    }
}

