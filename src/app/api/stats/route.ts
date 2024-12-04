import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    try {
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

        return NextResponse.json({
            totalPoints,
            totalQuestions,
            totalAnswered,
            correctAnswers,
            tripleStumpersAnswered,
            knowledgeCategoryStats,
            categoryStats
        })
    } catch (error) {
        console.error('Error fetching user statistics:', error)
        return NextResponse.json(
            { error: 'Failed to fetch statistics' },
            { status: 500 }
        )
    }
} 