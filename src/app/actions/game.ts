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
            // First find the question to get the category
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
                    userId,
                    questionId,
                    correct: isCorrect,
                    points
                }
            })

            // Update or create user progress
            await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId,
                        categoryId: question.categoryId
                    }
                },
                update: {
                    correct: { increment: isCorrect ? 1 : 0 },
                    total: { increment: 1 },
                    points: { increment: points }
                },
                create: {
                    userId,
                    categoryId: question.categoryId,
                    correct: isCorrect ? 1 : 0,
                    total: 1,
                    points
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