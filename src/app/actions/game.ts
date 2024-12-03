'use server'

import { prisma } from '../lib/prisma'
import type { Prisma } from '@prisma/client'

type GameCategory = {
    id: string
    name: string
    questions: {
        id: string
        question: string
        answer: string
        value: number
        category: string
        difficulty: 'EASY' | 'MEDIUM' | 'HARD'
    }[]
}

export async function getGameCategories(): Promise<{ categories: GameCategory[] }> {
    try {
        const categories = await prisma.category.findMany({
            take: 6,
            orderBy: {
                name: 'asc'
            },
            include: {
                questions: {
                    select: {
                        id: true,
                        question: true,
                        answer: true,
                        value: true,
                        difficulty: true
                    }
                }
            }
        })

        if (!categories || categories.length === 0) {
            return { categories: [] }
        }

        return {
            categories: categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                questions: cat.questions.map(q => ({
                    id: q.id,
                    question: q.question,
                    answer: q.answer,
                    value: q.value || 200,
                    category: cat.name,
                    difficulty: q.difficulty
                }))
            }))
        }
    } catch (error) {
        console.error('Error fetching game categories:', error)
        return { categories: [] }
    }
}

export async function saveGameHistory(
    userId: string,
    questionId: string,
    isCorrect: boolean,
    points: number
): Promise<{ success: boolean }> {
    if (!userId || !questionId) {
        return { success: false }
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // First ensure user exists
            const user = await tx.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: '', // We'll update this later if needed
                }
            })

            // Check if this question has already been answered correctly
            const existingHistory = await tx.gameHistory.findFirst({
                where: {
                    userId: user.id,
                    questionId,
                    correct: true
                }
            })

            // If already answered correctly, don't add points
            const shouldAwardPoints = isCorrect && !existingHistory

            // Then find the question to get the category
            const question = await tx.question.findUnique({
                where: { id: questionId },
                include: { category: true }
            })

            if (!question) {
                throw new Error('Question not found')
            }

            // Create game history entry
            await tx.gameHistory.create({
                data: {
                    userId: user.id,
                    questionId,
                    correct: isCorrect,
                    points: shouldAwardPoints ? points : 0
                }
            })

            // Update or create user progress
            const progress = await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId: user.id,
                        categoryId: question.categoryId
                    }
                },
                update: {
                    correct: { increment: shouldAwardPoints ? 1 : 0 },
                    total: { increment: !existingHistory ? 1 : 0 },
                    points: { increment: shouldAwardPoints ? points : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    categoryId: question.categoryId,
                    questionId: question.id,
                    correct: shouldAwardPoints ? 1 : 0,
                    total: 1,
                    points: shouldAwardPoints ? points : 0
                }
            })

            return true
        })

        return { success: result }
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error in saveGameHistory:', error.message)
        }
        return { success: false }
    }
} 