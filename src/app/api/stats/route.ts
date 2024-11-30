import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    try {
        // Get all game history for the user
        const gameHistory = await prisma.gameHistory.findMany({
            where: { userId },
            include: {
                question: {
                    include: {
                        category: true
                    }
                }
            }
        })

        // Get user progress for all categories
        const userProgress = await prisma.userProgress.findMany({
            where: { userId },
            include: {
                category: true
            }
        })

        // Calculate total statistics
        const totalPoints = gameHistory.reduce((sum, record) => sum + record.points, 0)
        const totalQuestions = gameHistory.length
        const correctAnswers = gameHistory.filter(record => record.correct).length

        // Calculate category statistics
        const categoryStats = userProgress.map(progress => ({
            categoryName: progress.category.name,
            correct: progress.correct,
            total: progress.total,
            points: progress.points
        }))

        return NextResponse.json({
            totalPoints,
            totalQuestions,
            correctAnswers,
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