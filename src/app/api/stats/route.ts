import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    try {
        // First get all categories with their total questions and most recent air date
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

        // Then get the latest answer for each unique question
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
        }>

        // Calculate total statistics from unique answers
        const totalPoints = latestAnswers
            .filter(record => record.correct)
            .reduce((sum, record) => sum + record.points, 0)

        const totalAnswered = latestAnswers.length
        const correctAnswers = latestAnswers.filter(record => record.correct).length
        const tripleStumpersAnswered = latestAnswers
            .filter(record => record.correct && record.wasTripleStumper)
            .length

        // Initialize category stats with total questions from all categories
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

        // Update with answered questions
        latestAnswers.forEach(record => {
            if (record.correct) {
                categoryStatsMap[record.categoryId].correct++
                categoryStatsMap[record.categoryId].points += record.points
            }
        })

        const categoryStats = Object.values(categoryStatsMap)

        // Calculate total questions across all categories
        const totalQuestions = categories.reduce((sum, cat) => sum + cat._count.questions, 0)

        return NextResponse.json({
            totalPoints,
            totalQuestions,
            totalAnswered,
            correctAnswers,
            tripleStumpersAnswered,
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