'use server'

import { prisma } from '../lib/prisma'
import crypto from 'crypto'

export async function getCategories(userId?: string) {
    try {
        // Get questions grouped by knowledge category
        const knowledgeCategories = await prisma.question.groupBy({
            by: ['knowledgeCategory'],
        })

        // Get questions for each knowledge category
        const categories = await Promise.all(
            knowledgeCategories.map(async (cat) => {
                const questions = await prisma.question.findMany({
                    where: {
                        knowledgeCategory: cat.knowledgeCategory
                    },
                    include: {
                        category: true
                    },
                    take: 10 // Limit to 10 questions per category
                })

                return {
                    id: cat.knowledgeCategory,
                    name: cat.knowledgeCategory.replace(/_/g, ' ').toLowerCase()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' '),
                    questions: questions.map(q => ({
                        id: q.id,
                        question: q.question,
                        answer: q.answer,
                        value: q.value || 200,
                        categoryName: cat.knowledgeCategory,
                        originalCategory: q.category.name
                    }))
                }
            })
        )

        return categories
    } catch (error) {
        console.error('Error fetching categories:', error)
        throw error
    }
}

export async function saveAnswer(
    userId: string,
    questionId: string,
    categoryId: string,
    isCorrect: boolean
) {
    if (!userId || !questionId || !categoryId) return

    try {
        await prisma.$transaction(async (tx) => {
            // Ensure user exists
            const user = await tx.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: '', // We'll update this later if needed
                }
            })

            // Get the question to get its category
            const question = await tx.question.findUnique({
                where: { id: questionId },
                select: { categoryId: true }
            })

            if (!question) throw new Error('Question not found')

            // Create game history entry
            await tx.gameHistory.create({
                data: {
                    userId: user.id,
                    questionId,
                    correct: isCorrect,
                    points: isCorrect ? 200 : 0 // Default value for practice mode
                }
            })

            // Update or create user progress
            await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId: user.id,
                        categoryId: question.categoryId
                    }
                },
                update: {
                    correct: { increment: isCorrect ? 1 : 0 },
                    total: { increment: 1 },
                    points: { increment: isCorrect ? 200 : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    categoryId: question.categoryId,
                    questionId,
                    correct: isCorrect ? 1 : 0,
                    total: 1,
                    points: isCorrect ? 200 : 0
                }
            })
        })
    } catch (error) {
        console.error('Error saving answer:', error)
        throw error
    }
} 